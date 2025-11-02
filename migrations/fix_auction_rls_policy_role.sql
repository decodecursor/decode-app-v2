-- Fix Auction RLS Policy Role Mismatch
-- Migration to update auction creation RLS policy to use correct role value
-- Date: 2025-11-02
-- Issue: RLS policy checks for 'Beauty Model' but actual role is 'Model'

-- Drop the existing policy
DROP POLICY IF EXISTS "MODEL users can create auctions" ON auctions;

-- Recreate the policy with the correct role value
CREATE POLICY "MODEL users can create auctions"
    ON auctions FOR INSERT
    WITH CHECK (
        auth.uid() = creator_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'Model'  -- Fixed: changed from 'Beauty Model' to 'Model'
        )
    );

-- Verification query (for manual testing)
-- SELECT * FROM users WHERE id = auth.uid() AND role = 'Model';
