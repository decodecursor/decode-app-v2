-- MIGRATION: Update DECODE to New 8-Tier Fee Structure
-- Implements new fee tiers:
-- AED 5-999: 7%
-- AED 1,000-2,499: 6%
-- AED 2,500-4,999: 5%
-- AED 5,000-9,999: 4%
-- AED 10,000-24,999: 3.5%
-- AED 25,000-49,999: 3.4%
-- AED 50,000-74,999: 3.3%
-- AED 75,000-100,000: 3.2%

-- 1. REMOVE EXISTING TIERED FEE CONSTRAINT
ALTER TABLE payment_links DROP CONSTRAINT IF EXISTS check_tiered_fee_calculation;

-- 2. UPDATE FUNCTION FOR 8-TIER FEE CALCULATION
CREATE OR REPLACE FUNCTION calculate_tiered_fee(amount_aed DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF amount_aed >= 5 AND amount_aed <= 999 THEN
        RETURN ROUND(amount_aed * 0.07, 2); -- 7%
    ELSIF amount_aed >= 1000 AND amount_aed <= 2499 THEN
        RETURN ROUND(amount_aed * 0.06, 2); -- 6%
    ELSIF amount_aed >= 2500 AND amount_aed <= 4999 THEN
        RETURN ROUND(amount_aed * 0.05, 2); -- 5%
    ELSIF amount_aed >= 5000 AND amount_aed <= 9999 THEN
        RETURN ROUND(amount_aed * 0.04, 2); -- 4%
    ELSIF amount_aed >= 10000 AND amount_aed <= 24999 THEN
        RETURN ROUND(amount_aed * 0.035, 2); -- 3.5%
    ELSIF amount_aed >= 25000 AND amount_aed <= 49999 THEN
        RETURN ROUND(amount_aed * 0.034, 2); -- 3.4%
    ELSIF amount_aed >= 50000 AND amount_aed <= 74999 THEN
        RETURN ROUND(amount_aed * 0.033, 2); -- 3.3%
    ELSIF amount_aed >= 75000 AND amount_aed <= 100000 THEN
        RETURN ROUND(amount_aed * 0.032, 2); -- 3.2%
    ELSE
        -- Default to 7% for amounts outside defined ranges
        RETURN ROUND(amount_aed * 0.07, 2);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. UPDATE EXISTING PAYMENT LINKS TO USE NEW 8-TIER FEE STRUCTURE
UPDATE payment_links
SET
    -- Recalculate decode_amount_aed using new 8-tier structure
    decode_amount_aed = calculate_tiered_fee(service_amount_aed),
    -- Recalculate total_amount_aed with new fee
    total_amount_aed = service_amount_aed + calculate_tiered_fee(service_amount_aed),
    updated_at = NOW()
WHERE service_amount_aed IS NOT NULL;

-- 4. ADD NEW CONSTRAINT FOR 8-TIER FEE VALIDATION
ALTER TABLE payment_links
ADD CONSTRAINT check_8_tier_fee_calculation
CHECK (
    service_amount_aed IS NULL OR
    ABS(decode_amount_aed - calculate_tiered_fee(service_amount_aed)) < 0.01
);

-- 5. UPDATE COLUMN COMMENTS
COMMENT ON COLUMN payment_links.decode_amount_aed IS 'DECODE platform amount (8-tier: 7% for 5-999, 6% for 1000-2499, 5% for 2500-4999, 4% for 5000-9999, 3.5% for 10000-24999, 3.4% for 25000-49999, 3.3% for 50000-74999, 3.2% for 75000-100000 AED)';
COMMENT ON COLUMN payment_links.service_amount_aed IS 'Original service amount before 8-tier marketplace fee';

-- 6. UPDATE FUNCTION TO GET FEE PERCENTAGE FOR REPORTING
CREATE OR REPLACE FUNCTION get_fee_percentage(amount_aed DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF amount_aed >= 5 AND amount_aed <= 999 THEN
        RETURN 7.0;
    ELSIF amount_aed >= 1000 AND amount_aed <= 2499 THEN
        RETURN 6.0;
    ELSIF amount_aed >= 2500 AND amount_aed <= 4999 THEN
        RETURN 5.0;
    ELSIF amount_aed >= 5000 AND amount_aed <= 9999 THEN
        RETURN 4.0;
    ELSIF amount_aed >= 10000 AND amount_aed <= 24999 THEN
        RETURN 3.5;
    ELSIF amount_aed >= 25000 AND amount_aed <= 49999 THEN
        RETURN 3.4;
    ELSIF amount_aed >= 50000 AND amount_aed <= 74999 THEN
        RETURN 3.3;
    ELSIF amount_aed >= 75000 AND amount_aed <= 100000 THEN
        RETURN 3.2;
    ELSE
        RETURN 7.0; -- Default
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. UPDATE VIEW FOR FEE ANALYTICS
CREATE OR REPLACE VIEW payment_links_with_fee_tiers AS
SELECT
    pl.*,
    get_fee_percentage(pl.service_amount_aed) as fee_percentage,
    CASE
        WHEN pl.service_amount_aed >= 5 AND pl.service_amount_aed <= 999 THEN 'Tier 1 (5-999 AED) - 7%'
        WHEN pl.service_amount_aed >= 1000 AND pl.service_amount_aed <= 2499 THEN 'Tier 2 (1000-2499 AED) - 6%'
        WHEN pl.service_amount_aed >= 2500 AND pl.service_amount_aed <= 4999 THEN 'Tier 3 (2500-4999 AED) - 5%'
        WHEN pl.service_amount_aed >= 5000 AND pl.service_amount_aed <= 9999 THEN 'Tier 4 (5000-9999 AED) - 4%'
        WHEN pl.service_amount_aed >= 10000 AND pl.service_amount_aed <= 24999 THEN 'Tier 5 (10000-24999 AED) - 3.5%'
        WHEN pl.service_amount_aed >= 25000 AND pl.service_amount_aed <= 49999 THEN 'Tier 6 (25000-49999 AED) - 3.4%'
        WHEN pl.service_amount_aed >= 50000 AND pl.service_amount_aed <= 74999 THEN 'Tier 7 (50000-74999 AED) - 3.3%'
        WHEN pl.service_amount_aed >= 75000 AND pl.service_amount_aed <= 100000 THEN 'Tier 8 (75000-100000 AED) - 3.2%'
        ELSE 'Other'
    END as fee_tier
FROM payment_links pl
WHERE pl.service_amount_aed IS NOT NULL;

-- 8. VERIFICATION QUERIES (for manual testing)
-- Show example calculations for each tier
SELECT
    'Tier 1: AED 500' as description,
    500 as amount_aed,
    calculate_tiered_fee(500) as calculated_fee,
    get_fee_percentage(500) as fee_percentage_used
UNION ALL
SELECT 'Tier 2: AED 1,500', 1500, calculate_tiered_fee(1500), get_fee_percentage(1500)
UNION ALL
SELECT 'Tier 3: AED 3,000', 3000, calculate_tiered_fee(3000), get_fee_percentage(3000)
UNION ALL
SELECT 'Tier 4: AED 7,500', 7500, calculate_tiered_fee(7500), get_fee_percentage(7500)
UNION ALL
SELECT 'Tier 5: AED 15,000', 15000, calculate_tiered_fee(15000), get_fee_percentage(15000)
UNION ALL
SELECT 'Tier 6: AED 35,000', 35000, calculate_tiered_fee(35000), get_fee_percentage(35000)
UNION ALL
SELECT 'Tier 7: AED 60,000', 60000, calculate_tiered_fee(60000), get_fee_percentage(60000)
UNION ALL
SELECT 'Tier 8: AED 90,000', 90000, calculate_tiered_fee(90000), get_fee_percentage(90000);

-- 9. SUCCESS MESSAGE
SELECT '8-tier fee structure migration completed successfully. New structure: 7% (5-999), 6% (1000-2499), 5% (2500-4999), 4% (5000-9999), 3.5% (10000-24999), 3.4% (25000-49999), 3.3% (50000-74999), 3.2% (75000-100000) AED' as status;
