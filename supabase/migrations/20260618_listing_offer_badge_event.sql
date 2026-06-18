-- Offer gift-icon analytics. Extend the event_type CHECK enum with
-- listing_offer_badge_click so the public-page offer gift icon tap can record
-- into model_analytics_events (lockstepped with ALLOWED_EVENT_TYPES in
-- app/api/analytics/track/route.ts).
ALTER TABLE public.model_analytics_events
  DROP CONSTRAINT IF EXISTS model_analytics_events_event_type_check;

ALTER TABLE public.model_analytics_events
  ADD CONSTRAINT model_analytics_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'public_page_view'::text,
    'listing_instagram_click'::text,
    'listing_media_click'::text,
    'wish_giftit_click'::text,
    'wish_instagram_click'::text,
    'public_page_share_click'::text,
    'wall_of_love_instagram_click'::text,
    'squad_media_swipe_view'::text,
    'listing_modal_open'::text,
    'listing_whatsapp_badge_click'::text,
    'listing_whatsapp_modal_click'::text,
    'ambassador_instagram_click'::text,
    'listing_ambassadors_badge_click'::text,
    'listing_offer_badge_click'::text
  ]));
