-- Create Webhook Events table for DECODE app
-- This table logs all incoming webhook events for debugging and audit purposes

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

-- Create indexes for better query performance
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_timestamp ON webhook_events(timestamp);
CREATE INDEX idx_webhook_events_processed_at ON webhook_events(processed_at);

-- Create index on event_data for fast lookup by transaction ID
CREATE INDEX idx_webhook_events_transaction_id ON webhook_events USING GIN ((event_data->>'id'));

-- Enable Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Only authenticated system users can access webhook events
-- This is typically for admin/system access only
CREATE POLICY "System users can access webhook events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to clean up old webhook events (optional)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
    -- Delete webhook events older than 90 days
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-webhook-events', '0 2 * * *', 'SELECT cleanup_old_webhook_events();');