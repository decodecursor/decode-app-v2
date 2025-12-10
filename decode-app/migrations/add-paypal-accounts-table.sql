-- Add PayPal accounts table for payout methods
-- This provides professional PayPal account management for users

CREATE TABLE IF NOT EXISTS user_paypal_account (
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
CREATE INDEX IF NOT EXISTS idx_paypal_account_user_id ON user_paypal_account(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_account_email ON user_paypal_account(email);
CREATE INDEX IF NOT EXISTS idx_paypal_account_status ON user_paypal_account(status);

-- Enable Row Level Security (RLS)
ALTER TABLE user_paypal_account ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for PayPal account table
CREATE POLICY "Users can view their own PayPal account" ON user_paypal_account
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PayPal account" ON user_paypal_account
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PayPal account" ON user_paypal_account
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PayPal account" ON user_paypal_account
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments to document the table structure
COMMENT ON TABLE user_paypal_account IS 'PayPal account information for user payouts';
COMMENT ON COLUMN user_paypal_account.email IS 'PayPal account email address';
COMMENT ON COLUMN user_paypal_account.paypal_account_id IS 'PayPal API account identifier';
COMMENT ON COLUMN user_paypal_account.is_verified IS 'Whether the PayPal account has been verified';
COMMENT ON COLUMN user_paypal_account.is_primary IS 'Whether this is the primary PayPal account';
COMMENT ON COLUMN user_paypal_account.status IS 'Account status: pending, active, suspended, etc.';