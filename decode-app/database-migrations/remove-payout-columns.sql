-- Remove unnecessary columns from payouts table
-- Run this SQL in your Supabase SQL Editor
-- IMPORTANT: Keeping status column as it's critical for system functionality

-- Remove only the unused legacy columns for scheduled payouts
ALTER TABLE payouts
DROP COLUMN IF EXISTS period_start,
DROP COLUMN IF EXISTS period_end,
DROP COLUMN IF EXISTS scheduled_for;

-- Remove any indexes that might exist on these columns
DROP INDEX IF EXISTS idx_payouts_scheduled_for;
DROP INDEX IF EXISTS idx_payouts_period_start;
DROP INDEX IF EXISTS idx_payouts_period_end;

-- Verify the columns were removed
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payouts'
  AND column_name IN ('period_start', 'period_end', 'scheduled_for')
ORDER BY column_name;

-- Success message
SELECT 'Removed unused payout columns (period_start, period_end, scheduled_for) successfully! Status column preserved.' as message;