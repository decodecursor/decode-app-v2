-- Fix RLS policy for beauty_businesses to allow viewing of businesses linked to auctions
-- This resolves the issue where business avatars weren't displaying on auction cards
-- because the overly restrictive policy only allowed viewing own businesses

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own businesses" ON beauty_businesses;

-- Create new policy allowing viewing of:
-- 1. Own businesses (creator_id matches auth.uid())
-- 2. Businesses linked to auctions (publicly visible since auctions are public)
CREATE POLICY "Users can view own or linked businesses" ON beauty_businesses
    FOR SELECT USING (
        auth.uid()::text = creator_id::text
        OR
        EXISTS (
            SELECT 1 FROM auctions
            WHERE auctions.linked_business_id = beauty_businesses.id
        )
    );
