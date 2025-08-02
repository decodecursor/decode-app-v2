-- Add simple is_paid column to payment_links table
ALTER TABLE payment_links ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX idx_payment_links_is_paid ON payment_links(is_paid);