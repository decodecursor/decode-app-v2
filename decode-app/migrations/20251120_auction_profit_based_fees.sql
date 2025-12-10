-- Migration: Rename auction columns and implement profit-based fee model
-- Date: 2025-11-20
-- Purpose: Rename columns for clarity and add profit tracking for 25% profit-based fee calculation

-- ============================================================================
-- RENAME COLUMNS IN AUCTIONS TABLE
-- ============================================================================

-- Rename pricing columns for clarity
ALTER TABLE auctions
RENAME COLUMN start_price TO auction_start_price;

ALTER TABLE auctions
RENAME COLUMN current_price TO auction_current_price;

ALTER TABLE auctions
RENAME COLUMN buy_now_price TO auction_buy_now_price;

-- ============================================================================
-- RENAME COLUMNS IN AUCTION_PAYOUTS TABLE
-- ============================================================================

-- Rename amount columns for clarity
ALTER TABLE auction_payouts
RENAME COLUMN gross_amount TO auction_winning_amount;

ALTER TABLE auction_payouts
RENAME COLUMN platform_fee TO auction_profit_decode_amount;

ALTER TABLE auction_payouts
RENAME COLUMN platform_fee_percentage TO auction_profit_decode_percentage;

ALTER TABLE auction_payouts
RENAME COLUMN net_amount TO auction_profit_model_amount;

-- Add profit tracking column
ALTER TABLE auction_payouts
ADD COLUMN IF NOT EXISTS auction_profit_amount DECIMAL(10, 2) DEFAULT 0
CHECK (auction_profit_amount >= 0);

-- ============================================================================
-- RENAME COLUMNS IN BIDS TABLE
-- ============================================================================

-- Rename amount column for clarity
ALTER TABLE bids
RENAME COLUMN amount TO bid_amount;

-- ============================================================================
-- UPDATE INDEXES (Drop and recreate with new column names)
-- ============================================================================

-- Note: Composite indexes need to be recreated with new column names
-- The idx_bids_auction_amount index references the renamed column

DROP INDEX IF EXISTS idx_bids_auction_amount;

CREATE INDEX idx_bids_auction_amount
ON bids(auction_id, bid_amount DESC, placed_at DESC);

-- ============================================================================
-- UPDATE TRIGGERS TO USE NEW COLUMN NAMES
-- ============================================================================

-- Drop existing trigger and recreate with new column names
DROP TRIGGER IF EXISTS trigger_update_auction_stats ON bids;

-- Recreate function with new column name
CREATE OR REPLACE FUNCTION update_auction_stats_on_bid()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auctions
    SET
        total_bids = total_bids + 1,
        auction_current_price = NEW.bid_amount,
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

-- Recreate trigger
CREATE TRIGGER trigger_update_auction_stats
    AFTER INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION update_auction_stats_on_bid();

-- ============================================================================
-- UPDATE CHECK CONSTRAINTS WITH NEW COLUMN NAMES
-- ============================================================================

-- Drop old check constraint and create new one with renamed column
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_buy_now_price_check;

ALTER TABLE auctions ADD CONSTRAINT auctions_buy_now_price_check
CHECK (auction_buy_now_price IS NULL OR auction_buy_now_price > auction_start_price);

-- Drop old check constraint and create new one with renamed column
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_start_price_check;

ALTER TABLE auctions ADD CONSTRAINT auctions_start_price_check
CHECK (auction_start_price > 0);

-- Drop old check constraint and create new one with renamed column
ALTER TABLE auction_payouts DROP CONSTRAINT IF EXISTS auction_payouts_gross_amount_check;

ALTER TABLE auction_payouts ADD CONSTRAINT auction_payouts_winning_amount_check
CHECK (auction_winning_amount > 0);

-- Drop old check constraint and create new one with renamed column
ALTER TABLE auction_payouts DROP CONSTRAINT IF EXISTS auction_payouts_platform_fee_check;

ALTER TABLE auction_payouts ADD CONSTRAINT auction_payouts_decode_fee_check
CHECK (auction_profit_decode_amount >= 0);

-- Drop old check constraint and create new one with renamed column
ALTER TABLE auction_payouts DROP CONSTRAINT IF EXISTS auction_payouts_net_amount_check;

ALTER TABLE auction_payouts ADD CONSTRAINT auction_payouts_model_amount_check
CHECK (auction_profit_model_amount > 0);

-- Drop old check constraint and create new one with renamed column
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_check;

ALTER TABLE bids ADD CONSTRAINT bids_amount_check
CHECK (bid_amount > 0);

-- ============================================================================
-- UPDATE COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN auctions.auction_start_price IS
'Starting price/base service cost set by MODEL (profit calculation base)';

COMMENT ON COLUMN auctions.auction_current_price IS
'Current highest bid amount';

COMMENT ON COLUMN auctions.auction_buy_now_price IS
'Optional buy now price to end auction immediately';

COMMENT ON COLUMN auction_payouts.auction_winning_amount IS
'Total winning bid amount paid by bidder';

COMMENT ON COLUMN auction_payouts.auction_profit_decode_amount IS
'DECODE platform fee (25% of profit)';

COMMENT ON COLUMN auction_payouts.auction_profit_decode_percentage IS
'Platform fee percentage used (25)';

COMMENT ON COLUMN auction_payouts.auction_profit_model_amount IS
'Net amount MODEL receives after platform fee';

COMMENT ON COLUMN auction_payouts.auction_profit_amount IS
'Calculated profit (auction_winning_amount - auction_start_price)';

COMMENT ON COLUMN bids.bid_amount IS
'Bid amount in AED';
