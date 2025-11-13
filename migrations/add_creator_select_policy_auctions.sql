-- Add Creator SELECT Policy for Auctions
-- Migration to allow auction creators to read their own auctions
-- Date: 2025-11-02
-- Issue: Auction returns 404 immediately after creation due to RLS blocking SELECT

-- Add policy to allow creators to view their own auctions
CREATE POLICY "Creators can view own auctions"
    ON auctions FOR SELECT
    USING (auth.uid() = creator_id);

-- This works alongside the existing "Anyone can view active auctions" policy
-- RLS policies are OR-based, so if either policy allows, the SELECT succeeds
