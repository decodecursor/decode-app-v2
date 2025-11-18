-- Migration: Add EventBridge Scheduler ID to Auctions
-- Date: 2025-01-18
-- Purpose: Store AWS EventBridge Scheduler event ID for precise auction closing

-- Add scheduler_event_id column to auctions table
ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS scheduler_event_id VARCHAR(255);

-- Create index for faster lookups by scheduler_event_id
CREATE INDEX IF NOT EXISTS idx_auctions_scheduler_event
ON auctions(scheduler_event_id);

-- Add comment to column for documentation
COMMENT ON COLUMN auctions.scheduler_event_id IS
'AWS EventBridge Scheduler event name/ID for automatic auction closing at exact end_time';
