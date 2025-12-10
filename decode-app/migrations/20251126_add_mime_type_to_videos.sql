-- Migration: Add MIME type tracking to auction videos
-- Date: 2025-11-26
-- Description: Adds mime_type column to store full MIME type including codecs for proper video playback

-- Add mime_type column to auction_videos table
ALTER TABLE auction_videos ADD COLUMN mime_type VARCHAR(255);

-- Add index for performance
CREATE INDEX idx_auction_videos_mime_type ON auction_videos(mime_type);

-- Add comment documenting the column
COMMENT ON COLUMN auction_videos.mime_type IS 'Full MIME type including codecs (e.g., video/webm;codecs=vp9,opus)';
