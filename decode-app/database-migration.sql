-- =====================================
-- DECODE Beauty Platform - Column Rename Migration
-- =====================================
-- This script renames columns in user_bank_accounts table to better reflect business domain

-- IMPORTANT: Run this SQL in your Supabase SQL Editor
-- This will rename existing columns to match the new schema

BEGIN;

-- Rename account_holder_name to beneficiary_name
ALTER TABLE user_bank_accounts 
RENAME COLUMN account_holder_name TO beneficiary_name;

-- Rename account_number to iban_number  
ALTER TABLE user_bank_accounts 
RENAME COLUMN account_number TO iban_number;

-- Update column comments for clarity
COMMENT ON COLUMN user_bank_accounts.beneficiary_name IS 'Name of the beneficiary/account holder for business bank account';
COMMENT ON COLUMN user_bank_accounts.iban_number IS 'International Bank Account Number or account identifier';

COMMIT;

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_bank_accounts' 
  AND column_name IN ('beneficiary_name', 'iban_number')
ORDER BY column_name;