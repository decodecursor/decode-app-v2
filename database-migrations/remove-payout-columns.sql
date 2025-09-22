-- Remove unnecessary columns from payouts table
-- Run this SQL in your Supabase SQL Editor
-- Note: Keeping status column for now as it's used for filtering

ALTER TABLE payouts
DROP COLUMN IF EXISTS period_start,
DROP COLUMN IF EXISTS period_end,
DROP COLUMN IF EXISTS scheduled_for;

-- Success message
SELECT 'Removed unnecessary columns from payouts table successfully!' as message;