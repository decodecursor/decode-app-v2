-- SQL to delete user sebastianlucht@live.de from Supabase
-- Run this in Supabase SQL Editor

-- First, delete from public.users table (if exists)
DELETE FROM public.users 
WHERE email = 'sebastianlucht@live.de';

-- Then delete from auth.users (this will cascade to other auth tables)
DELETE FROM auth.users 
WHERE email = 'sebastianlucht@live.de';

-- Optional: Check if user was deleted successfully
-- SELECT * FROM auth.users WHERE email = 'sebastianlucht@live.de';
-- SELECT * FROM public.users WHERE email = 'sebastianlucht@live.de';