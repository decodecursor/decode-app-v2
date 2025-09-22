-- Add payout_method column to payouts table
-- Run this SQL in your Supabase SQL Editor

-- Add the payout_method column to track which method was used for each payout
ALTER TABLE payouts
ADD COLUMN payout_method VARCHAR(20) CHECK (payout_method IN ('bank_account', 'paypal', 'stripe_connect'));

-- Add comment for documentation
COMMENT ON COLUMN payouts.payout_method IS 'Method used for payout: bank_account, paypal, stripe_connect, or null for legacy records';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payouts' AND column_name = 'payout_method';

-- Success message
SELECT 'Added payout_method column to payouts table successfully!' as message;