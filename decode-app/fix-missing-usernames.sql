-- Fix missing user names for existing users
-- This script updates any users without a user_name to use their email prefix

UPDATE users
SET user_name = SPLIT_PART(email, '@', 1)
WHERE user_name IS NULL OR user_name = '';

-- Show affected users
SELECT id, email, user_name, company_name, role
FROM users
WHERE user_name = SPLIT_PART(email, '@', 1);