-- Create Transactions table for DECODE app
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_link_id UUID NOT NULL REFERENCES payment_links(id),
    buyer_email TEXT,
    amount_paid_usd DECIMAL(10,2) NOT NULL,
    decode_share_usd DECIMAL(10,2) NOT NULL,
    bp_share_usd DECIMAL(10,2) NOT NULL,
    bm_share_usd DECIMAL(10,2),
    crossmint_transaction_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can view transactions for their payment links
-- This joins through payment_links to check if the user is the creator or linked user
CREATE POLICY "Users can view transactions for their payment links" ON transactions
    FOR SELECT USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text 
               OR linked_user_id::text = auth.uid()::text
        )
    );

-- Policy for inserting transactions (typically done by system/webhook)
-- For now, allowing authenticated users to insert
CREATE POLICY "Authenticated users can insert transactions" ON transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for updating transactions (typically done by system/webhook)
-- Only allow updates to transactions for payment links the user owns
CREATE POLICY "Users can update transactions for their payment links" ON transactions
    FOR UPDATE USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        )
    );