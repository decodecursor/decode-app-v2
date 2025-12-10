-- Migration: Create OTP verifications table
-- Date: 2025-11-20
-- Description: Stores OTP codes for WhatsApp authentication with expiration and rate limiting

CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_identifier TEXT NOT NULL,  -- Email or phone number
    otp_code TEXT NOT NULL,          -- 6-digit OTP code
    type TEXT NOT NULL CHECK (type IN ('email', 'whatsapp')),
    expires_at TIMESTAMPTZ NOT NULL, -- OTP expires after 5 minutes
    attempts INTEGER DEFAULT 0,      -- Track failed verification attempts
    used BOOLEAN DEFAULT FALSE,      -- Ensure one-time use
    locked_until TIMESTAMPTZ,        -- Brute force protection lockout
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure only one active OTP per user_identifier at a time
    CONSTRAINT unique_active_otp UNIQUE (user_identifier, type)
);

-- Index for fast lookups during verification
CREATE INDEX idx_otp_user_identifier ON otp_verifications(user_identifier);

-- Index for cleaning up expired OTPs
CREATE INDEX idx_otp_expires_at ON otp_verifications(expires_at);

-- Enable Row Level Security
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authenticated users can read their own OTP records (for debugging)
CREATE POLICY "Users can view own OTP records" ON otp_verifications
    FOR SELECT USING (user_identifier = (SELECT email FROM auth.users WHERE id = auth.uid())
                      OR user_identifier = (SELECT phone FROM auth.users WHERE id = auth.uid()));

-- RLS Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role full access" ON otp_verifications
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Function to clean up expired OTPs (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_verifications
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE otp_verifications IS 'Stores OTP codes for email magic link and WhatsApp authentication';
COMMENT ON COLUMN otp_verifications.user_identifier IS 'Email address or phone number in E.164 format';
COMMENT ON COLUMN otp_verifications.otp_code IS 'Six-digit numeric code for authentication';
COMMENT ON COLUMN otp_verifications.attempts IS 'Number of failed verification attempts (max 5 before lockout)';
COMMENT ON COLUMN otp_verifications.locked_until IS 'Timestamp until which the user_identifier is locked after too many failed attempts';
