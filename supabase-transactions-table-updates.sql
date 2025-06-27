-- Update Transactions table for enhanced webhook support
-- These updates add fields needed for proper webhook processing and transaction tracking

-- Add new columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'crossmint',
ADD COLUMN IF NOT EXISTS processor_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update the status check constraint to include new statuses
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions 
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded', 'expired'));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_processor_id ON transactions(processor_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_processor ON transactions(payment_processor);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method_type ON transactions(payment_method_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_completed_at ON transactions(completed_at);
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at);

-- Create index on metadata for fast lookup
CREATE INDEX IF NOT EXISTS idx_transactions_metadata ON transactions USING GIN (metadata);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- Create function to get transaction summary for a payment link
CREATE OR REPLACE FUNCTION get_payment_link_transaction_summary(link_id UUID)
RETURNS TABLE (
    total_transactions BIGINT,
    completed_transactions BIGINT,
    failed_transactions BIGINT,
    pending_transactions BIGINT,
    total_revenue DECIMAL(10,2),
    last_transaction_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_transactions,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_transactions,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_transactions,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_transactions,
        COALESCE(SUM(amount_usd) FILTER (WHERE status = 'completed'), 0)::DECIMAL(10,2) as total_revenue,
        MAX(created_at) as last_transaction_date
    FROM transactions 
    WHERE payment_link_id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user transaction analytics
CREATE OR REPLACE FUNCTION get_user_transaction_analytics(user_id UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_revenue DECIMAL(10,2),
    total_transactions BIGINT,
    success_rate DECIMAL(5,2),
    avg_transaction_amount DECIMAL(10,2),
    top_payment_method TEXT,
    revenue_by_day JSONB
) AS $$
DECLARE
    start_date TIMESTAMPTZ := NOW() - (days_back || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH user_transactions AS (
        SELECT t.*
        FROM transactions t
        JOIN payment_links pl ON t.payment_link_id = pl.id
        WHERE pl.creator_id = user_id 
        AND t.created_at >= start_date
    ),
    daily_revenue AS (
        SELECT 
            DATE(created_at) as day,
            SUM(amount_usd) FILTER (WHERE status = 'completed') as revenue,
            COUNT(*) FILTER (WHERE status = 'completed') as transactions
        FROM user_transactions
        GROUP BY DATE(created_at)
        ORDER BY day
    )
    SELECT 
        COALESCE(SUM(amount_usd) FILTER (WHERE status = 'completed'), 0)::DECIMAL(10,2) as total_revenue,
        COUNT(*)::BIGINT as total_transactions,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))::DECIMAL(5,2)
            ELSE 0::DECIMAL(5,2)
        END as success_rate,
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0 THEN
                (SUM(amount_usd) FILTER (WHERE status = 'completed') / COUNT(*) FILTER (WHERE status = 'completed'))::DECIMAL(10,2)
            ELSE 0::DECIMAL(10,2)
        END as avg_transaction_amount,
        (
            SELECT payment_method_type 
            FROM user_transactions 
            WHERE payment_method_type IS NOT NULL 
            GROUP BY payment_method_type 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as top_payment_method,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', day,
                    'revenue', COALESCE(revenue, 0),
                    'transactions', COALESCE(transactions, 0)
                )
                ORDER BY day
            )
            FROM daily_revenue
        ) as revenue_by_day
    FROM user_transactions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to work with new fields
-- Users can view transactions for their payment links (updated to include new fields)
DROP POLICY IF EXISTS "Users can view transactions for their payment links" ON transactions;
CREATE POLICY "Users can view transactions for their payment links" ON transactions
    FOR SELECT USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text 
               OR linked_user_id::text = auth.uid()::text
        )
    );

-- Allow system/service role to insert and update transactions (for webhooks)
CREATE POLICY IF NOT EXISTS "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Add comment to table explaining the new structure
COMMENT ON TABLE transactions IS 'Enhanced transaction tracking with webhook support, multiple payment processors, and detailed status tracking';