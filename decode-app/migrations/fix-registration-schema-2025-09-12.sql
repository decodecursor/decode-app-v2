-- CRITICAL FIX: User Registration Schema Issues
-- Date: 2025-09-12
-- This migration fixes all schema conflicts preventing user registration

-- 1. Remove any existing auth triggers that auto-create user records
-- These cause conflicts with manual profile creation in RoleSelectionModal
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Ensure users table has correct schema for registration flow
-- Add missing columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- 3. Update role constraints to match current app requirements
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('Admin', 'Staff', 'Beauty Professional', 'Beauty Model'));

-- 4. Make sure email is unique and not null
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);

-- 5. Update RLS policies to work with email-based profile creation
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (
    -- Allow insert if user ID matches auth user OR if creating by email for verified users
    auth.uid()::text = id::text OR 
    (auth.uid() IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- 6. Allow reading user profiles for authenticated users (needed for profile checks)
DROP POLICY IF EXISTS "Users can view profiles" ON users;
CREATE POLICY "Users can view profiles" ON users
  FOR SELECT USING (
    -- Users can see their own profile or any profile if they're authenticated
    auth.uid() IS NOT NULL
  );

-- 7. Create index for faster profile lookups during registration
CREATE INDEX IF NOT EXISTS users_email_lookup_idx ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_approval_status_idx ON users(approval_status);

-- 8. Add comment explaining the registration flow
COMMENT ON TABLE users IS 'User profiles created via RoleSelectionModal after Supabase Auth signup. No auto-trigger - manual creation only.';

-- 9. Verify the schema is correct
DO $$
BEGIN
    -- Check that required columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_name') THEN
        RAISE EXCEPTION 'Missing user_name column in users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'company_name') THEN
        RAISE EXCEPTION 'Missing company_name column in users table';
    END IF;
    
    RAISE NOTICE 'User registration schema fix completed successfully';
END $$;