-- Add payment status tracking to payment_links table
-- This enables direct status checking without complex transaction queries

-- Add payment_status field to payment_links table
ALTER TABLE payment_links 
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded'));

-- Add timestamp for when payment was completed
ALTER TABLE payment_links 
ADD COLUMN paid_at TIMESTAMPTZ NULL;

-- Add index for performance on status queries
CREATE INDEX idx_payment_links_payment_status ON payment_links(payment_status);
CREATE INDEX idx_payment_links_paid_at ON payment_links(paid_at) WHERE paid_at IS NOT NULL;

-- Create function to automatically update payment_links status when transactions change
CREATE OR REPLACE FUNCTION update_payment_link_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When a transaction is completed, update the payment link status
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE payment_links 
        SET 
            payment_status = 'paid',
            paid_at = NEW.completed_at
        WHERE id = NEW.payment_link_id;
        
    -- When a transaction fails and there are no other completed transactions
    ELSIF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
        -- Only update to failed if there are no completed transactions for this payment link
        UPDATE payment_links 
        SET payment_status = 'failed'
        WHERE id = NEW.payment_link_id 
        AND payment_status = 'unpaid'
        AND NOT EXISTS (
            SELECT 1 FROM transactions 
            WHERE payment_link_id = NEW.payment_link_id 
            AND status = 'completed'
            AND id != NEW.id
        );
        
    -- When a transaction is refunded
    ELSIF NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded') THEN
        UPDATE payment_links 
        SET 
            payment_status = 'refunded',
            paid_at = NULL
        WHERE id = NEW.payment_link_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update payment link status
CREATE TRIGGER update_payment_link_status_trigger
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_link_status();

-- Migrate existing data: Update payment_status based on existing transactions
UPDATE payment_links 
SET 
    payment_status = 'paid',
    paid_at = (
        SELECT MIN(completed_at) 
        FROM transactions 
        WHERE transactions.payment_link_id = payment_links.id 
        AND transactions.status = 'completed'
    )
WHERE EXISTS (
    SELECT 1 FROM transactions 
    WHERE transactions.payment_link_id = payment_links.id 
    AND transactions.status = 'completed'
);

-- Add comment for documentation
COMMENT ON COLUMN payment_links.payment_status IS 'Current payment status: unpaid, paid, failed, or refunded';
COMMENT ON COLUMN payment_links.paid_at IS 'Timestamp when the payment was first completed';
COMMENT ON FUNCTION update_payment_link_status() IS 'Automatically updates payment_links.payment_status when transactions change';