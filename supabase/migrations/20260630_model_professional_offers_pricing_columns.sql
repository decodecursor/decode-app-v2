-- model_professional_offers — price-based offer fields.
--
-- The modal no longer renders a stored "% OFF" string; instead it shows a
-- service with its original/special price (the % is DERIVED in the UI, never
-- stored) plus an optional perk. This migration ADDS those columns.
--
-- The legacy display columns (discount_label / subtitle / detail) are NO
-- LONGER read by the modal but are intentionally LEFT IN PLACE — do NOT drop
-- them. We only relax discount_label's NOT NULL so price-built offers (which
-- never supply it) can be inserted.
--
-- FILE ONLY — do NOT apply automatically. Apply manually when ready.

ALTER TABLE public.model_professional_offers
  ADD COLUMN IF NOT EXISTS service        text,    -- e.g. "Haircut"
  ADD COLUMN IF NOT EXISTS original_price numeric, -- e.g. 290
  ADD COLUMN IF NOT EXISTS special_price  numeric, -- e.g. 174
  ADD COLUMN IF NOT EXISTS perk           text;    -- e.g. "Hair wash & blow-dry" (nullable)

-- discount_label was NOT NULL with no default. Price-built offers don't supply
-- it, so relax the constraint (column kept for backward compat, not dropped).
ALTER TABLE public.model_professional_offers
  ALTER COLUMN discount_label DROP NOT NULL;

-- UNDO:
--   ALTER TABLE public.model_professional_offers
--     DROP COLUMN IF EXISTS service,
--     DROP COLUMN IF EXISTS original_price,
--     DROP COLUMN IF EXISTS special_price,
--     DROP COLUMN IF EXISTS perk;
--   -- Re-applying NOT NULL requires all rows to have a non-null discount_label first:
--   -- ALTER TABLE public.model_professional_offers ALTER COLUMN discount_label SET NOT NULL;
