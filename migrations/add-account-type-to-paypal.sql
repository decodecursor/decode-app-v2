-- Add account_type column to user_paypal_account table
-- This field stores whether the PayPal account is 'personal' or 'business'

ALTER TABLE user_paypal_account
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'personal';

-- Add comment to document the field
COMMENT ON COLUMN user_paypal_account.account_type IS 'PayPal account type: personal or business';

-- Update existing records to have default value (for backward compatibility)
UPDATE user_paypal_account
SET account_type = 'personal'
WHERE account_type IS NULL;
