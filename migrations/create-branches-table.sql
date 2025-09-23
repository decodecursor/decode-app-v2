-- Create branches table if it doesn't exist
-- This table tracks company branches for user assignment

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique branch names per company
    UNIQUE(name, company_name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_branches_company_name ON branches(company_name);
CREATE INDEX IF NOT EXISTS idx_branches_name ON branches(name);

-- Enable Row Level Security
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for branches
-- Users can view branches for their company
CREATE POLICY IF NOT EXISTS "Users can view company branches" ON branches
    FOR SELECT USING (
        company_name IN (
            SELECT company_name FROM users
            WHERE id::text = auth.uid()::text
        )
    );

-- Admins can insert branches for their company
CREATE POLICY IF NOT EXISTS "Admins can create company branches" ON branches
    FOR INSERT WITH CHECK (
        company_name IN (
            SELECT company_name FROM users
            WHERE id::text = auth.uid()::text
            AND role = 'Admin'
        )
    );

-- Admins can update branches for their company
CREATE POLICY IF NOT EXISTS "Admins can update company branches" ON branches
    FOR UPDATE USING (
        company_name IN (
            SELECT company_name FROM users
            WHERE id::text = auth.uid()::text
            AND role = 'Admin'
        )
    );

-- Admins can delete branches for their company
CREATE POLICY IF NOT EXISTS "Admins can delete company branches" ON branches
    FOR DELETE USING (
        company_name IN (
            SELECT company_name FROM users
            WHERE id::text = auth.uid()::text
            AND role = 'Admin'
        )
    );

-- Add comment
COMMENT ON TABLE branches IS 'Company branches for organizing users within companies';

-- Grant permissions
GRANT ALL ON branches TO authenticated;
GRANT ALL ON branches TO service_role;