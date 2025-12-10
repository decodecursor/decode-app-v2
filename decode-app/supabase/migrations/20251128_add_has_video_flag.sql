-- Add has_video column to auctions table for real-time UI updates
-- This allows components to react when a winner uploads a video without
-- needing to subscribe to the auction_videos table

-- Add has_video column to auctions table
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;

-- Add partial index for performance (only index TRUE values)
-- This helps with queries that filter by has_video=true
CREATE INDEX IF NOT EXISTS idx_auctions_has_video ON auctions(has_video) WHERE has_video = TRUE;

-- Backfill existing data: mark auctions that already have videos
-- This ensures existing auctions with videos show the correct state
UPDATE auctions
SET has_video = TRUE
WHERE id IN (
  SELECT DISTINCT auction_id
  FROM auction_videos
  WHERE file_url IS NOT NULL
    AND file_url != ''
    AND deleted_at IS NULL
);
