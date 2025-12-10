-- Fix RLS policies for user_bank_accounts table
-- Remove the problematic text casting and use direct UUID comparison

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own bank accounts" ON user_bank_accounts;
DROP POLICY IF EXISTS "Users can insert own bank accounts" ON user_bank_accounts;
DROP POLICY IF EXISTS "Users can update own bank accounts" ON user_bank_accounts;
DROP POLICY IF EXISTS "Users can delete own bank accounts" ON user_bank_accounts;

-- Create new policies with proper UUID comparison
CREATE POLICY "Users can view own bank accounts" ON user_bank_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts" ON user_bank_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts" ON user_bank_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts" ON user_bank_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Verify RLS is enabled
ALTER TABLE user_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON TABLE user_bank_accounts IS 'Bank account information for user payouts - RLS policies updated for proper UUID comparison';