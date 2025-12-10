-- Create Transactions table for DECODE app (Corrected to match application code)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_link_id UUID NOT NULL REFERENCES payment_links(id),
    buyer_email TEXT,
    amount_usd DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded', 'expired')),
    payment_processor TEXT DEFAULT 'crossmint',
    processor_transaction_id TEXT,
    payment_method_type TEXT,
    metadata JSONB DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_payment_link_id ON transactions(payment_link_id);
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

-- Create RLS policy: Users can view transactions for their payment links
CREATE POLICY "Users can view transactions for their payment links" ON transactions
    FOR SELECT USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text 
               OR linked_user_id::text = auth.uid()::text
        )
    );

-- Policy for inserting transactions (typically done by system/webhook)
-- Allow authenticated users and service role to insert
CREATE POLICY "Authenticated users can insert transactions" ON transactions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Allow system/service role to insert and update transactions (for webhooks)
CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for updating transactions (typically done by system/webhook)
-- Only allow updates to transactions for payment links the user owns
CREATE POLICY "Users can update transactions for their payment links" ON transactions
    FOR UPDATE USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        ) OR auth.role() = 'service_role'
    );

-- Add comment to table explaining the structure
COMMENT ON TABLE transactions IS 'Transaction tracking with webhook support, multiple payment processors, and detailed status tracking. Uses amount_usd field to match application code expectations.';