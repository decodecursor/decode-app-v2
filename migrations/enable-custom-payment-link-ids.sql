-- SAFER Migration: Enable custom payment link IDs with backward compatibility
-- This approach is safer for production as it doesn't require dropping/recreating primary keys

-- Check if we need to modify the table structure
-- If the id column is already TEXT, skip this migration

DO $$
BEGIN
    -- Check if id column is UUID type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_links' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        -- Change id column from UUID to TEXT to allow custom IDs
        -- This preserves existing data and allows new short IDs
        ALTER TABLE payment_links ALTER COLUMN id TYPE TEXT USING id::text;
        
        -- Remove the default UUID generation since we'll handle it in the application
        ALTER TABLE payment_links ALTER COLUMN id DROP DEFAULT;
        
        RAISE NOTICE 'Payment links table updated to support custom IDs';
    ELSE
        RAISE NOTICE 'Payment links table already supports custom IDs';
    END IF;
END $$;

-- Add a check constraint to ensure IDs are either valid short IDs or UUIDs
-- Drop existing constraint if it exists
ALTER TABLE payment_links DROP CONSTRAINT IF EXISTS valid_payment_link_id;

-- Add the constraint
ALTER TABLE payment_links ADD CONSTRAINT valid_payment_link_id 
CHECK (
  -- 8-character hex (short ID) - case insensitive
  id ~* '^[0-9A-F]{8}$' 
  OR 
  -- Standard UUID format - case insensitive
  id ~* '^[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$'
);

-- Add index if it doesn't exist (for performance)
CREATE INDEX IF NOT EXISTS payment_links_id_idx ON payment_links(id);

-- Add comment for documentation
COMMENT ON COLUMN payment_links.id IS 'Payment link ID: 8-character hex (new short format) or UUID (legacy format). New links use 8-char format for better UX.';