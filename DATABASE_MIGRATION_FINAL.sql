-- =====================================
-- DECODE Beauty Platform - Final Database Migration
-- =====================================
-- This script fixes the currency field mismatch between code and database

-- First, apply the complete setup if tables don't exist
-- If tables exist, skip to the ALTER statements

-- 1. ALTER PAYMENT_LINKS TABLE to use amount_aed (if needed)
-- =====================================
DO $$
BEGIN
    -- Check if amount_usd column exists and rename to amount_aed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'payment_links' 
               AND column_name = 'amount_usd') THEN
        
        ALTER TABLE payment_links RENAME COLUMN amount_usd TO amount_aed;
        COMMENT ON COLUMN payment_links.amount_aed IS 'Payment amount in AED (Arab Emirates Dirham)';
    END IF;
    
    -- Add client_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_links' 
                   AND column_name = 'client_name') THEN
        
        ALTER TABLE payment_links ADD COLUMN client_name TEXT;
        COMMENT ON COLUMN payment_links.client_name IS 'Name of the client for this payment link';
    END IF;
END $$;

-- 2. ALTER TRANSACTIONS TABLE to use amount_aed (if needed)
-- =====================================
DO $$
BEGIN
    -- Check if amount_usd column exists and rename to amount_aed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'transactions' 
               AND column_name = 'amount_usd') THEN
        
        ALTER TABLE transactions RENAME COLUMN amount_usd TO amount_aed;
        COMMENT ON COLUMN transactions.amount_aed IS 'Transaction amount in AED (Arab Emirates Dirham)';
    END IF;
END $$;

-- 3. ADD WALLET FIELDS TO USERS TABLE
-- =====================================
DO $$
BEGIN
    -- Add crossmint_wallet_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'crossmint_wallet_id') THEN
        
        ALTER TABLE users ADD COLUMN crossmint_wallet_id TEXT;
        COMMENT ON COLUMN users.crossmint_wallet_id IS 'Crossmint wallet ID for cryptocurrency transactions';
    END IF;
    
    -- Add wallet_created_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'wallet_created_at') THEN
        
        ALTER TABLE users ADD COLUMN wallet_created_at TIMESTAMPTZ;
        COMMENT ON COLUMN users.wallet_created_at IS 'Timestamp when wallet was created';
    END IF;
END $$;

-- 4. CREATE INDEXES FOR WALLET FIELDS
-- =====================================
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_crossmint_wallet_id ON users(crossmint_wallet_id);

-- 5. UPDATE TABLE COMMENTS
-- =====================================
COMMENT ON TABLE users IS 'User profiles with role-based access, wallet integration for beauty professionals and models';
COMMENT ON TABLE payment_links IS 'Payment links created by users with AED currency support, expiration and linking functionality';
COMMENT ON TABLE transactions IS 'Transaction tracking with AED currency, webhook support, multiple payment processors, and detailed status tracking';

-- =====================================
-- MIGRATION COMPLETE!
-- =====================================
-- Database schema is now aligned with application code
-- All tables use amount_aed for currency consistency
-- Wallet fields added to users table for Crossmint integration