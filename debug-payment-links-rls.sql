-- Debug Payment Links RLS Issues
-- Run these queries in Supabase SQL Editor to diagnose the problem

-- 1. Check existing policies on payment_links table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'payment_links'
ORDER BY policyname;

-- 2. Check if anon role has SELECT permission
SELECT has_table_privilege('anon', 'public.payment_links', 'SELECT') as has_select;

-- 3. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'payment_links';

-- 4. Test query as anon role (simulates what the app does)
SET ROLE anon;
SELECT count(*) FROM payment_links WHERE is_active = true;
RESET ROLE;

-- 5. Check a specific payment link (replace with your actual link ID)
-- First as superuser
SELECT id, title, is_active, creator_id FROM payment_links LIMIT 5;

-- Then as anon
SET ROLE anon;
SELECT id, title, is_active FROM payment_links LIMIT 5;
RESET ROLE;

-- 6. TEMPORARY FIX: Disable RLS (WARNING: Only for testing!)
-- This removes ALL access control - use only to confirm RLS is the issue
-- ALTER TABLE payment_links DISABLE ROW LEVEL SECURITY;

-- 7. After testing, RE-ENABLE RLS immediately:
-- ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- 8. Alternative: Grant anon role explicit access
-- This might be needed if policies aren't working
GRANT SELECT ON payment_links TO anon;

-- 9. Check if the policies we added earlier actually exist
SELECT COUNT(*) as policy_count 
FROM pg_policies 
WHERE tablename = 'payment_links' 
  AND policyname IN ('Public can view active payment links', 'Users can view own payment links');