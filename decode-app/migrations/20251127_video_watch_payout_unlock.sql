-- Migration: Add video watch tracking for payout unlock
-- Date: 2025-11-27
-- Purpose: Track when model watches winner video to completion, which unlocks payout

-- Add columns to auction_videos table
ALTER TABLE auction_videos
  ADD COLUMN IF NOT EXISTS watched_to_end_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payout_unlocked_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient payout unlock status queries
CREATE INDEX IF NOT EXISTS idx_auction_videos_payout_unlock
  ON auction_videos(auction_id, payout_unlocked_at);

-- Comments for documentation
COMMENT ON COLUMN auction_videos.watched_to_end_at IS 'Timestamp when model watched video to completion (NULL = not watched)';
COMMENT ON COLUMN auction_videos.payout_unlocked_at IS 'Timestamp when payout was unlocked (via watch OR 24hr auto-unlock if no video uploaded)';

-- Column semantics:
-- | watched_to_end_at | payout_unlocked_at | Meaning                              |
-- |-------------------|--------------------|------------------------------------- |
-- | NULL              | NULL               | Video exists, not watched - LOCKED   |
-- | SET               | SET                | Video watched to end - UNLOCKED      |
-- | NULL              | SET                | No video uploaded, 24hr passed - AUTO-UNLOCKED |
