-- Create Email Logs table for DECODE app
-- This table tracks all email notifications sent by the system

CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'payment_confirmation',
        'payment_failed_notification',
        'payment_link_created',
        'payment_link_expired',
        'system_notification'
    )),
    transaction_id UUID,
    payment_link_id UUID,
    subject TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'bounced')) DEFAULT 'pending',
    email_service_id TEXT, -- External email service message ID
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_transaction_id ON email_logs(transaction_id);
CREATE INDEX idx_email_logs_payment_link_id ON email_logs(payment_link_id);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);

-- Add foreign key relationships
ALTER TABLE email_logs 
ADD CONSTRAINT fk_email_logs_transaction 
FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;

ALTER TABLE email_logs 
ADD CONSTRAINT fk_email_logs_payment_link 
FOREIGN KEY (payment_link_id) REFERENCES payment_links(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can view email logs for their payment links/transactions
CREATE POLICY "Users can view their email logs" ON email_logs
    FOR SELECT USING (
        transaction_id IN (
            SELECT t.id FROM transactions t
            JOIN payment_links pl ON t.payment_link_id = pl.id
            WHERE pl.creator_id::text = auth.uid()::text
        )
        OR 
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        )
    );

-- System can insert email logs
CREATE POLICY "System can insert email logs" ON email_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- System can update email logs (for status updates)
CREATE POLICY "System can update email logs" ON email_logs
    FOR UPDATE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Create function to update email status
CREATE OR REPLACE FUNCTION update_email_status(
    log_id UUID,
    new_status TEXT,
    service_id TEXT DEFAULT NULL,
    error_msg TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE email_logs 
    SET 
        status = new_status,
        email_service_id = COALESCE(service_id, email_service_id),
        error_message = COALESCE(error_msg, error_message),
        sent_at = CASE WHEN new_status = 'sent' THEN NOW() ELSE sent_at END
    WHERE id = log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old email logs
CREATE OR REPLACE FUNCTION cleanup_old_email_logs()
RETURNS void AS $$
BEGIN
    -- Delete email logs older than 1 year
    DELETE FROM email_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;