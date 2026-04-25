-- ============================================================================
-- Slice 6B-2 hotfix — create_payout_batch() currency collision
-- Date: 2026-04-25
-- Closes: bug surfaced during 6B-2 verification on test ambassador
--         84f2c536-d48e-45f4-a6bd-b97270d78c1e (4L + 2W unbatched).
-- ============================================================================
--
-- The original 20260425_slice6b_create_payout_batch.sql aborted at the
-- currency-homogeneity SELECT with:
--
--   ERROR: 42702: column reference "currency" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--
-- Root cause is NOT the local variable (`v_currency`, already prefixed).
-- The collision is with the RETURNS TABLE output column also named
-- `currency` — RETURNS TABLE columns are exposed as variables inside the
-- function body (PL/pgSQL scope), so a bare `currency` in a SELECT list is
-- ambiguous between the table column being read and the RETURNS TABLE
-- output column. Postgres's `plpgsql.variable_conflict = error` (default)
-- raises rather than guessing.
--
-- Fix (per user-recommended option (a) qualify-with-table-names, plus a
-- belt-and-suspenders alias on the subquery output column so the OUTER
-- COUNT/MIN aggregates also have no name overlap):
--
--   - Inner SELECTs: `model_listing_payments.currency AS cur` and
--     `model_wish_payments.currency AS cur` — fully qualified column ref
--     plus an alias that doesn't shadow the RETURNS TABLE name.
--   - Outer aggregates: `COUNT(DISTINCT sub.cur), MIN(sub.cur)` — refers
--     to the aliased subquery output, no collision possible.
--
-- Audit while in there: every other bare column reference in the function
-- body was reviewed against the RETURNS TABLE columns (payout_id,
-- payout_reference, listings_count, wishes_count, gross_total,
-- platform_fee_total, net_total, currency). The only collision was on
-- `currency`. WHERE-clause references like `WHERE payout_id IS NULL` are
-- not affected because the UPDATE/SELECT target table provides
-- unambiguous column resolution at parse time. SELECT-list references
-- like `SELECT currency FROM ...` are the path that triggers
-- variable_conflict checks, which is why this surfaced on `currency` and
-- not on other RETURNS TABLE columns.
--
-- Atomic rollback worked as designed: the function aborted at the very
-- first SELECT after profile lookup, before any INSERT or UPDATE on
-- model_payouts / payment tables. No partial state, no orphan rows.
--
-- Function signature (RETURNS TABLE shape, parameter list, language,
-- security mode, search_path) is unchanged. The API route at
-- /api/admin/payouts/create reads `result.currency` from the return —
-- still works, no app-side change needed.
--
-- Hardening retro logged in CLAUDE_CODE_HANDOFF.md "Stored function
-- variable-naming convention" addition (separate commit alongside this).
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
  SELECT mp.user_id INTO v_user_id
  FROM public.model_profiles mp
  WHERE mp.id = model_id_in;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'model_profile % not found', model_id_in
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COUNT(DISTINCT sub.cur), MIN(sub.cur)
  INTO v_currencies, v_currency
  FROM (
    SELECT model_listing_payments.currency AS cur
      FROM public.model_listing_payments
     WHERE model_listing_payments.model_id  = model_id_in
       AND model_listing_payments.status    = 'completed'
       AND model_listing_payments.payout_id IS NULL
    UNION ALL
    SELECT model_wish_payments.currency AS cur
      FROM public.model_wish_payments
     WHERE model_wish_payments.model_id  = model_id_in
       AND model_wish_payments.status    = 'completed'
       AND model_wish_payments.payout_id IS NULL
  ) sub;

  IF v_currencies = 0 THEN
    RETURN;
  END IF;

  IF v_currencies > 1 THEN
    RAISE EXCEPTION 'mixed currencies in unbatched payments for model %: % distinct',
      model_id_in, v_currencies
      USING ERRCODE = 'data_exception';
  END IF;

  SELECT uba.bank_name, uba.iban_number
  INTO v_bank_name, v_iban
  FROM public.user_bank_accounts uba
  WHERE uba.user_id = v_user_id AND uba.is_primary = true
  LIMIT 1;

  IF v_bank_name IS NULL OR v_iban IS NULL THEN
    RAISE EXCEPTION 'no primary bank account for model %', model_id_in
      USING ERRCODE = 'no_data_found';
  END IF;

  v_bank_last4 := RIGHT(v_iban, 4);

  v_ref := 'P-' ||
           LPAD((100 + FLOOR(random() * 900))::int::text, 3, '0') || '-' ||
           LPAD((1000 + FLOOR(random() * 9000))::int::text, 4, '0');

  INSERT INTO public.model_payouts (
    payout_reference, model_id, gross_total, platform_fee_total, net_total,
    currency, listings_count, wishes_count, bank_name, bank_last4, status
  ) VALUES (
    v_ref, model_id_in, 0, 0, 0,
    v_currency, 0, 0, v_bank_name, v_bank_last4, 'pending'
  )
  RETURNING id INTO v_payout_id;

  WITH updated AS (
    UPDATE public.model_listing_payments
       SET payout_id = v_payout_id,
           updated_at = NOW()
     WHERE model_listing_payments.model_id  = model_id_in
       AND model_listing_payments.status    = 'completed'
       AND model_listing_payments.payout_id IS NULL
    RETURNING gross_amount, platform_fee, net_amount
  )
  SELECT COUNT(*),
         COALESCE(SUM(updated.gross_amount), 0),
         COALESCE(SUM(updated.platform_fee), 0),
         COALESCE(SUM(updated.net_amount), 0)
    INTO v_listings_count, v_gross_total, v_fee_total, v_net_total
    FROM updated;

  WITH updated AS (
    UPDATE public.model_wish_payments
       SET payout_id = v_payout_id,
           updated_at = NOW()
     WHERE model_wish_payments.model_id  = model_id_in
       AND model_wish_payments.status    = 'completed'
       AND model_wish_payments.payout_id IS NULL
    RETURNING gross_amount, platform_fee, net_amount
  )
  SELECT v_wishes_count + COUNT(*),
         v_gross_total + COALESCE(SUM(updated.gross_amount), 0),
         v_fee_total   + COALESCE(SUM(updated.platform_fee), 0),
         v_net_total   + COALESCE(SUM(updated.net_amount), 0)
    INTO v_wishes_count, v_gross_total, v_fee_total, v_net_total
    FROM updated;

  UPDATE public.model_payouts
     SET gross_total        = v_gross_total,
         platform_fee_total = v_fee_total,
         net_total          = v_net_total,
         listings_count     = v_listings_count,
         wishes_count       = v_wishes_count,
         updated_at         = NOW()
   WHERE model_payouts.id = v_payout_id;

  RETURN QUERY
    SELECT v_payout_id, v_ref, v_listings_count, v_wishes_count,
           v_gross_total, v_fee_total, v_net_total, v_currency;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payout_batch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payout_batch(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_payout_batch(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_batch(uuid) TO service_role;
