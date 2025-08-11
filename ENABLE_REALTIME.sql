-- Enable real-time replication for the users table
-- Run this in your Supabase SQL editor

-- Enable replication on the users table
ALTER TABLE users REPLICA IDENTITY FULL;

-- Enable real-time on the users table (if not already enabled)
-- This should be done via the Supabase Dashboard > Database > Replication
-- Or via this SQL command:
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Verify replication is enabled
SELECT 
    schemaname,
    tablename,
    attname,
    atttypid::regtype
FROM 
    pg_publication_tables 
WHERE 
    pubname = 'supabase_realtime' 
    AND tablename = 'users';