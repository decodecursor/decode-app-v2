-- Migration: Add 5-minute auction duration option
-- Date: 2025-01-18
-- Description: Updates the CHECK constraint on auctions.duration to allow 5-minute auctions for quick testing

-- Drop the existing CHECK constraint
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_duration_check;

-- Add new CHECK constraint with 5-minute option
ALTER TABLE auctions ADD CONSTRAINT auctions_duration_check
    CHECK (duration IN (5, 30, 60, 180, 1440));

-- Update the column comment
COMMENT ON COLUMN auctions.duration IS 'Duration in minutes: 5, 30, 60, 180, or 1440';
