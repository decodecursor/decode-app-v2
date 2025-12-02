-- Fix RLS policy to allow public viewing of beauty businesses
-- Business profiles are promotional (salons/spas advertising), so should be publicly viewable
-- This fixes the issue where auctions with linked businesses were not displaying

-- Drop the old restrictive policy that only allows users to view their own businesses
DROP POLICY IF EXISTS "Users can view own businesses" ON beauty_businesses;

-- Allow anyone to view all businesses (public read access)
-- Business information is promotional by nature and benefits from public visibility
CREATE POLICY "Anyone can view businesses" ON beauty_businesses
    FOR SELECT
    USING (true);

-- Note: Write operations (INSERT, UPDATE, DELETE) remain restricted to business owners
-- These policies already exist and are unchanged:
-- - "Users can insert own businesses"
-- - "Users can update own businesses"
-- - "Users can delete own businesses"
