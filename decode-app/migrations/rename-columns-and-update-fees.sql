-- MIGRATION: Rename Payment Link Columns & Update Fee from 11% to 9%
-- This migration makes the payment amount fields clearer and updates the fee structure

-- 1. RENAME COLUMNS FOR CLARITY
-- Rename to more intuitive field names
ALTER TABLE payment_links RENAME COLUMN original_amount_aed TO service_amount_aed;
ALTER TABLE payment_links RENAME COLUMN fee_amount_aed TO decode_amount_aed;
-- total_amount_aed stays the same

-- 2. UPDATE EXISTING RECORDS TO 9% FEE STRUCTURE
-- Recalculate all existing payment links from 11% to 9%
-- This assumes current total_amount_aed was calculated with 11% fee

UPDATE payment_links 
SET 
    -- If we have service_amount_aed, use it; otherwise back-calculate from total
    service_amount_aed = COALESCE(service_amount_aed, ROUND(total_amount_aed / 1.11, 2)),
    -- Calculate new 9% decode amount
    decode_amount_aed = ROUND(COALESCE(service_amount_aed, ROUND(total_amount_aed / 1.11, 2)) * 0.09, 2),
    -- Calculate new total with 9% fee
    total_amount_aed = ROUND(COALESCE(service_amount_aed, ROUND(total_amount_aed / 1.11, 2)) * 1.09, 2)
WHERE service_amount_aed IS NOT NULL OR total_amount_aed IS NOT NULL;

-- 3. UPDATE LEGACY amount_aed FIELD
-- Ensure legacy field contains the new total amount for backward compatibility
UPDATE payment_links 
SET amount_aed = total_amount_aed 
WHERE total_amount_aed IS NOT NULL;

-- 4. UPDATE CONSTRAINTS
-- Drop old constraint if it exists
ALTER TABLE payment_links DROP CONSTRAINT IF EXISTS check_fee_calculation;

-- Add new constraint with 9% fee validation
ALTER TABLE payment_links 
ADD CONSTRAINT check_fee_calculation_9_percent 
CHECK (
    (service_amount_aed IS NULL AND decode_amount_aed IS NULL AND total_amount_aed IS NULL) OR
    (service_amount_aed IS NOT NULL AND decode_amount_aed IS NOT NULL AND total_amount_aed IS NOT NULL AND
     ABS(total_amount_aed - (service_amount_aed + decode_amount_aed)) < 0.01 AND
     ABS(decode_amount_aed - (service_amount_aed * 0.09)) < 0.01)
);

-- 5. UPDATE COLUMN COMMENTS
COMMENT ON COLUMN payment_links.service_amount_aed IS 'Pure service amount entered by beauty professional';
COMMENT ON COLUMN payment_links.decode_amount_aed IS 'DECODE platform amount (9% of service amount)';
COMMENT ON COLUMN payment_links.total_amount_aed IS 'Total amount customer pays (service + decode amount)';
COMMENT ON COLUMN payment_links.amount_aed IS 'Legacy field for backward compatibility (contains total amount)';

-- 6. CREATE INDEX FOR PERFORMANCE
-- Add index on new service_amount_aed for reporting queries
CREATE INDEX IF NOT EXISTS idx_payment_links_service_amount ON payment_links(service_amount_aed);

-- 7. VERIFY MIGRATION
-- Display sample of updated records for verification
DO $$
DECLARE
    sample_record RECORD;
    total_updated INTEGER;
BEGIN
    -- Count total updated records
    SELECT COUNT(*) INTO total_updated FROM payment_links WHERE service_amount_aed IS NOT NULL;
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Total payment links updated: %', total_updated;
    
    -- Show a sample record
    FOR sample_record IN 
        SELECT service_amount_aed, decode_amount_aed, total_amount_aed
        FROM payment_links 
        WHERE service_amount_aed IS NOT NULL 
        LIMIT 1
    LOOP
        RAISE NOTICE 'Sample record - Service: AED %, Decode: AED %, Total: AED %', 
            sample_record.service_amount_aed, 
            sample_record.decode_amount_aed, 
            sample_record.total_amount_aed;
    END LOOP;
END $$;

-- Migration completed
SELECT 'Payment link column renaming and 9% fee migration completed successfully' as status;