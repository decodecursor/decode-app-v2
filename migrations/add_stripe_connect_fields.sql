-- Migration: Add Stripe Connect fields to users table
-- This migration adds fields needed for Stripe Connect integration

-- Add Stripe Connect account fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_connect_status VARCHAR(50) DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_capabilities JSONB,
ADD COLUMN IF NOT EXISTS stripe_requirements JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id ON users(stripe_connect_account_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_status ON users(stripe_connect_status);

-- Add comments for documentation
COMMENT ON COLUMN users.stripe_connect_account_id IS 'Stripe Connect Express account ID';
COMMENT ON COLUMN users.stripe_connect_status IS 'Current status: not_connected, pending, active, restricted, rejected';
COMMENT ON COLUMN users.stripe_onboarding_completed IS 'Whether the user has completed Stripe onboarding';
COMMENT ON COLUMN users.stripe_payouts_enabled IS 'Whether payouts are enabled for this account';
COMMENT ON COLUMN users.stripe_charges_enabled IS 'Whether charges are enabled for this account';
COMMENT ON COLUMN users.stripe_details_submitted IS 'Whether all required details have been submitted';
COMMENT ON COLUMN users.stripe_capabilities IS 'JSON object containing capabilities status';
COMMENT ON COLUMN users.stripe_requirements IS 'JSON object containing current requirements';

-- Create transfers table for tracking money transfers
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES transactions(id),
    user_id UUID REFERENCES users(id),
    amount_aed DECIMAL(10, 2) NOT NULL,
    stripe_transfer_id VARCHAR(255) UNIQUE,
    stripe_connect_account_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create payouts table for tracking weekly payouts
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount_aed DECIMAL(10, 2) NOT NULL,
    stripe_payout_id VARCHAR(255) UNIQUE,
    stripe_connect_account_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    period_start DATE,
    period_end DATE,
    scheduled_for DATE,
    paid_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for transfers and payouts
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_scheduled_for ON payouts(scheduled_for);

-- Enable RLS
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for transfers
CREATE POLICY "Users can view own transfers" ON transfers
    FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for payouts
CREATE POLICY "Users can view own payouts" ON payouts
    FOR SELECT USING (auth.uid() = user_id);