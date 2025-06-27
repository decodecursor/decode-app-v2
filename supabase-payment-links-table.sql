-- Create Payment Links table for DECODE app
CREATE TABLE payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    amount_usd DECIMAL(10,2) NOT NULL,
    expiration_date TIMESTAMPTZ NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    linked_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only see their own payment links (as creator or linked user)
CREATE POLICY "Users can view own payment links" ON payment_links
    FOR SELECT USING (
        auth.uid()::text = creator_id::text OR 
        auth.uid()::text = linked_user_id::text
    );

-- Users can insert payment links they create
CREATE POLICY "Users can insert own payment links" ON payment_links
    FOR INSERT WITH CHECK (auth.uid()::text = creator_id::text);

-- Users can update payment links they created
CREATE POLICY "Users can update own payment links" ON payment_links
    FOR UPDATE USING (auth.uid()::text = creator_id::text);

-- Users can delete payment links they created
CREATE POLICY "Users can delete own payment links" ON payment_links
    FOR DELETE USING (auth.uid()::text = creator_id::text);