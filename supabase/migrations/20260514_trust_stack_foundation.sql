-- ============================================================================
-- DECODE Trust Stack — Chunk 1 Foundation Migration
-- Run in Supabase SQL Editor (MCP is read-only)
-- Date: 2026-05-14
-- ============================================================================
-- Schema delta per spec §4:
--   - 10 new columns on model_professionals (all nullable, no backfill)
--   - 3 new CHECK enum values on model_analytics_events.event_type
-- No new tables. No new RLS policies.
-- model_listings_live view NOT recreated — it projects only model_listings
-- columns, never model_professionals (verified via pg_get_viewdef).
-- ============================================================================

-- ============================================
-- 1. model_professionals — 10 new columns
-- ============================================
-- V1 active: google_place_id, whatsapp_number, google_places_cache,
--   google_places_cached_at, review_summary_gemini, review_summary_generated_at
-- V1 forward-compat: review_summary_custom, claimed_by_user_id, claimed_at,
--   google_business_profile_id
ALTER TABLE model_professionals
  ADD COLUMN google_place_id TEXT NULL,
  ADD COLUMN whatsapp_number TEXT NULL,
  ADD COLUMN google_places_cache JSONB NULL,
  ADD COLUMN google_places_cached_at TIMESTAMPTZ NULL,
  ADD COLUMN review_summary_gemini TEXT NULL,
  ADD COLUMN review_summary_generated_at TIMESTAMPTZ NULL,
  ADD COLUMN review_summary_custom TEXT NULL,
  ADD COLUMN claimed_by_user_id UUID NULL REFERENCES users(id),
  ADD COLUMN claimed_at TIMESTAMPTZ NULL,
  ADD COLUMN google_business_profile_id TEXT NULL;


-- ============================================
-- 2. model_analytics_events.event_type — CHECK enum extension
-- ============================================
-- 8 existing values (verbatim from current constraint) + 3 new Trust Stack
-- values. Moves in lockstep with the API ALLOWED_EVENT_TYPES Set.
ALTER TABLE model_analytics_events
  DROP CONSTRAINT model_analytics_events_event_type_check;

ALTER TABLE model_analytics_events
  ADD CONSTRAINT model_analytics_events_event_type_check
  CHECK (event_type IN (
    -- 8 existing values
    'public_page_view',
    'listing_instagram_click',
    'listing_media_click',
    'wish_giftit_click',
    'wish_instagram_click',
    'public_page_share_click',
    'wall_of_love_instagram_click',
    'squad_media_swipe_view',
    -- 3 new values for Trust Stack
    'listing_modal_open',
    'listing_whatsapp_badge_click',
    'listing_whatsapp_modal_click'
  ));
