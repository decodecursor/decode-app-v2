-- ============================================================================
-- DECODE Ambassador Feature — Foundation Migration
-- Run in Supabase SQL Editor (MCP is read-only)
-- Date: 2026-04-16
-- ============================================================================
-- Creates: set_updated_at() function, 9 model_* tables, RLS policies,
--          indexes, triggers, seed data, 2 views, 2 RPC functions
-- Also documents: model-media storage bucket settings (created via Dashboard)
-- ============================================================================

-- ============================================
-- 0. Trigger function (does not exist yet — verified)
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 1. model_categories (no FKs, create first for seed)
-- ============================================
CREATE TABLE model_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active categories" ON model_categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admin all categories" ON model_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 2. model_profiles (FK → users)
-- ============================================
CREATE TABLE model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9_]{3,30}$'),
  first_name text NOT NULL,
  last_name text NOT NULL,
  cover_photo_url text,
  cover_photo_position_y int DEFAULT 50 CHECK (cover_photo_position_y BETWEEN 0 AND 100),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  tagline text,
  gifts_enabled boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  is_suspended boolean NOT NULL DEFAULT false,
  dashboard_first_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_profiles_user_id ON model_profiles(user_id);
CREATE INDEX idx_model_profiles_slug ON model_profiles(slug);
CREATE INDEX idx_model_profiles_gifts_enabled ON model_profiles(gifts_enabled) WHERE gifts_enabled = true;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published non-suspended profiles" ON model_profiles
  FOR SELECT USING (is_published = true AND is_suspended = false);
CREATE POLICY "Owner read own profile" ON model_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Model insert own profile" ON model_profiles
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Model')
  );
CREATE POLICY "Owner update own profile" ON model_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Owner delete own profile" ON model_profiles
  FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admin all profiles" ON model_profiles
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 3. model_professionals (FK → users)
-- ============================================
CREATE TABLE model_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_handle text UNIQUE NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  avatar_photo_url text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_professionals_ig ON model_professionals(instagram_handle);
CREATE INDEX idx_model_professionals_city ON model_professionals(city);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_professionals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read professionals" ON model_professionals
  FOR SELECT USING (true);
CREATE POLICY "Model insert professionals" ON model_professionals
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Model')
  );
CREATE POLICY "Model update own professionals" ON model_professionals
  FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Admin all professionals" ON model_professionals
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 4. model_listings (FKs → model_profiles, model_professionals, model_categories)
-- ============================================
CREATE TABLE model_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES model_professionals(id),
  category_id uuid REFERENCES model_categories(id),
  category_custom text,
  media_type text CHECK (media_type IN ('video', 'photos') OR media_type IS NULL),
  video_url text,
  photo_url_1 text,
  photo_url_2 text,
  photo_url_3 text,
  price_30 decimal(10,2),
  price_60 decimal(10,2),
  price_90 decimal(10,2),
  currency text NOT NULL,
  payment_link_token text UNIQUE NOT NULL CHECK (length(payment_link_token) = 8),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('free_trial', 'pending_payment', 'active', 'expired')),
  is_free_trial boolean NOT NULL DEFAULT false,
  free_trial_ends_at timestamptz,
  paid_until timestamptz,
  expiry_notification_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((category_id IS NOT NULL AND category_custom IS NULL) OR
         (category_id IS NULL AND category_custom IS NOT NULL)),
  CHECK (
    media_type IS NULL OR
    (media_type = 'video' AND video_url IS NOT NULL) OR
    (media_type = 'photos' AND photo_url_1 IS NOT NULL)
  )
);
CREATE INDEX idx_model_listings_model_id ON model_listings(model_id);
CREATE INDEX idx_model_listings_professional_id ON model_listings(professional_id);
CREATE INDEX idx_model_listings_payment_link_token ON model_listings(payment_link_token);
CREATE INDEX idx_model_listings_status ON model_listings(status);
CREATE INDEX idx_model_listings_paid_until ON model_listings(paid_until) WHERE paid_until IS NOT NULL;
CREATE INDEX idx_model_listings_trial_ends ON model_listings(free_trial_ends_at) WHERE free_trial_ends_at IS NOT NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active listings" ON model_listings
  FOR SELECT USING (
    status IN ('active', 'free_trial') AND
    model_id IN (SELECT id FROM model_profiles WHERE is_published = true AND is_suspended = false)
  );
CREATE POLICY "Owner all on own listings" ON model_listings
  FOR ALL USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all listings" ON model_listings
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 5. model_wishes (FK → model_profiles)
--    Includes payment_link_token (8-char, per clarifications)
-- ============================================
CREATE TABLE model_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  professional_name text,
  professional_city text,
  professional_country text,
  price decimal(10,2) NOT NULL CHECK (price > 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'taken')),
  taken_at timestamptz,
  payment_attempt_expires_at timestamptz,
  gifter_name text,
  gifter_instagram text,
  gifter_is_anonymous boolean NOT NULL DEFAULT false,
  payment_link_token text UNIQUE NOT NULL CHECK (length(payment_link_token) = 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_wishes_model_id ON model_wishes(model_id);
CREATE INDEX idx_model_wishes_status ON model_wishes(status);
CREATE INDEX idx_model_wishes_taken_at ON model_wishes(taken_at) WHERE taken_at IS NOT NULL;
CREATE INDEX idx_model_wishes_payment_link_token ON model_wishes(payment_link_token);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_wishes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_wishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wishes for published profiles with gifts enabled" ON model_wishes
  FOR SELECT USING (
    model_id IN (
      SELECT id FROM model_profiles WHERE is_published = true AND gifts_enabled = true AND is_suspended = false
    )
  );
CREATE POLICY "Owner all on own wishes" ON model_wishes
  FOR ALL USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all wishes" ON model_wishes
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 6. model_payouts (FK → model_profiles, user_bank_accounts)
-- ============================================
CREATE TABLE model_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_reference text UNIQUE NOT NULL CHECK (payout_reference ~ '^P-\d{3}-\d{4}$'),
  model_id uuid NOT NULL REFERENCES model_profiles(id),
  gross_total decimal(10,2) NOT NULL,
  platform_fee_total decimal(10,2) NOT NULL,
  net_total decimal(10,2) NOT NULL,
  currency text NOT NULL,
  listings_count int NOT NULL DEFAULT 0,
  wishes_count int NOT NULL DEFAULT 0,
  bank_name text NOT NULL,
  bank_last4 text NOT NULL,
  bank_account_id uuid REFERENCES user_bank_accounts(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_payouts_model_id ON model_payouts(model_id);
CREATE INDEX idx_model_payouts_status ON model_payouts(status);
CREATE INDEX idx_model_payouts_paid_at ON model_payouts(paid_at) WHERE paid_at IS NOT NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read own payouts" ON model_payouts
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all payouts" ON model_payouts
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 7. model_listing_payments (FKs → listings, profiles, payouts)
--    5-value status enum (includes partial_refund)
-- ============================================
CREATE TABLE model_listing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference text UNIQUE NOT NULL CHECK (payment_reference ~ '^L-\d{3}-\d{4}$'),
  listing_id uuid NOT NULL REFERENCES model_listings(id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE RESTRICT,
  gross_amount decimal(10,2) NOT NULL,
  platform_fee decimal(10,2) NOT NULL,
  net_amount decimal(10,2) NOT NULL,
  currency text NOT NULL,
  package_days int NOT NULL CHECK (package_days IN (30, 60, 90)),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  payer_email text,
  stripe_payment_intent_id text UNIQUE,
  stripe_event_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial_refund')),
  payout_id uuid REFERENCES model_payouts(id),
  refunded_at timestamptz,
  refund_amount decimal(10,2),
  presentment_amount decimal(10,2),
  presentment_currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_amount = platform_fee + net_amount)
);
CREATE INDEX idx_model_listing_payments_listing_id ON model_listing_payments(listing_id);
CREATE INDEX idx_model_listing_payments_model_id ON model_listing_payments(model_id);
CREATE INDEX idx_model_listing_payments_status ON model_listing_payments(status);
CREATE INDEX idx_model_listing_payments_payout_id ON model_listing_payments(payout_id);
CREATE INDEX idx_model_listing_payments_pi ON model_listing_payments(stripe_payment_intent_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_listing_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_listing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read own listing payments" ON model_listing_payments
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all listing payments" ON model_listing_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 8. model_wish_payments (FKs → wishes, profiles, payouts)
--    20 columns including stripe_event_id
-- ============================================
CREATE TABLE model_wish_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference text UNIQUE NOT NULL CHECK (payment_reference ~ '^W-\d{3}-\d{4}$'),
  wish_id uuid NOT NULL REFERENCES model_wishes(id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE RESTRICT,
  gross_amount decimal(10,2) NOT NULL,
  platform_fee decimal(10,2) NOT NULL,
  net_amount decimal(10,2) NOT NULL,
  currency text NOT NULL,
  gifter_email text,
  stripe_payment_intent_id text UNIQUE,
  stripe_event_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial_refund')),
  payout_id uuid REFERENCES model_payouts(id),
  refunded_at timestamptz,
  refund_amount decimal(10,2),
  presentment_amount decimal(10,2),
  presentment_currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_amount = platform_fee + net_amount)
);
CREATE INDEX idx_model_wish_payments_wish_id ON model_wish_payments(wish_id);
CREATE INDEX idx_model_wish_payments_model_id ON model_wish_payments(model_id);
CREATE INDEX idx_model_wish_payments_status ON model_wish_payments(status);
CREATE INDEX idx_model_wish_payments_payout_id ON model_wish_payments(payout_id);
CREATE INDEX idx_model_wish_payments_pi ON model_wish_payments(stripe_payment_intent_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_wish_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_wish_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read completed wish payments for Wall of Love" ON model_wish_payments
  FOR SELECT USING (
    status = 'completed' AND
    model_id IN (SELECT id FROM model_profiles WHERE is_published = true)
  );
CREATE POLICY "Owner read own wish payments" ON model_wish_payments
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all wish payments" ON model_wish_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 9. model_analytics_events (FK → model_profiles, append-only)
--    No updated_at trigger — immutable
-- ============================================
CREATE TABLE model_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'public_page_view',
    'listing_instagram_click',
    'listing_media_click',
    'wish_giftit_click',
    'wish_instagram_click',
    'public_page_share_click',
    'wall_of_love_instagram_click'
  )),
  target_id uuid,
  ip_hash text,
  session_id text,
  user_agent text,
  device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop') OR device_type IS NULL),
  referrer text,
  country text,
  utm_params jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_analytics_events_model_id ON model_analytics_events(model_id);
CREATE INDEX idx_model_analytics_events_event_type ON model_analytics_events(event_type);
CREATE INDEX idx_model_analytics_events_created_at ON model_analytics_events(created_at);
CREATE INDEX idx_model_analytics_events_target_id ON model_analytics_events(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_model_analytics_events_session_id ON model_analytics_events(session_id) WHERE session_id IS NOT NULL;

ALTER TABLE model_analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read own analytics" ON model_analytics_events
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all analytics" ON model_analytics_events
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 10. Seed data — 26 categories
-- ============================================
INSERT INTO model_categories (label, slug, display_order) VALUES
  ('Body contouring', 'body_contouring', 1),
  ('Botox', 'botox', 2),
  ('Brows', 'brows', 3),
  ('Chemical peel', 'chemical_peel', 4),
  ('Cool sculpting', 'cool_sculpting', 5),
  ('Fillers', 'fillers', 6),
  ('Hair', 'hair', 7),
  ('Hair extensions', 'hair_extensions', 8),
  ('Hair removal', 'hair_removal', 9),
  ('Henna', 'henna', 10),
  ('HydraFacial', 'hydrafacial', 11),
  ('IV therapy', 'iv_therapy', 12),
  ('Laser', 'laser', 13),
  ('Lashes', 'lashes', 14),
  ('Lip blush', 'lip_blush', 15),
  ('Makeup', 'makeup', 16),
  ('Massage', 'massage', 17),
  ('Microblading', 'microblading', 18),
  ('Microneedling', 'microneedling', 19),
  ('Nails', 'nails', 20),
  ('PRP', 'prp', 21),
  ('Skin Booster', 'skin_booster', 22),
  ('Teeth whitening', 'teeth_whitening', 23),
  ('Threads', 'threads', 24),
  ('Veneers', 'veneers', 25),
  ('Waxing', 'waxing', 26);


-- ============================================
-- 11. Views — centralized state cleanup
-- ============================================

-- model_wishes_live: auto-cleans expired locks
CREATE VIEW model_wishes_live AS
SELECT
  w.*,
  CASE
    WHEN w.status = 'taken'
      AND w.payment_attempt_expires_at IS NOT NULL
      AND w.payment_attempt_expires_at < now()
      AND NOT EXISTS (
        SELECT 1 FROM model_wish_payments
        WHERE wish_id = w.id AND status IN ('pending', 'completed')
      )
    THEN 'available'
    ELSE w.status
  END AS effective_status
FROM model_wishes w;

GRANT SELECT ON model_wishes_live TO authenticated, anon;

-- model_listings_live: auto-expires passed periods
CREATE VIEW model_listings_live AS
SELECT
  l.*,
  CASE
    WHEN l.status = 'active' AND l.paid_until IS NOT NULL AND l.paid_until < now() THEN 'expired'
    WHEN l.status = 'free_trial' AND l.free_trial_ends_at IS NOT NULL AND l.free_trial_ends_at < now() THEN 'expired'
    ELSE l.status
  END AS effective_status
FROM model_listings l;

GRANT SELECT ON model_listings_live TO authenticated, anon;


-- ============================================
-- 12. RPC functions — atomic wish claim + lock revert
-- ============================================

-- Atomic claim: only succeeds if wish is currently 'available'
CREATE OR REPLACE FUNCTION claim_wish_for_payment(p_wish_id uuid, p_lock_minutes int DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_wish_row record;
BEGIN
  UPDATE model_wishes
  SET status = 'taken',
      payment_attempt_expires_at = now() + (p_lock_minutes || ' minutes')::interval,
      updated_at = now()
  WHERE id = p_wish_id AND status = 'available'
  RETURNING * INTO v_wish_row;

  IF NOT FOUND THEN
    RETURN json_build_object('claimed', false);
  END IF;

  RETURN json_build_object(
    'claimed', true,
    'wish', row_to_json(v_wish_row)
  );
END;
$$;

-- Revert expired locks (call before every wish query — no cron needed)
CREATE OR REPLACE FUNCTION revert_expired_wish_locks()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  WITH reverted AS (
    UPDATE model_wishes
    SET status = 'available',
        payment_attempt_expires_at = NULL,
        updated_at = now()
    WHERE status = 'taken'
      AND payment_attempt_expires_at IS NOT NULL
      AND payment_attempt_expires_at < now()
      AND NOT EXISTS (
        SELECT 1 FROM model_wish_payments
        WHERE wish_id = model_wishes.id
          AND status IN ('pending', 'completed')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM reverted;
  RETURN v_count;
END;
$$;


-- ============================================
-- STORAGE BUCKET: model-media
-- ============================================
-- Create via Supabase Dashboard → Storage → New Bucket:
--   Name: model-media
--   Public: true
--   File size limit: 15 MB (15728640 bytes)
--   Allowed MIME types: image/jpeg, image/png, image/webp,
--                       video/mp4, video/quicktime, video/webm
--
-- RLS policies (create in Dashboard → Storage → Policies):
--   SELECT: public (anyone can view media)
--   INSERT: authenticated users, path must start with auth.uid()
--     USING: (bucket_id = 'model-media')
--     WITH CHECK: (bucket_id = 'model-media' AND (storage.foldername(name))[1] = auth.uid()::text)
--   UPDATE: owner only
--     USING: (bucket_id = 'model-media' AND (storage.foldername(name))[1] = auth.uid()::text)
--   DELETE: owner only
--     USING: (bucket_id = 'model-media' AND (storage.foldername(name))[1] = auth.uid()::text)
-- ============================================
