-- Migration: Remove outdated auth trigger that conflicts with current schema
-- Date: 2025-01-10
-- Issue: Auth trigger tries to insert with wrong columns causing "Database error saving new user"

-- Drop the outdated trigger that auto-creates user records
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the outdated function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Comment explaining why we removed it
-- The handle_new_user trigger was creating records with wrong column names:
-- - Used 'full_name' instead of 'user_name'
-- - Didn't provide required 'company_name'
-- - Used outdated role 'Beauty Professional'
-- User creation is now handled by the RoleSelectionModal after signup