-- Migration: Auction System for MODEL Users
-- Date: 2025-01-02
-- Description: Creates tables for live auction functionality with bidding, pre-authorization, and video recording

-- ============================================================================
-- AUCTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auction ownership
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Auction details
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pricing
    start_price DECIMAL(10, 2) NOT NULL CHECK (start_price > 0),
    current_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    buy_now_price DECIMAL(10, 2) CHECK (buy_now_price IS NULL OR buy_now_price > start_price),

    -- Timing
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL,
    duration INTEGER NOT NULL CHECK (duration IN (30, 60, 180, 1440)), -- minutes: 30min, 1h, 3h, 24h

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'completed', 'cancelled')),

    -- Winner information
    winner_bid_id UUID,
    winner_name VARCHAR(255),
    winner_email VARCHAR(255),

    -- Payment tracking
    payment_captured_at TIMESTAMPTZ,
    payout_status VARCHAR(50) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'transferred', 'failed')),

    -- Metadata
    total_bids INTEGER DEFAULT 0,
    unique_bidders INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_auctions_creator ON auctions(creator_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_end_time ON auctions(end_time) WHERE status IN ('pending', 'active');
CREATE INDEX idx_auctions_winner_bid ON auctions(winner_bid_id);

-- ============================================================================
-- GUEST BIDDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS guest_bidders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Guest information
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,

    -- Stripe integration
    stripe_customer_id VARCHAR(255) UNIQUE,

    -- Statistics
    first_bid_at TIMESTAMPTZ DEFAULT NOW(),
    total_bids INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_guest_bidders_email ON guest_bidders(email);
CREATE INDEX idx_guest_bidders_stripe ON guest_bidders(stripe_customer_id);

-- ============================================================================
-- BIDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auction reference
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,

    -- Bidder information (for leaderboard display)
    bidder_email VARCHAR(255) NOT NULL,
    bidder_name VARCHAR(255) NOT NULL,

    -- User or guest
    is_guest BOOLEAN NOT NULL DEFAULT true,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_bidder_id UUID REFERENCES guest_bidders(id) ON DELETE SET NULL,

    -- Bid details
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),

    -- Stripe pre-authorization
    payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
    payment_intent_status VARCHAR(50) DEFAULT 'requires_capture' CHECK (
        payment_intent_status IN ('requires_capture', 'captured', 'cancelled', 'failed')
    ),

    -- Bid status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'winning', 'outbid', 'captured', 'cancelled', 'failed')
    ),

    -- Security
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bids_auction ON bids(auction_id);
CREATE INDEX idx_bids_email ON bids(bidder_email);
CREATE INDEX idx_bids_user ON bids(user_id);
CREATE INDEX idx_bids_guest ON bids(guest_bidder_id);
CREATE INDEX idx_bids_payment_intent ON bids(payment_intent_id);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_placed_at ON bids(placed_at DESC);

-- Composite index for leaderboard queries
CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount DESC, placed_at DESC);

-- ============================================================================
-- AUCTION VIDEOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS auction_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auction and bid reference
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,

    -- Video storage
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    duration_seconds INTEGER,

    -- Security token for fallback recording page
    recording_token VARCHAR(255) UNIQUE,
    token_expires_at TIMESTAMPTZ,

    -- Recording metadata
    retake_count INTEGER DEFAULT 0 CHECK (retake_count <= 1),
    recording_method VARCHAR(50) CHECK (recording_method IN ('in_page', 'email_link')),

    -- Auto-deletion (7 days)
    expires_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auction_videos_auction ON auction_videos(auction_id);
CREATE INDEX idx_auction_videos_bid ON auction_videos(bid_id);
CREATE INDEX idx_auction_videos_token ON auction_videos(recording_token);
CREATE INDEX idx_auction_videos_expires ON auction_videos(expires_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- AUCTION PAYOUTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS auction_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    model_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,

    -- Payment amounts
    gross_amount DECIMAL(10, 2) NOT NULL CHECK (gross_amount > 0),
    platform_fee DECIMAL(10, 2) NOT NULL CHECK (platform_fee >= 0),
    platform_fee_percentage DECIMAL(5, 2) NOT NULL,
    net_amount DECIMAL(10, 2) NOT NULL CHECK (net_amount > 0),

    -- Payout status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'transferred', 'failed', 'cancelled')
    ),

    -- Transfer details
    transfer_method VARCHAR(50) CHECK (transfer_method IN ('bank_transfer', 'paypal', 'stripe_connect')),
    transferred_at TIMESTAMPTZ,
    transfer_reference VARCHAR(255),

    -- Metadata
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auction_payouts_model ON auction_payouts(model_id);
CREATE INDEX idx_auction_payouts_auction ON auction_payouts(auction_id);
CREATE INDEX idx_auction_payouts_status ON auction_payouts(status);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_bidders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_payouts ENABLE ROW LEVEL SECURITY;

-- AUCTIONS POLICIES
-- Anyone can view active auctions
CREATE POLICY "Anyone can view active auctions"
    ON auctions FOR SELECT
    USING (status IN ('pending', 'active', 'ended'));

-- Only MODEL users can create auctions
CREATE POLICY "MODEL users can create auctions"
    ON auctions FOR INSERT
    WITH CHECK (
        auth.uid() = creator_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'Beauty Model'
        )
    );

-- Creators can update their own auctions
CREATE POLICY "Creators can update own auctions"
    ON auctions FOR UPDATE
    USING (auth.uid() = creator_id);

-- GUEST BIDDERS POLICIES
-- Guest bidders can view their own profile
CREATE POLICY "Guest bidders view own profile"
    ON guest_bidders FOR SELECT
    USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Service role can manage guest bidders
CREATE POLICY "Service role manages guest bidders"
    ON guest_bidders FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- BIDS POLICIES
-- Anyone can view bids for leaderboard (bidder names visible, emails hidden)
CREATE POLICY "Anyone can view bids"
    ON bids FOR SELECT
    USING (true);

-- Service role and authenticated users can create bids
CREATE POLICY "Users can create bids"
    ON bids FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        auth.uid() = user_id
    );

-- AUCTION VIDEOS POLICIES
-- Only auction creator can view videos
CREATE POLICY "Creators can view auction videos"
    ON auction_videos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auctions
            WHERE auctions.id = auction_videos.auction_id
            AND auctions.creator_id = auth.uid()
        )
    );

-- Winners can upload videos
CREATE POLICY "Winners can upload videos"
    ON auction_videos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM bids
            WHERE bids.id = auction_videos.bid_id
            AND (bids.user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role')
        )
    );

-- AUCTION PAYOUTS POLICIES
-- MODEL users can view their own payouts
CREATE POLICY "Models can view own payouts"
    ON auction_payouts FOR SELECT
    USING (auth.uid() = model_id);

-- Only admins can manage payouts
CREATE POLICY "Admins manage payouts"
    ON auction_payouts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'Admin'
        )
    );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guest_bidders_updated_at BEFORE UPDATE ON guest_bidders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON bids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_videos_updated_at BEFORE UPDATE ON auction_videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_payouts_updated_at BEFORE UPDATE ON auction_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS FOR AUCTION LOGIC
-- ============================================================================

-- Function to update auction statistics when a bid is placed
CREATE OR REPLACE FUNCTION update_auction_stats_on_bid()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auctions
    SET
        total_bids = total_bids + 1,
        current_price = NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.auction_id;

    -- Update unique bidders count
    UPDATE auctions
    SET unique_bidders = (
        SELECT COUNT(DISTINCT bidder_email)
        FROM bids
        WHERE auction_id = NEW.auction_id
    )
    WHERE id = NEW.auction_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_auction_stats
    AFTER INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION update_auction_stats_on_bid();

-- Function to update guest bidder statistics
CREATE OR REPLACE FUNCTION update_guest_bidder_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_guest AND NEW.guest_bidder_id IS NOT NULL THEN
        UPDATE guest_bidders
        SET
            total_bids = total_bids + 1,
            updated_at = NOW()
        WHERE id = NEW.guest_bidder_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_guest_stats
    AFTER INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_bidder_stats();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE auctions IS 'Live auctions created by MODEL users with preset durations';
COMMENT ON TABLE guest_bidders IS 'Guest bidder profiles for users who bid without signing up';
COMMENT ON TABLE bids IS 'All bids placed on auctions with Stripe pre-authorization tracking';
COMMENT ON TABLE auction_videos IS 'Winner video recordings with 7-day auto-deletion';
COMMENT ON TABLE auction_payouts IS 'Payout tracking for MODEL user earnings from auctions';

COMMENT ON COLUMN bids.bidder_name IS 'Displayed on public leaderboard';
COMMENT ON COLUMN bids.bidder_email IS 'Private - used for notifications and winner contact';
COMMENT ON COLUMN bids.payment_intent_id IS 'Stripe PaymentIntent ID for pre-authorization';
COMMENT ON COLUMN auctions.duration IS 'Duration in minutes: 30, 60, 180, or 1440';
