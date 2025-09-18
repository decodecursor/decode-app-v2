-- CRITICAL FIX: Database Role Constraint for Staff/Admin/Model
-- Date: 2025-09-18
-- This migration fixes the users_role_check constraint to match application code changes

-- The application was updated to use 'Staff' instead of 'User' but the database
-- constraint was not properly updated, causing registration failures.

-- 1. Update role constraint to match current application code
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'Staff', 'Model'));

-- 2. Update any existing legacy role data to match new role names
-- Convert 'User' to 'Staff' (if any exist)
UPDATE users SET role = 'Staff' WHERE role = 'User';

-- Convert 'Beauty Professional' to 'Staff' (if any exist)
UPDATE users SET role = 'Staff' WHERE role = 'Beauty Professional';

-- Convert 'Beauty Model' to 'Model' (if any exist)
UPDATE users SET role = 'Model' WHERE role = 'Beauty Model';

-- 3. Add comment explaining the current role constraint
COMMENT ON CONSTRAINT users_role_check ON users IS 'Updated 2025-09-18: Fixed constraint to match application code - supports Admin, Staff, Model only';

-- 4. Verify the constraint is working
DO $$
BEGIN
    -- Test that valid roles work
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'users_role_check'
        AND table_name = 'users'
    ) THEN
        RAISE EXCEPTION 'users_role_check constraint was not created properly';
    END IF;

    RAISE NOTICE 'Role constraint fix completed successfully. Valid roles: Admin, Staff, Model';
END $$;