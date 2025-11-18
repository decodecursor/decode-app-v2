-- Migration: Add UNIQUE constraint to auction_videos
-- Date: 2025-01-18
-- Description: Ensures only one video per (auction_id, bid_id) pair to prevent duplicate uploads

-- Add UNIQUE constraint on (auction_id, bid_id)
-- This ensures each winner can only have one video record per auction
ALTER TABLE auction_videos
  ADD CONSTRAINT auction_videos_auction_bid_unique UNIQUE (auction_id, bid_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT auction_videos_auction_bid_unique ON auction_videos IS 'Ensures only one video per auction winner (one video per auction_id + bid_id combination)';
