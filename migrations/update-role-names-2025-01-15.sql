-- Update role constraints to use simplified role names
-- Date: 2025-01-15
-- This migration updates role names to match UI changes

-- 1. Update role constraint to include new simplified role names
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'Staff', 'Model', 'Beauty Professional', 'Beauty Model'));

-- 2. Update existing Beauty Professional records to Staff
UPDATE users SET role = 'Staff' WHERE role = 'Beauty Professional';

-- 3. Update existing Beauty Model records to Model
UPDATE users SET role = 'Model' WHERE role = 'Beauty Model';

-- 4. Remove old role names from constraint (keep for rollback compatibility initially)
-- This will be done in a future migration after confirming all systems work

-- 5. Update any API endpoints or configurations that reference old role names
-- Note: This may require updates to:
-- - Payment creation endpoints
-- - User management code
-- - Email templates
-- - Any role-based authorization logic

COMMENT ON CONSTRAINT users_role_check ON users IS 'Updated 2025-01-15: Supports both old and new role names during transition';