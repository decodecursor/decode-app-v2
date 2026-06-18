-- Sample offer seed — ONE active offer on the Santorini spa pro so the gift
-- icon + OfferModal are immediately testable. Resolve the professional by
-- name (ILIKE '%santorini%'). Separate file, NOT a migration — run manually
-- against the DB when you want sample data.
--
-- professional_id is UNIQUE, so ON CONFLICT keeps this idempotent.

INSERT INTO public.model_professional_offers
  (professional_id, discount_label, subtitle, detail, valid_until, is_active)
SELECT
  p.id,
  '20% OFF',
  'For your first visit',
  'New DECODE clients only',
  DATE '2026-07-31',
  true
FROM public.model_professionals p
WHERE p.name ILIKE '%santorini%'
ON CONFLICT (professional_id) DO UPDATE SET
  discount_label = EXCLUDED.discount_label,
  subtitle       = EXCLUDED.subtitle,
  detail         = EXCLUDED.detail,
  valid_until    = EXCLUDED.valid_until,
  is_active      = EXCLUDED.is_active,
  updated_at     = now();
