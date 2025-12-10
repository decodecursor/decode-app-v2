-- Fix missing Main Branch entries for admin companies
-- Run this to ensure ALL admin companies have Main Branch entries

-- First, let's see what admin companies exist without Main Branch
-- (This is just for verification - remove if running in production)
SELECT
    u.company_name as admin_company,
    COUNT(u.id) as admin_count,
    CASE WHEN b.company_name IS NULL THEN 'MISSING Main Branch' ELSE 'Has Main Branch' END as branch_status
FROM users u
LEFT JOIN branches b ON (b.company_name = u.company_name AND b.name = 'Main Branch')
WHERE u.role = 'Admin'
    AND u.company_name IS NOT NULL
    AND u.company_name != ''
GROUP BY u.company_name, b.company_name
ORDER BY u.company_name;

-- Now create the missing Main Branch entries
INSERT INTO branches (name, company_name)
SELECT DISTINCT 'Main Branch', company_name
FROM users
WHERE role = 'Admin'
    AND company_name IS NOT NULL
    AND company_name != ''
    -- Only create if the branch doesn't already exist for this company
    AND NOT EXISTS (
        SELECT 1 FROM branches
        WHERE branches.name = 'Main Branch'
        AND branches.company_name = users.company_name
    );

-- Verify the fix worked
SELECT
    u.company_name as admin_company,
    COUNT(u.id) as admin_count,
    CASE WHEN b.company_name IS NULL THEN 'MISSING Main Branch' ELSE 'Has Main Branch' END as branch_status
FROM users u
LEFT JOIN branches b ON (b.company_name = u.company_name AND b.name = 'Main Branch')
WHERE u.role = 'Admin'
    AND u.company_name IS NOT NULL
    AND u.company_name != ''
GROUP BY u.company_name, b.company_name
ORDER BY u.company_name;