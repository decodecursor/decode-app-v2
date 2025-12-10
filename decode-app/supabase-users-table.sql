-- Create Users table for DECODE app
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    user_name TEXT NOT NULL,
    professional_center_name TEXT,
    instagram_handle TEXT UNIQUE,
    wallet_address TEXT,
    company_name TEXT NOT NULL,
    branch_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'User')),
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    terms_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only read/update their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Create policy for inserting new users (typically handled by auth trigger)
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id::text);