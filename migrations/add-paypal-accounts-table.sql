-- Add PayPal accounts table for payout methods
-- This provides professional PayPal account management for users

CREATE TABLE IF NOT EXISTS user_paypal_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    paypal_account_id TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_user_id ON user_paypal_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_email ON user_paypal_accounts(email);
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_status ON user_paypal_accounts(status);

-- Enable Row Level Security (RLS)
ALTER TABLE user_paypal_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for PayPal accounts table
CREATE POLICY "Users can view their own PayPal accounts" ON user_paypal_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PayPal accounts" ON user_paypal_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PayPal accounts" ON user_paypal_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PayPal accounts" ON user_paypal_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments to document the table structure
COMMENT ON TABLE user_paypal_accounts IS 'PayPal account information for user payouts';
COMMENT ON COLUMN user_paypal_accounts.email IS 'PayPal account email address';
COMMENT ON COLUMN user_paypal_accounts.paypal_account_id IS 'PayPal API account identifier';
COMMENT ON COLUMN user_paypal_accounts.is_verified IS 'Whether the PayPal account has been verified';
COMMENT ON COLUMN user_paypal_accounts.is_primary IS 'Whether this is the primary PayPal account';
COMMENT ON COLUMN user_paypal_accounts.status IS 'Account status: pending, active, suspended, etc.';