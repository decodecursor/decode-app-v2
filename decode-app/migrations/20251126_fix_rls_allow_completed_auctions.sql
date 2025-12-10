-- Allow unauthenticated users to view completed auctions
-- This fixes the issue where guest bidders cannot see past auctions
-- on the detailed auction page (HistoricalLeaderboards component)

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view active auctions" ON auctions;

-- Recreate with 'completed' status included
CREATE POLICY "Anyone can view active and completed auctions"
    ON auctions FOR SELECT
    USING (status IN ('pending', 'active', 'ended', 'completed'));
