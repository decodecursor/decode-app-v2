-- MIGRATION: Update DECODE from Fixed 9% to Tiered Fee Structure
-- Implements new fee tiers:
-- AED 1-1999: 9%
-- AED 2000-4999: 7.5%
-- AED 5000-100000: 6%

-- 1. REMOVE EXISTING 9% FEE CONSTRAINT
ALTER TABLE payment_links DROP CONSTRAINT IF EXISTS check_fee_calculation_9_percent;

-- 2. CREATE FUNCTION FOR TIERED FEE CALCULATION
CREATE OR REPLACE FUNCTION calculate_tiered_fee(amount_aed DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF amount_aed >= 1 AND amount_aed <= 1999 THEN
        RETURN ROUND(amount_aed * 0.09, 2); -- 9%
    ELSIF amount_aed >= 2000 AND amount_aed <= 4999 THEN
        RETURN ROUND(amount_aed * 0.075, 2); -- 7.5%
    ELSIF amount_aed >= 5000 AND amount_aed <= 100000 THEN
        RETURN ROUND(amount_aed * 0.06, 2); -- 6%
    ELSE
        -- Default to 9% for amounts outside defined ranges
        RETURN ROUND(amount_aed * 0.09, 2);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. UPDATE EXISTING PAYMENT LINKS TO USE TIERED FEE STRUCTURE
UPDATE payment_links
SET
    -- Recalculate decode_amount_aed using tiered structure
    decode_amount_aed = calculate_tiered_fee(COALESCE(service_amount_aed, ROUND(total_amount_aed / 1.09, 2))),
    -- Recalculate total_amount_aed with new fee
    total_amount_aed = COALESCE(service_amount_aed, ROUND(total_amount_aed / 1.09, 2)) + calculate_tiered_fee(COALESCE(service_amount_aed, ROUND(total_amount_aed / 1.09, 2))),
    updated_at = NOW()
WHERE service_amount_aed IS NOT NULL OR total_amount_aed IS NOT NULL;

-- 4. ADD NEW CONSTRAINT FOR TIERED FEE VALIDATION
ALTER TABLE payment_links
ADD CONSTRAINT check_tiered_fee_calculation
CHECK (
    service_amount_aed IS NULL OR
    ABS(decode_amount_aed - calculate_tiered_fee(service_amount_aed)) < 0.01
);

-- 5. UPDATE COLUMN COMMENTS
COMMENT ON COLUMN payment_links.decode_amount_aed IS 'DECODE platform amount (tiered: 9% for 1-1999, 7.5% for 2000-4999, 6% for 5000-100000 AED)';
COMMENT ON COLUMN payment_links.service_amount_aed IS 'Original service amount before tiered marketplace fee';

-- 6. CREATE FUNCTION TO GET FEE PERCENTAGE FOR REPORTING
CREATE OR REPLACE FUNCTION get_fee_percentage(amount_aed DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF amount_aed >= 1 AND amount_aed <= 1999 THEN
        RETURN 9.0;
    ELSIF amount_aed >= 2000 AND amount_aed <= 4999 THEN
        RETURN 7.5;
    ELSIF amount_aed >= 5000 AND amount_aed <= 100000 THEN
        RETURN 6.0;
    ELSE
        RETURN 9.0; -- Default
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE VIEW FOR FEE ANALYTICS
CREATE OR REPLACE VIEW payment_links_with_fee_tiers AS
SELECT
    pl.*,
    get_fee_percentage(pl.service_amount_aed) as fee_percentage,
    CASE
        WHEN pl.service_amount_aed >= 1 AND pl.service_amount_aed <= 1999 THEN 'Tier 1 (1-1999 AED)'
        WHEN pl.service_amount_aed >= 2000 AND pl.service_amount_aed <= 4999 THEN 'Tier 2 (2000-4999 AED)'
        WHEN pl.service_amount_aed >= 5000 AND pl.service_amount_aed <= 100000 THEN 'Tier 3 (5000-100000 AED)'
        ELSE 'Other'
    END as fee_tier
FROM payment_links pl
WHERE pl.service_amount_aed IS NOT NULL;

-- 8. VERIFICATION QUERIES (for manual testing)
-- Show example calculations for each tier
SELECT
    'Example Calculations' as description,
    1500 as amount_aed,
    calculate_tiered_fee(1500) as calculated_fee,
    get_fee_percentage(1500) as fee_percentage_used
UNION ALL
SELECT
    'Example Calculations',
    3000,
    calculate_tiered_fee(3000),
    get_fee_percentage(3000)
UNION ALL
SELECT
    'Example Calculations',
    8000,
    calculate_tiered_fee(8000),
    get_fee_percentage(8000);

-- 9. SUCCESS MESSAGE
SELECT 'Tiered fee structure migration completed successfully. New structure: 9% (1-1999), 7.5% (2000-4999), 6% (5000-100000) AED' as status;