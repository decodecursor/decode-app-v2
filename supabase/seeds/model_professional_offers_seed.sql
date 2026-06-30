-- Sample offer seed — ONE active, price-based offer, EXCLUSIVE to Yanni's
-- page for now. The offer is built from prices (service / original / special
-- + perk); the % is derived in the UI, never stored.
--
-- Resolved through Yanni's OWN live listing so the gift icon is guaranteed to
-- surface on /yannijohnson: the pro Yanni lists whose name matches '%glow%'
-- (Glow Studio — professional_id 449ec683-78b1-48c8-95c2-ac20f0a88def).
--
-- professional_id is UNIQUE, so ON CONFLICT keeps this idempotent — running it
-- against an already-existing Glow Studio offer just fills in the price fields.
--
-- FILE ONLY — run manually (Supabase SQL editor) when you want the data.
-- Requires 20260630_model_professional_offers_pricing_columns.sql first.

-- 1) Keep it exclusive to Yanni: deactivate EVERY other offer so no other page
--    can surface one. After this seed there is exactly ONE active offer total.
UPDATE public.model_professional_offers
SET is_active = false, updated_at = now()
WHERE professional_id <> (
  SELECT ll.professional_id
  FROM public.model_listings_live ll
  JOIN public.model_professionals p ON p.id = ll.professional_id
  WHERE ll.model_id = (SELECT id FROM public.model_profiles WHERE slug = 'yannijohnson')
    AND p.name ILIKE '%glow%'
  LIMIT 1
);

-- 2) UPSERT the one active, price-based offer on Yanni's Glow Studio pro.
INSERT INTO public.model_professional_offers
  (professional_id, service, original_price, special_price, perk, valid_until, is_active)
SELECT
  ll.professional_id,
  'Haircut',
  290,
  174,
  'Hair wash & blow-dry',
  DATE '2026-07-31',
  true
FROM public.model_listings_live ll
JOIN public.model_professionals p ON p.id = ll.professional_id
WHERE ll.model_id = (SELECT id FROM public.model_profiles WHERE slug = 'yannijohnson')
  AND p.name ILIKE '%glow%'
LIMIT 1
ON CONFLICT (professional_id) DO UPDATE SET
  service        = EXCLUDED.service,
  original_price = EXCLUDED.original_price,
  special_price  = EXCLUDED.special_price,
  perk           = EXCLUDED.perk,
  valid_until    = EXCLUDED.valid_until,
  is_active      = EXCLUDED.is_active,
  updated_at     = now();

-- UNDO (revert the price fields on Glow Studio's offer):
--   UPDATE public.model_professional_offers
--   SET service = NULL, original_price = NULL, special_price = NULL, perk = NULL,
--       updated_at = now()
--   WHERE professional_id = '449ec683-78b1-48c8-95c2-ac20f0a88def';
