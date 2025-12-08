-- Migration: Add 12-hour, 2-day and 3-day auction duration options
-- Date: 2025-12-08
-- Description: Updates the CHECK constraint to allow 720 (12 hours), 2880 (2 days) and 4320 (3 days) durations

ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_duration_check;

ALTER TABLE auctions ADD CONSTRAINT auctions_duration_check
    CHECK (duration IN (5, 30, 60, 180, 720, 1440, 2880, 4320));

COMMENT ON COLUMN auctions.duration IS 'Duration in minutes: 5, 30, 60, 180, 720, 1440, 2880, or 4320';
