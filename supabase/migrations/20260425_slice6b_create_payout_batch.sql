-- ============================================================================
-- Slice 6B-2 — create_payout_batch() RPC
-- Date: 2026-04-25
-- ============================================================================
--
-- Schema-side atomic batching primitive per Slice 6 locked decision #3.
-- Mirrors the claim_wish_for_payment precedent (Slice 5C lesson):
-- schema-side RPCs remove deployment-ordering hazards and make the atomic
-- boundary explicit. App-side service-role transactions would have required
-- careful BEGIN/COMMIT discipline plus race handling that PostgreSQL gives
-- us for free at the row-lock layer.
--
-- Atomicity contract:
--   1. Fail fast if no primary bank account (caller surfaces actionable
--      error to admin)
--   2. Determine currency from unbatched payments — must all match (no
--      mixed-currency batches per locked decision H per-payout currency)
--   3. INSERT a placeholder model_payouts row with bank snapshot
--   4. UPDATE-RETURNING on both payment tables, atomic at row-lock layer
--      (concurrent batch attempts wait then re-evaluate the WHERE; second
--      attempt sees 0 unbatched and falls through to empty-payout cleanup
--      app-side per decision F)
--   5. UPDATE the payout row with computed totals + counts
--   6. RETURN payout_id + reference + counts + net_total for caller
--
-- Returns 0 rows when no unbatched payments exist (no INSERT performed).
-- Returns 1 row with possibly-zero counts under a race; app caller deletes
-- the orphan per decision F.
--
-- SECURITY DEFINER: needed because the function reads from auth-protected
-- tables (model_profiles → user_bank_accounts join) but the calling
-- service-role context is trusted. Locked behind GRANT to service_role
-- only — anon + authenticated do NOT have EXECUTE.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_payout_batch(model_id_in uuid)
RETURNS TABLE(
  payout_id uuid,
  payout_reference text,
  listings_count integer,
  wishes_count integer,
  gross_total numeric,
  platform_fee_total numeric,
  net_total numeric,
  currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_id   uuid;
  v_ref         text;
  v_currency    text;
  v_currencies  int;
  v_user_id     uuid;
  v_bank_name   text;
  v_iban        text;
  v_bank_last4  text;
  v_listings_count int := 0;
  v_wishes_count   int := 0;
  v_gross_total  numeric := 0;
  v_fee_total    numeric := 0;
  v_net_total    numeric := 0;
BEGIN
  -- 1. Resolve owning user_id (model_profiles.id → model_profiles.user_id)
  SELECT user_id INTO v_user_id
  FROM public.model_profiles
  WHERE id = model_id_in;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'model_profile % not found', model_id_in
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 2. Currency homogeneity check — must be exactly 1 distinct currency
  --    across all unbatched completed payments. Prevents mixed-currency
  --    batches (per locked decision H per-payout currency, no conversion).
  SELECT COUNT(DISTINCT currency), MIN(currency)
  INTO v_currencies, v_currency
  FROM (
    SELECT currency FROM public.model_listing_payments
     WHERE model_id = model_id_in AND status = 'completed' AND payout_id IS NULL
    UNION ALL
    SELECT currency FROM public.model_wish_payments
     WHERE model_id = model_id_in AND status = 'completed' AND payout_id IS NULL
  ) sub;

  IF v_currencies = 0 THEN
    -- No unbatched payments — return empty result, caller surfaces
    -- "no eligible payments" without an INSERT.
    RETURN;
  END IF;

  IF v_currencies > 1 THEN
    RAISE EXCEPTION 'mixed currencies in unbatched payments for model %: % distinct',
      model_id_in, v_currencies
      USING ERRCODE = 'data_exception';
  END IF;

  -- 3. Bank snapshot — fail fast if no primary bank set. Captures bank_name
  --    + last4 of IBAN at batch creation; stays immutable on the payout
  --    row even if ambassador updates their bank later.
  SELECT bank_name, iban_number
  INTO v_bank_name, v_iban
  FROM public.user_bank_accounts
  WHERE user_id = v_user_id AND is_primary = true
  LIMIT 1;

  IF v_bank_name IS NULL OR v_iban IS NULL THEN
    RAISE EXCEPTION 'no primary bank account for model %', model_id_in
      USING ERRCODE = 'no_data_found';
  END IF;

  v_bank_last4 := RIGHT(v_iban, 4);

  -- 4. Generate P-XXX-XXXX reference (matches L/W shape per decision δ).
  --    Retry-on-collision is handled at app layer if ever needed; the
  --    9M reference space (900*9000) makes collisions vanishingly rare.
  v_ref := 'P-' ||
           LPAD((100 + FLOOR(random() * 900))::int::text, 3, '0') || '-' ||
           LPAD((1000 + FLOOR(random() * 9000))::int::text, 4, '0');

  -- 5. INSERT placeholder payout row. Totals + counts are zero here and
  --    UPDATEd after the UPDATE-RETURNING blocks aggregate the actuals.
  INSERT INTO public.model_payouts (
    payout_reference, model_id, gross_total, platform_fee_total, net_total,
    currency, listings_count, wishes_count, bank_name, bank_last4, status
  ) VALUES (
    v_ref, model_id_in, 0, 0, 0,
    v_currency, 0, 0, v_bank_name, v_bank_last4, 'pending'
  )
  RETURNING id INTO v_payout_id;

  -- 6. UPDATE-RETURNING on listing payments — atomic at the row-lock
  --    layer. Concurrent batch attempts on the same model wait on these
  --    locks then re-evaluate the WHERE (status='completed' AND
  --    payout_id IS NULL); the loser sees 0 rows updated.
  WITH updated AS (
    UPDATE public.model_listing_payments
       SET payout_id = v_payout_id,
           updated_at = NOW()
     WHERE model_id = model_id_in
       AND status   = 'completed'
       AND payout_id IS NULL
    RETURNING gross_amount, platform_fee, net_amount
  )
  SELECT COUNT(*),
         COALESCE(SUM(gross_amount), 0),
         COALESCE(SUM(platform_fee), 0),
         COALESCE(SUM(net_amount), 0)
    INTO v_listings_count, v_gross_total, v_fee_total, v_net_total
    FROM updated;

  -- 7. UPDATE-RETURNING on wish payments — same atomic pattern.
  WITH updated AS (
    UPDATE public.model_wish_payments
       SET payout_id = v_payout_id,
           updated_at = NOW()
     WHERE model_id = model_id_in
       AND status   = 'completed'
       AND payout_id IS NULL
    RETURNING gross_amount, platform_fee, net_amount
  )
  SELECT v_wishes_count + COUNT(*),
         v_gross_total + COALESCE(SUM(gross_amount), 0),
         v_fee_total   + COALESCE(SUM(platform_fee), 0),
         v_net_total   + COALESCE(SUM(net_amount), 0)
    INTO v_wishes_count, v_gross_total, v_fee_total, v_net_total
    FROM updated;

  -- 8. UPDATE the payout row with final totals + counts. Listings_count
  --    and wishes_count are pre-computed for the Statement page stats
  --    row (mockup lines 79-92) so the GET endpoint doesn't need to
  --    re-query the payment tables to derive them.
  UPDATE public.model_payouts
     SET gross_total        = v_gross_total,
         platform_fee_total = v_fee_total,
         net_total          = v_net_total,
         listings_count     = v_listings_count,
         wishes_count       = v_wishes_count,
         updated_at         = NOW()
   WHERE id = v_payout_id;

  RETURN QUERY
    SELECT v_payout_id, v_ref, v_listings_count, v_wishes_count,
           v_gross_total, v_fee_total, v_net_total, v_currency;
END;
$$;

-- Lock execution to service_role only. Admin endpoint runs with service-
-- role context; ambassadors never call this directly.
REVOKE ALL ON FUNCTION public.create_payout_batch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payout_batch(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_payout_batch(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_batch(uuid) TO service_role;
