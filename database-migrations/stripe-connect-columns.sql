-- Stripe Connect Database Migration
-- Run this SQL in your Supabase SQL Editor to add Stripe Connect columns

-- Add Stripe Connect columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_capabilities JSONB,
ADD COLUMN IF NOT EXISTS stripe_requirements JSONB;

-- Add is_verified column to user_bank_accounts table
ALTER TABLE user_bank_accounts 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Create transfers table for Stripe transfer tracking
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id TEXT NOT NULL,
    amount_aed DECIMAL(10,2) NOT NULL,
    stripe_connect_account_id TEXT NOT NULL,
    stripe_transfer_id TEXT,
    status TEXT DEFAULT 'pending',
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payouts table for payout tracking
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payout_id TEXT NOT NULL UNIQUE,
    amount_aed DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'AED',
    status TEXT DEFAULT 'pending',
    arrival_date TIMESTAMP WITH TIME ZONE,
    payment_id TEXT,
    metadata JSONB,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id ON users(stripe_connect_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_payment_id ON transfers(payment_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_stripe_payout_id ON payouts(stripe_payout_id);

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for transfers table
CREATE POLICY "Users can view their own transfers" ON transfers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transfers" ON transfers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for payouts table  
CREATE POLICY "Users can view their own payouts" ON payouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payouts" ON payouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON transfers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payouts TO anon, authenticated;

-- Success message
SELECT 'Stripe Connect database migration completed successfully!' as message;