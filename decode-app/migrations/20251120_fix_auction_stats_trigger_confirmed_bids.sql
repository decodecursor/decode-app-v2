-- ============================================================================
-- Fix Auction Stats Trigger to Only Count Confirmed/Paid Bids
-- This restores the January 17 fix that was overwritten in the November 20 migration
-- ============================================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_update_auction_stats ON bids;
DROP TRIGGER IF EXISTS trigger_update_auction_stats_insert ON bids;
DROP TRIGGER IF EXISTS trigger_update_auction_stats_update ON bids;

-- Update the function to only count confirmed bids
CREATE OR REPLACE FUNCTION update_auction_stats_on_bid()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stats for confirmed bids (not pending)
    IF NEW.status IN ('winning', 'outbid', 'captured') THEN
        -- Recalculate all stats based on confirmed bids only
        UPDATE auctions
        SET
            total_bids = (
                SELECT COUNT(*)
                FROM bids
                WHERE auction_id = NEW.auction_id
                AND status IN ('winning', 'outbid', 'captured')
            ),
            auction_current_price = (
                SELECT COALESCE(MAX(bid_amount), auction_start_price)
                FROM bids
                WHERE auction_id = NEW.auction_id
                AND status IN ('winning', 'outbid', 'captured')
            ),
            unique_bidders = (
                SELECT COUNT(DISTINCT bidder_email)
                FROM bids
                WHERE auction_id = NEW.auction_id
                AND status IN ('winning', 'outbid', 'captured')
            ),
            updated_at = NOW()
        WHERE id = NEW.auction_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT (pending bids won't affect stats)
CREATE TRIGGER trigger_update_auction_stats_insert
    AFTER INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION update_auction_stats_on_bid();

-- Create trigger for UPDATE (when bid status changes to confirmed)
CREATE TRIGGER trigger_update_auction_stats_update
    AFTER UPDATE ON bids
    FOR EACH ROW
    WHEN (OLD.status != NEW.status)
    EXECUTE FUNCTION update_auction_stats_on_bid();

-- ============================================================================
-- IMPORTANT: After running this migration:
-- 1. Existing auctions may have incorrect auction_current_price values
-- 2. Run this query to fix them:
--
-- UPDATE auctions
-- SET auction_current_price = (
--     SELECT COALESCE(MAX(bid_amount), auction_start_price)
--     FROM bids
--     WHERE bids.auction_id = auctions.id
--     AND bids.status IN ('winning', 'outbid', 'captured')
-- )
-- WHERE status IN ('active', 'ended');
-- ============================================================================
