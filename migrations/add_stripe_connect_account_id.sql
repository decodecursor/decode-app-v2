-- Add Stripe Connect account ID to users table
-- This stores the Stripe Connect account ID for each user to manage bank account onboarding

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255) NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id 
ON users(stripe_connect_account_id);

-- Add comment for documentation
COMMENT ON COLUMN users.stripe_connect_account_id IS 'Stripe Connect account ID for bank account management and payments';