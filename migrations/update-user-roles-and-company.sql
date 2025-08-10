-- Migration: Update user roles and add company name field
-- Date: 2024-08-10
-- Description: Updates user roles from Beauty Professional/Beauty Model to Admin/User and adds company_name field

-- Add company_name column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Update role constraint to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('Beauty Professional', 'Beauty Model', 'Admin', 'User'));

-- Update existing role data
UPDATE users SET role = 'Admin' WHERE role = 'Beauty Professional';
UPDATE users SET role = 'User' WHERE role = 'Beauty Model';

-- Remove old role values from constraint after data migration
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('Admin', 'User'));

-- Make company_name required for new records (allow NULL for existing records during transition)
-- Note: You may want to populate company_name for existing users before making it NOT NULL