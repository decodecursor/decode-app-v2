-- CROSSMINT INTEGRATION MIGRATION
-- This script adds all necessary columns and tables for Crossmint headless checkout

-- 1. ADD WALLET FIELDS TO USERS TABLE
-- Add Crossmint wallet information to existing users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS crossmint_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS wallet_created_at TIMESTAMPTZ;

-- Note: wallet_address already exists in the current schema

-- 2. ADD MARKETPLACE FEE FIELDS TO PAYMENT_LINKS TABLE
-- Add fee calculation fields for 11% marketplace model
ALTER TABLE payment_links 
ADD COLUMN IF NOT EXISTS original_amount_aed DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS fee_amount_aed DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_amount_aed DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(10,2);

-- Update existing payment_links to have fee structure
-- For existing records, set original_amount = current amount_aed, calculate 11% fee
UPDATE payment_links 
SET 
    original_amount_aed = amount_aed,
    fee_amount_aed = ROUND(amount_aed * 0.11, 2),
    total_amount_aed = ROUND(amount_aed * 1.11, 2)
WHERE original_amount_aed IS NULL;

-- 3. CREATE WALLET_TRANSACTIONS TABLE
-- Track all wallet transactions for transparency and auditing
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_link_id UUID REFERENCES payment_links(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'payment_received',    -- Customer paid for service
        'transfer_out',        -- Money transferred to beauty professional
        'fee_collected',       -- DECODE marketplace fee
        'refund_issued',       -- Refund processed
        'wallet_created'       -- Initial wallet creation
    )),
    amount_usdc DECIMAL(20,8),
    amount_aed DECIMAL(10,2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'completed', 
        'failed',
        'cancelled'
    )),
    crossmint_transaction_id TEXT,
    crossmint_session_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security for wallet_transactions
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can insert transactions" ON wallet_transactions
    FOR INSERT WITH CHECK (true); -- Allow system to insert transactions

CREATE POLICY "System can update transactions" ON wallet_transactions
    FOR UPDATE USING (true); -- Allow system to update transaction status

-- 4. CREATE INDEXES FOR PERFORMANCE
-- Index on wallet transactions for fast user lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_link_id ON wallet_transactions(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- Index on payment links for expiration handling
CREATE INDEX IF NOT EXISTS idx_payment_links_expiration ON payment_links(expiration_date, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_links_creator_status ON payment_links(creator_id, is_active);

-- Index on users for wallet lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_crossmint_wallet_id ON users(crossmint_wallet_id);

-- 5. CREATE FUNCTION FOR AUTO-EXPIRATION
-- Function to automatically deactivate expired payment links
CREATE OR REPLACE FUNCTION auto_deactivate_expired_links()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Deactivate payment links that have expired
    UPDATE payment_links 
    SET is_active = false, 
        updated_at = NOW()
    WHERE expiration_date < NOW() 
    AND is_active = true;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log the operation
    INSERT INTO wallet_transactions (
        user_id, 
        payment_link_id, 
        transaction_type, 
        status, 
        metadata
    )
    SELECT 
        creator_id,
        id,
        'system_action',
        'completed',
        jsonb_build_object(
            'action', 'auto_deactivation',
            'reason', 'expired',
            'deactivated_at', NOW()
        )
    FROM payment_links 
    WHERE expiration_date < NOW() 
    AND is_active = false
    AND updated_at >= NOW() - INTERVAL '1 minute'; -- Only recent deactivations
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE FUNCTION TO UPDATE TIMESTAMPS
-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column to payment_links if not exists
ALTER TABLE payment_links 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_payment_links_updated_at ON payment_links;
CREATE TRIGGER update_payment_links_updated_at
    BEFORE UPDATE ON payment_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON wallet_transactions;
CREATE TRIGGER update_wallet_transactions_updated_at
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. CREATE SCHEDULED JOB FOR AUTO-EXPIRATION (PostgreSQL/Supabase Edge Functions)
-- Note: This would typically be implemented as a Supabase Edge Function or cron job
-- For now, we create the function that can be called periodically

-- 8. VALIDATE CONSTRAINTS
-- Ensure fee calculations are consistent
ALTER TABLE payment_links 
ADD CONSTRAINT IF NOT EXISTS check_fee_calculation 
CHECK (
    (original_amount_aed IS NULL AND fee_amount_aed IS NULL AND total_amount_aed IS NULL) OR
    (original_amount_aed IS NOT NULL AND fee_amount_aed IS NOT NULL AND total_amount_aed IS NOT NULL AND
     ABS(total_amount_aed - (original_amount_aed + fee_amount_aed)) < 0.01)
);

-- Ensure wallet transaction amounts are positive (except for refunds)
ALTER TABLE wallet_transactions
ADD CONSTRAINT IF NOT EXISTS check_positive_amounts
CHECK (
    (transaction_type = 'refund_issued' AND amount_usdc <= 0) OR
    (transaction_type != 'refund_issued' AND (amount_usdc >= 0 OR amount_usdc IS NULL))
);

-- 9. CREATE VIEW FOR TRANSACTION SUMMARY
-- Helpful view for dashboard displaying user transactions
CREATE OR REPLACE VIEW user_transaction_summary AS
SELECT 
    wt.user_id,
    u.email,
    u.full_name,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN wt.transaction_type = 'payment_received' AND wt.status = 'completed' THEN wt.amount_usdc ELSE 0 END) as total_received_usdc,
    SUM(CASE WHEN wt.transaction_type = 'transfer_out' AND wt.status = 'completed' THEN wt.amount_usdc ELSE 0 END) as total_transferred_usdc,
    SUM(CASE WHEN wt.transaction_type = 'fee_collected' AND wt.status = 'completed' THEN wt.amount_usdc ELSE 0 END) as total_fees_usdc,
    MAX(wt.created_at) as last_transaction_at
FROM wallet_transactions wt
JOIN users u ON u.id = wt.user_id
WHERE wt.status = 'completed'
GROUP BY wt.user_id, u.email, u.full_name;

-- 10. GRANT PERMISSIONS
-- Grant necessary permissions for the application
GRANT SELECT, INSERT, UPDATE ON wallet_transactions TO authenticated;
GRANT SELECT ON user_transaction_summary TO authenticated;

-- Comments for documentation
COMMENT ON TABLE wallet_transactions IS 'Tracks all cryptocurrency transactions for transparency and auditing';
COMMENT ON COLUMN payment_links.original_amount_aed IS 'Original service amount before marketplace fee';
COMMENT ON COLUMN payment_links.fee_amount_aed IS 'DECODE marketplace fee (11% of original amount)';
COMMENT ON COLUMN payment_links.total_amount_aed IS 'Total amount customer pays (original + fee)';
COMMENT ON FUNCTION auto_deactivate_expired_links() IS 'Automatically deactivates payment links after 7 days';

-- Migration completed successfully
SELECT 'Crossmint integration migration completed successfully' as status;