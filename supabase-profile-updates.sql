-- =====================================
-- DECODE Beauty Platform - Profile Updates
-- =====================================
-- This script adds profile management fields to the users table
-- and creates bank account management tables

-- 1. ADD PROFILE FIELDS TO USERS TABLE
-- =====================================
DO $$
BEGIN
    -- Add company_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'company_name') THEN
        
        ALTER TABLE users ADD COLUMN company_name TEXT;
        COMMENT ON COLUMN users.company_name IS 'Company/business name for the user (replaces email in displays)';
    END IF;
    
    -- Add profile_photo_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'profile_photo_url') THEN
        
        ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
        COMMENT ON COLUMN users.profile_photo_url IS 'URL to user profile photo stored in Supabase storage';
    END IF;
    
    -- Add email_verified column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'email_verified') THEN
        
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN users.email_verified IS 'Whether the user email has been verified';
    END IF;
    
    -- Add pending_email column if it doesn't exist (for email change verification)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'pending_email') THEN
        
        ALTER TABLE users ADD COLUMN pending_email TEXT;
        COMMENT ON COLUMN users.pending_email IS 'New email address pending verification';
    END IF;
    
    -- Add email_verification_token column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'email_verification_token') THEN
        
        ALTER TABLE users ADD COLUMN email_verification_token TEXT;
        COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification process';
    END IF;
    
    -- Add verification_token_expires column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'verification_token_expires') THEN
        
        ALTER TABLE users ADD COLUMN verification_token_expires TIMESTAMPTZ;
        COMMENT ON COLUMN users.verification_token_expires IS 'When the email verification token expires';
    END IF;
END $$;

-- 2. CREATE BANK ACCOUNTS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS user_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Bank Account Information
    bank_name TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    routing_number TEXT,
    iban TEXT,
    swift_code TEXT,
    
    -- Account Status
    is_verified BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'suspended')),
    
    -- Verification Information
    verification_method TEXT, -- 'micro_deposits', 'instant', 'manual'
    verification_data JSONB, -- Store verification-specific data
    verified_at TIMESTAMPTZ,
    
    -- External Service Integration
    stripe_account_id TEXT, -- For Stripe Connect integration
    external_account_id TEXT, -- For other banking services
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id ON user_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_primary ON user_bank_accounts(user_id, is_primary) WHERE is_primary = TRUE;

-- Enable Row Level Security
ALTER TABLE user_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bank accounts
CREATE POLICY "Users can view own bank accounts" ON user_bank_accounts
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own bank accounts" ON user_bank_accounts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own bank accounts" ON user_bank_accounts
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own bank accounts" ON user_bank_accounts
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- 3. CREATE EMAIL VERIFICATION LOGS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS email_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    email_type TEXT NOT NULL CHECK (email_type IN ('email_change', 'email_verification')),
    old_email TEXT,
    new_email TEXT NOT NULL,
    verification_token TEXT NOT NULL,
    
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'verified', 'expired', 'failed')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    metadata JSONB
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_logs_user_id ON email_verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_logs_token ON email_verification_logs(verification_token);

-- Enable RLS
ALTER TABLE email_verification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email verification logs
CREATE POLICY "Users can view own email verification logs" ON email_verification_logs
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- 4. CREATE FUNCTION TO UPDATE BANK ACCOUNT UPDATED_AT
-- =====================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for bank accounts table
DROP TRIGGER IF EXISTS update_user_bank_accounts_updated_at ON user_bank_accounts;
CREATE TRIGGER update_user_bank_accounts_updated_at
    BEFORE UPDATE ON user_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. CREATE FUNCTION TO ENSURE ONLY ONE PRIMARY BANK ACCOUNT
-- =====================================
CREATE OR REPLACE FUNCTION ensure_single_primary_bank_account()
RETURNS TRIGGER AS $$
BEGIN
    -- If this account is being set as primary
    IF NEW.is_primary = TRUE THEN
        -- Set all other accounts for this user as non-primary
        UPDATE user_bank_accounts 
        SET is_primary = FALSE 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for primary bank account constraint
DROP TRIGGER IF EXISTS ensure_single_primary_bank_account_trigger ON user_bank_accounts;
CREATE TRIGGER ensure_single_primary_bank_account_trigger
    BEFORE INSERT OR UPDATE ON user_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_bank_account();

COMMENT ON TABLE user_bank_accounts IS 'Stores user bank account information for payments and transfers';
COMMENT ON TABLE email_verification_logs IS 'Logs email verification attempts and status changes';