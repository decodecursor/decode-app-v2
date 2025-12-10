-- Fix RLS policy for beauty_businesses to allow public viewing
-- Business info is displayed publicly on auction cards, so SELECT should be public
-- INSERT/UPDATE/DELETE remain restricted to business owners

-- Drop all existing SELECT policies
DROP POLICY IF EXISTS "Users can view own businesses" ON beauty_businesses;
DROP POLICY IF EXISTS "Users can view own or linked businesses" ON beauty_businesses;

-- Create simple public read policy
-- Businesses linked to auctions are public information shown on auction cards
CREATE POLICY "Anyone can view businesses" ON beauty_businesses
    FOR SELECT USING (true);
