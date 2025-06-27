-- Analytics and Reporting Tables for DECODE app
-- These tables extend the existing payment tracking with detailed analytics

-- Analytics Events Table
-- Track detailed events for better analytics and funnel analysis
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'page_view', 'payment_link_view', 'payment_initiated', 
        'payment_completed', 'payment_failed', 'email_opened', 
        'link_shared', 'link_copied'
    )),
    event_data JSONB DEFAULT '{}',
    payment_link_id UUID REFERENCES payment_links(id),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_payment_link_id ON analytics_events(payment_link_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Daily Analytics Aggregates Table
-- Pre-computed daily statistics for faster dashboard loading
CREATE TABLE daily_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    user_id UUID REFERENCES users(id),
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    payment_link_views INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date, user_id)
);

-- Create indexes
CREATE INDEX idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX idx_daily_analytics_user_id ON daily_analytics(user_id);

-- Geographic Analytics Table
-- Track payment locations for geographic insights
CREATE TABLE geographic_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    country_code CHAR(2),
    country_name TEXT,
    state_province TEXT,
    city TEXT,
    postal_code TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_geographic_analytics_transaction_id ON geographic_analytics(transaction_id);
CREATE INDEX idx_geographic_analytics_country_code ON geographic_analytics(country_code);

-- Customer Insights Table
-- Track customer behavior and lifetime value
CREATE TABLE customer_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email TEXT NOT NULL,
    user_id UUID REFERENCES users(id), -- The business owner
    first_transaction_date TIMESTAMPTZ,
    last_transaction_date TIMESTAMPTZ,
    total_transactions INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    customer_lifetime_value DECIMAL(10,2) DEFAULT 0,
    acquisition_channel TEXT, -- How they found the business
    customer_segment TEXT CHECK (customer_segment IN ('new', 'returning', 'vip', 'at_risk')),
    last_activity_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(customer_email, user_id)
);

-- Create indexes
CREATE INDEX idx_customer_insights_customer_email ON customer_insights(customer_email);
CREATE INDEX idx_customer_insights_user_id ON customer_insights(user_id);
CREATE INDEX idx_customer_insights_customer_segment ON customer_insights(customer_segment);

-- Payment Analytics Table
-- Detailed payment processing analytics
CREATE TABLE payment_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    payment_processor TEXT DEFAULT 'crossmint',
    processing_time_ms INTEGER, -- Time to process payment
    payment_method TEXT, -- card, bank, crypto, etc.
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10, 6), -- If currency conversion was needed
    processor_fees DECIMAL(10,2), -- Fees charged by payment processor
    network_fees DECIMAL(10,2), -- Network fees for crypto payments
    total_fees DECIMAL(10,2), -- Total fees
    risk_score INTEGER, -- Fraud risk score (0-100)
    decline_reason TEXT, -- Reason for declined payments
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payment_analytics_transaction_id ON payment_analytics(transaction_id);
CREATE INDEX idx_payment_analytics_payment_processor ON payment_analytics(payment_processor);
CREATE INDEX idx_payment_analytics_payment_method ON payment_analytics(payment_method);

-- Enable Row Level Security on all analytics tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE geographic_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_events
CREATE POLICY "Users can view their analytics events" ON analytics_events
    FOR SELECT USING (
        user_id::text = auth.uid()::text OR
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        )
    );

CREATE POLICY "System can insert analytics events" ON analytics_events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for daily_analytics
CREATE POLICY "Users can view their daily analytics" ON daily_analytics
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "System can manage daily analytics" ON daily_analytics
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for geographic_analytics
CREATE POLICY "Users can view geographic analytics for their transactions" ON geographic_analytics
    FOR SELECT USING (
        transaction_id IN (
            SELECT t.id FROM transactions t
            JOIN payment_links pl ON t.payment_link_id = pl.id
            WHERE pl.creator_id::text = auth.uid()::text
        )
    );

CREATE POLICY "System can insert geographic analytics" ON geographic_analytics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for customer_insights
CREATE POLICY "Users can view their customer insights" ON customer_insights
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "System can manage customer insights" ON customer_insights
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for payment_analytics
CREATE POLICY "Users can view payment analytics for their transactions" ON payment_analytics
    FOR SELECT USING (
        transaction_id IN (
            SELECT t.id FROM transactions t
            JOIN payment_links pl ON t.payment_link_id = pl.id
            WHERE pl.creator_id::text = auth.uid()::text
        )
    );

CREATE POLICY "System can insert payment analytics" ON payment_analytics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Functions for automated analytics updates

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS trigger AS $$
BEGIN
    -- Update daily analytics when a transaction is completed
    IF NEW.status = 'completed' THEN
        INSERT INTO daily_analytics (
            date, user_id, total_revenue, total_transactions, 
            successful_transactions, average_order_value
        )
        SELECT 
            CURRENT_DATE,
            pl.creator_id,
            NEW.amount_paid_usd,
            1,
            1,
            NEW.amount_paid_usd
        FROM payment_links pl
        WHERE pl.id = NEW.payment_link_id
        ON CONFLICT (date, user_id) 
        DO UPDATE SET
            total_revenue = daily_analytics.total_revenue + NEW.amount_paid_usd,
            total_transactions = daily_analytics.total_transactions + 1,
            successful_transactions = daily_analytics.successful_transactions + 1,
            average_order_value = (daily_analytics.total_revenue + NEW.amount_paid_usd) / (daily_analytics.successful_transactions + 1),
            updated_at = NOW();
    ELSIF NEW.status = 'failed' THEN
        INSERT INTO daily_analytics (
            date, user_id, total_transactions, failed_transactions
        )
        SELECT 
            CURRENT_DATE,
            pl.creator_id,
            1,
            1
        FROM payment_links pl
        WHERE pl.id = NEW.payment_link_id
        ON CONFLICT (date, user_id) 
        DO UPDATE SET
            total_transactions = daily_analytics.total_transactions + 1,
            failed_transactions = daily_analytics.failed_transactions + 1,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for daily analytics updates
CREATE TRIGGER trigger_update_daily_analytics
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_analytics();

-- Function to update customer insights
CREATE OR REPLACE FUNCTION update_customer_insights()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.buyer_email IS NOT NULL THEN
        INSERT INTO customer_insights (
            customer_email, user_id, first_transaction_date, 
            last_transaction_date, total_transactions, total_spent,
            average_order_value, customer_lifetime_value
        )
        SELECT 
            NEW.buyer_email,
            pl.creator_id,
            NEW.created_at,
            NEW.created_at,
            1,
            NEW.amount_paid_usd,
            NEW.amount_paid_usd,
            NEW.amount_paid_usd
        FROM payment_links pl
        WHERE pl.id = NEW.payment_link_id
        ON CONFLICT (customer_email, user_id) 
        DO UPDATE SET
            last_transaction_date = NEW.created_at,
            total_transactions = customer_insights.total_transactions + 1,
            total_spent = customer_insights.total_spent + NEW.amount_paid_usd,
            average_order_value = (customer_insights.total_spent + NEW.amount_paid_usd) / (customer_insights.total_transactions + 1),
            customer_lifetime_value = customer_insights.total_spent + NEW.amount_paid_usd,
            customer_segment = CASE 
                WHEN customer_insights.total_transactions + 1 = 1 THEN 'new'
                WHEN customer_insights.total_spent + NEW.amount_paid_usd > 500 THEN 'vip'
                ELSE 'returning'
            END,
            last_activity_date = NEW.created_at,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for customer insights updates
CREATE TRIGGER trigger_update_customer_insights
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_insights();

-- Create a view for easy analytics querying
CREATE OR REPLACE VIEW analytics_summary AS
SELECT 
    u.id as user_id,
    u.email as user_email,
    COUNT(DISTINCT pl.id) as total_payment_links,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN pl.id END) as active_payment_links,
    COUNT(t.id) as total_transactions,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as successful_transactions,
    COUNT(CASE WHEN t.status = 'failed' THEN 1 END) as failed_transactions,
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.amount_paid_usd END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN t.status = 'completed' THEN t.amount_paid_usd END), 0) as average_order_value,
    COUNT(DISTINCT t.buyer_email) as unique_customers,
    CASE 
        WHEN COUNT(t.id) > 0 THEN (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::decimal / COUNT(t.id) * 100)
        ELSE 0 
    END as success_rate
FROM users u
LEFT JOIN payment_links pl ON u.id = pl.creator_id
LEFT JOIN transactions t ON pl.id = t.payment_link_id
GROUP BY u.id, u.email;