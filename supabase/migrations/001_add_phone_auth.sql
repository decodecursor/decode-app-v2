-- Migration: Add phone authentication support
-- Date: 2025-11-20
-- Description: Adds phone_number column to users table for WhatsApp OTP authentication

-- Add phone_number column to users table (E.164 format: +971501234567)
ALTER TABLE users
ADD COLUMN phone_number TEXT UNIQUE;

-- Add index for phone number lookups
CREATE INDEX idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.phone_number IS 'Phone number in E.164 format (e.g., +971501234567). Used for WhatsApp OTP authentication. Either email or phone_number must be provided.';

-- Update email constraint to allow NULL (since users can auth with phone instead)
ALTER TABLE users
ALTER COLUMN email DROP NOT NULL;

-- Add check constraint to ensure at least one contact method exists
ALTER TABLE users
ADD CONSTRAINT check_contact_method
CHECK (email IS NOT NULL OR phone_number IS NOT NULL);
