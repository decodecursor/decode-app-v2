-- Migration: Add support for custom short IDs in payment_links table
-- This allows both short IDs (8 chars) and UUIDs (36 chars) for backward compatibility

-- First, let's modify the id column to allow custom values
-- We need to change from UUID with DEFAULT gen_random_uuid() to TEXT
-- This is a breaking change, so we'll create a new column and migrate data

-- Step 1: Add new id column as TEXT (temporary)
ALTER TABLE payment_links ADD COLUMN new_id TEXT;

-- Step 2: Populate new_id with existing UUID values
UPDATE payment_links SET new_id = id::text;

-- Step 3: Make new_id NOT NULL and create index
ALTER TABLE payment_links ALTER COLUMN new_id SET NOT NULL;
CREATE UNIQUE INDEX CONCURRENTLY payment_links_new_id_idx ON payment_links(new_id);

-- Step 4: Drop the old primary key constraint and create new one
-- Note: This requires updating all foreign key references
ALTER TABLE payment_links DROP CONSTRAINT payment_links_pkey;
ALTER TABLE payment_links ADD CONSTRAINT payment_links_pkey PRIMARY KEY USING INDEX payment_links_new_id_idx;

-- Step 5: Drop the old id column and rename new_id to id
ALTER TABLE payment_links DROP COLUMN id;
ALTER TABLE payment_links RENAME COLUMN new_id TO id;

-- Update any foreign key constraints that reference this table
-- (Check your schema for other tables that might reference payment_links.id)

-- Add a check constraint to ensure IDs are either valid short IDs or UUIDs
ALTER TABLE payment_links ADD CONSTRAINT valid_payment_link_id 
CHECK (
  -- 8-character hex (short ID)
  id ~ '^[0-9A-Fa-f]{8}$' 
  OR 
  -- Standard UUID format
  id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
);

-- Add comment for documentation
COMMENT ON COLUMN payment_links.id IS 'Payment link ID: 8-character hex (new format) or UUID (legacy format)';