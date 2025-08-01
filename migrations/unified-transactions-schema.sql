-- Unified Transaction Schema Migration for Stripe Payment Status Tracking
-- This migration creates a comprehensive transaction table that supports proper Stripe integration

-- Drop existing table if it exists to ensure clean migration
DROP TABLE IF EXISTS transactions CASCADE;

-- Create the unified transactions table with all required fields for Stripe integration
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core relationship fields
    payment_link_id UUID NOT NULL REFERENCES payment_links(id) ON DELETE CASCADE,
    
    -- Customer information
    buyer_email TEXT,
    buyer_name TEXT,
    
    -- Amount fields - support both AED and USD
    amount_aed DECIMAL(10,2) NOT NULL,
    amount_usd DECIMAL(10,2),
    
    -- Payment processor fields
    payment_processor TEXT NOT NULL DEFAULT 'stripe' CHECK (payment_processor IN ('stripe', 'crossmint')),
    processor_session_id TEXT, -- Stripe checkout session ID
    processor_payment_id TEXT, -- Stripe payment intent ID
    processor_transaction_id TEXT, -- Final transaction ID from processor
    
    -- Payment method information
    payment_method_type TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded', 'expired')),
    
    -- Timestamp fields for status tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    
    -- Error tracking
    failure_reason TEXT,
    
    -- Metadata for additional information
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_amounts CHECK (amount_aed > 0),
    CONSTRAINT valid_processor_ids CHECK (
        (payment_processor = 'stripe' AND processor_session_id IS NOT NULL) OR
        (payment_processor = 'crossmint')
    )
);

-- Create indexes for performance
CREATE INDEX idx_transactions_payment_link_id ON transactions(payment_link_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_payment_processor ON transactions(payment_processor);
CREATE INDEX idx_transactions_processor_session_id ON transactions(processor_session_id) WHERE processor_session_id IS NOT NULL;
CREATE INDEX idx_transactions_processor_payment_id ON transactions(processor_payment_id) WHERE processor_payment_id IS NOT NULL;
CREATE INDEX idx_transactions_processor_transaction_id ON transactions(processor_transaction_id) WHERE processor_transaction_id IS NOT NULL;
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_completed_at ON transactions(completed_at) WHERE completed_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view transactions for their payment links" ON transactions
    FOR SELECT USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id = auth.uid()::uuid OR linked_user_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Service can insert transactions" ON transactions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update transactions" ON transactions
    FOR UPDATE USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE transactions IS 'Unified transaction table supporting both Stripe and Crossmint payment processors with comprehensive status tracking';