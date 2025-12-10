-- Add company_name column to payment_links table
-- This enables tracking which company created each payment link for audit and analytics

-- Add company_name field to payment_links table
ALTER TABLE payment_links
ADD COLUMN company_name TEXT NULL;

-- Add index for performance on company queries
CREATE INDEX idx_payment_links_company_name ON payment_links(company_name);

-- Populate existing payment links with company_name from users table
UPDATE payment_links
SET company_name = users.company_name
FROM users
WHERE payment_links.creator_id = users.id
AND users.company_name IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN payment_links.company_name IS 'Company name of the user who created this payment link';