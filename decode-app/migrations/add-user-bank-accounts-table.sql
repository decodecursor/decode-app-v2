-- Add user bank account table for payout methods
-- This provides bank account management for users

CREATE TABLE IF NOT EXISTS user_bank_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    iban_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    beneficiary_name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bank_account_user_id ON user_bank_account(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_iban ON user_bank_account(iban_number);
CREATE INDEX IF NOT EXISTS idx_bank_account_status ON user_bank_account(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_account_user_primary 
    ON user_bank_account(user_id) WHERE is_primary = true;

-- Enable Row Level Security (RLS)
ALTER TABLE user_bank_account ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bank account table
CREATE POLICY "Users can view their own bank account" ON user_bank_account
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank account" ON user_bank_account
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank account" ON user_bank_account
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank account" ON user_bank_account
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments to document the table structure
COMMENT ON TABLE user_bank_account IS 'Bank account information for user payouts';
COMMENT ON COLUMN user_bank_account.iban_number IS 'International Bank Account Number';
COMMENT ON COLUMN user_bank_account.bank_name IS 'Name of the bank';
COMMENT ON COLUMN user_bank_account.beneficiary_name IS 'Account holder name';
COMMENT ON COLUMN user_bank_account.is_verified IS 'Whether the bank account has been verified';
COMMENT ON COLUMN user_bank_account.is_primary IS 'Whether this is the primary bank account';
COMMENT ON COLUMN user_bank_account.status IS 'Account status: pending, active, suspended, etc.';