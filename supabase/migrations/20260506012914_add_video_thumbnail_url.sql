BEGIN;

ALTER TABLE public.model_listings
  ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT NULL;

COMMENT ON COLUMN public.model_listings.video_thumbnail_url IS
  'Cached first-frame URL for video listings, generated server-side at upload to avoid client-side decoding on iOS/Safari. NULL for photo listings or videos uploaded before this field existed.';

CREATE OR REPLACE VIEW public.model_listings_live AS
 SELECT id,
    model_id,
    professional_id,
    category_id,
    category_custom,
    media_type,
    video_url,
    photo_url_1,
    photo_url_2,
    photo_url_3,
    price_30,
    price_60,
    price_90,
    currency,
    payment_link_token,
    status,
    is_free_trial,
    free_trial_ends_at,
    paid_until,
    expiry_notification_sent_at,
    created_at,
    updated_at,
        CASE
            WHEN status = 'active'::text AND paid_until IS NOT NULL AND paid_until < now() THEN 'expired'::text
            WHEN status = 'free_trial'::text AND free_trial_ends_at IS NOT NULL AND free_trial_ends_at < now() THEN 'expired'::text
            ELSE status
        END AS effective_status,
    video_thumbnail_url
   FROM model_listings l;

COMMIT;
