-- Add preferred_payout_method field to users table
-- This field stores which payout method the user has selected as their default

-- Add the new column
ALTER TABLE users
ADD COLUMN preferred_payout_method VARCHAR(20) CHECK (preferred_payout_method IN ('bank_account', 'paypal'));

-- Add comment for documentation
COMMENT ON COLUMN users.preferred_payout_method IS 'User selected preferred payout method: bank_account, paypal, or null';

-- Optional: Set default for existing users who have bank accounts
-- UPDATE users
-- SET preferred_payout_method = 'bank_account'
-- WHERE id IN (
--   SELECT DISTINCT user_id
--   FROM user_bank_accounts
--   WHERE is_primary = true
-- );

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'preferred_payout_method';