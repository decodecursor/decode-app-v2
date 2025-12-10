-- Migration script for payment_links table
-- Adds client_name column and renames amount_usd to amount_aed

-- Add client_name column to store client information
ALTER TABLE payment_links ADD COLUMN client_name TEXT;

-- Rename amount_usd column to amount_aed to reflect currency change
ALTER TABLE payment_links RENAME COLUMN amount_usd TO amount_aed;

-- Optional: Add comment to document the change
COMMENT ON COLUMN payment_links.amount_aed IS 'Payment amount in AED (Arab Emirates Dirham)';
COMMENT ON COLUMN payment_links.client_name IS 'Name of the client for this payment link';