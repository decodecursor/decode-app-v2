-- =====================================
-- DECODE Beauty Platform - Complete Database Setup (FIXED)
-- =====================================
-- Copy and paste this entire script into your Supabase SQL Editor
-- This will create all required tables, indexes, triggers, and security policies

-- 1. CREATE USERS TABLE
-- =====================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    professional_center_name TEXT,
    instagram_handle TEXT UNIQUE,
    wallet_address TEXT,
    role TEXT NOT NULL CHECK (role IN ('Beauty Professional', 'Beauty Model', 'Admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- 2. CREATE PAYMENT LINKS TABLE
-- =====================================
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

-- Create RLS policies for payment links
CREATE POLICY "Users can view own payment links" ON payment_links
    FOR SELECT USING (
        auth.uid()::text = creator_id::text OR 
        auth.uid()::text = linked_user_id::text
    );

CREATE POLICY "Users can insert own payment links" ON payment_links
    FOR INSERT WITH CHECK (auth.uid()::text = creator_id::text);

CREATE POLICY "Users can update own payment links" ON payment_links
    FOR UPDATE USING (auth.uid()::text = creator_id::text);

CREATE POLICY "Users can delete own payment links" ON payment_links
    FOR DELETE USING (auth.uid()::text = creator_id::text);

-- 3. CREATE TRANSACTIONS TABLE
-- =====================================
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

-- Create RLS policies for transactions
CREATE POLICY "Users can view transactions for their payment links" ON transactions
    FOR SELECT USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text 
               OR linked_user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Authenticated users can insert transactions" ON transactions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can update transactions for their payment links" ON transactions
    FOR UPDATE USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        ) OR auth.role() = 'service_role'
    );

-- 4. CREATE WEBHOOK EVENTS TABLE
-- =====================================
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    signature TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed', 'unhandled')),
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for webhook events (FIXED - removed problematic GIN index)
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_timestamp ON webhook_events(timestamp);
CREATE INDEX idx_webhook_events_processed_at ON webhook_events(processed_at);

-- Create index on event_data JSONB (this works fine)
CREATE INDEX idx_webhook_events_event_data ON webhook_events USING GIN (event_data);

-- Enable Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for webhook events
CREATE POLICY "System users can access webhook events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Create cleanup function for old webhook events
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CREATE AUTH TRIGGER FOR USER CREATION
-- =====================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Beauty Professional')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that calls the function after user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 6. ADD TABLE COMMENTS
-- =====================================
COMMENT ON TABLE users IS 'User profiles with role-based access for beauty professionals and models';
COMMENT ON TABLE payment_links IS 'Payment links created by users with expiration and linking functionality';
COMMENT ON TABLE transactions IS 'Transaction tracking with webhook support, multiple payment processors, and detailed status tracking. Uses amount_usd field to match application code expectations.';
COMMENT ON TABLE webhook_events IS 'Webhook event logging for debugging and audit purposes with automatic cleanup';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user record in the users table when someone signs up through Supabase Auth';

-- =====================================
-- SETUP COMPLETE!
-- =====================================
-- All tables, indexes, triggers, and security policies have been created.
-- Your DECODE application is now ready to use with full database support.