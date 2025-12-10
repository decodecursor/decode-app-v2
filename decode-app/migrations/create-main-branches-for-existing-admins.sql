-- Create Main Branch entries for existing admin users
-- This fixes the issue where existing admin users don't have branches

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