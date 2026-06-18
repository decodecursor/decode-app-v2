-- model_professional_offers — per-professional OFFER shown in the public-page
-- coupon modal (gift icon → OfferModal). ONE offer per pro, total: the
-- professional_id UNIQUE constraint enforces "at most one offer per pro".
--
-- DISPLAY-ONLY for now (populated by SQL seed). This table is the foundation
-- the future pro-facing editing / ad-posting flow will write to.
--
-- RLS: public-read for ACTIVE offers only (is_active = true), mirroring
-- model_listings' "Public read active listings" pattern. The public page
-- fetches via the service role (RLS bypassed) and keeps the is_active filter
-- explicit in code, but the policy is the correct default for any anon read.

CREATE TABLE IF NOT EXISTS public.model_professional_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE = at most one offer per professional, total.
  professional_id uuid NOT NULL UNIQUE
                    REFERENCES public.model_professionals(id) ON DELETE CASCADE,
  discount_label  text NOT NULL,   -- big pink headline, e.g. "20% OFF"
  subtitle        text,            -- e.g. "For your first visit"
  detail          text,            -- e.g. "New DECODE clients only"
  valid_until     date,            -- shown as "Valid until 31 July 2026"
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_professional_offers ENABLE ROW LEVEL SECURITY;

-- Public read of active offers only. Mirrors model_listings'
-- "Public read active listings" SELECT policy.
DROP POLICY IF EXISTS "Public read active offers" ON public.model_professional_offers;
CREATE POLICY "Public read active offers"
  ON public.model_professional_offers
  FOR SELECT
  USING (is_active = true);
