-- Fix Payment Links Public Access Issue
-- This fixes the "Payment link not found" error by allowing public access to active payment links

-- Add policy to allow public viewing of active payment links
-- This is necessary because buyers accessing payment links are typically not authenticated
CREATE POLICY "Public can view active payment links" ON payment_links
    FOR SELECT USING (is_active = true);

-- Also need to allow public to view basic creator information
-- This fixes the foreign key join issue when fetching creator data
CREATE POLICY "Public can view basic user info for payment creators" ON users
    FOR SELECT USING (
        id IN (
            SELECT creator_id FROM payment_links WHERE is_active = true
        )
    );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('payment_links', 'users')
ORDER BY tablename, policyname;