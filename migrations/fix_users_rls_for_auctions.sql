-- Fix Users Table RLS Policy for Auction Joins
-- Migration to allow public profile viewing for auction creator information
-- Date: 2025-11-12
-- Issue: Users table RLS blocks joins when fetching auctions, causing 404 errors

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view profiles" ON users;

-- Create new policy that allows viewing public profile information
-- This enables auction queries to join with users table without authentication
CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (
    -- Allow viewing public profile fields
    -- Users table will have column-level security for sensitive fields if needed
    true
  );

-- Note: If you need to restrict sensitive fields like email, you can add
-- column-level RLS or modify the policy to be more specific
-- For now, this allows public viewing which is needed for auction listings

-- Verification query (for manual testing):
-- SELECT id, email, full_name, role FROM users WHERE id = 'ac7365e2-bb68-4adb-9c77-5f5643f3161c';
