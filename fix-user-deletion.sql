-- Safe User Deletion Fix - Creates deleted user instead of NULL creator_id
-- This approach preserves referential integrity and doesn't break the application

BEGIN;

-- 1) Create a system "deleted user" record to preserve referential integrity
INSERT INTO users (
    id,
    email,
    user_name,
    company_name,
    role,
    approval_status,
    created_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'deleted@system.internal',
    'Deleted User',
    'System',
    'Admin',
    'approved',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2) Update orphaned payment links to point to the deleted user
-- This preserves all payment link history while indicating the creator was deleted
UPDATE payment_links
SET creator_id = '00000000-0000-0000-0000-000000000000'
WHERE creator_id NOT IN (
    SELECT id FROM users
    WHERE id != '00000000-0000-0000-0000-000000000000'
);

-- 3) Optional: Add a trigger to automatically point to deleted user on user deletion
-- This ensures future user deletions automatically preserve payment links
CREATE OR REPLACE FUNCTION handle_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Point orphaned payment links to deleted user
    UPDATE payment_links
    SET creator_id = '00000000-0000-0000-0000-000000000000'
    WHERE creator_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS on_user_delete ON users;
CREATE TRIGGER on_user_delete
    BEFORE DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_deletion();

COMMIT;

-- After running this script, you can safely delete users from Supabase
-- Their payment links will be preserved and show "Deleted User" as the creator