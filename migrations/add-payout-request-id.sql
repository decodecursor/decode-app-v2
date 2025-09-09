-- Add payout_request_id column to payouts table for internal tracking
-- This provides a user-friendly 10-digit alphanumeric ID for each payout request

ALTER TABLE payouts 
ADD COLUMN IF NOT EXISTS payout_request_id TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payouts_payout_request_id ON payouts(payout_request_id);

-- Add comment to document the purpose
COMMENT ON COLUMN payouts.payout_request_id IS '10-digit alphanumeric ID for internal tracking and customer support';

-- Update existing records with generated IDs (optional - can be done in application)
-- This will be handled in the application layer to ensure proper collision detection