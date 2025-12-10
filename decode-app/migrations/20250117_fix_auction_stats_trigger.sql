-- ============================================================================
-- Fix Auction Stats Trigger to Only Count Confirmed/Paid Bids
-- This migration updates the trigger to exclude pending bids from statistics
-- ============================================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_update_auction_stats ON bids;

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
            current_price = GREATEST(
                current_price,
                (
                    SELECT COALESCE(MAX(amount), current_price)
                    FROM bids
                    WHERE auction_id = NEW.auction_id
                    AND status IN ('winning', 'outbid', 'captured')
                )
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
-- IMPORTANT: Run this in Supabase SQL Editor
-- This ensures auction stats only reflect paid/confirmed bids
-- ============================================================================
