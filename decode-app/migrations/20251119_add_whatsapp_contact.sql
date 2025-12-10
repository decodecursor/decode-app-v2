-- Migration: Add WhatsApp contact method support for bids
-- Date: 2025-11-19
-- Purpose: Allow bidders to choose WhatsApp OR Email for notifications

-- Add contact_method column to bids table
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS contact_method VARCHAR(10) DEFAULT 'email'
CHECK (contact_method IN ('whatsapp', 'email'));

-- Add whatsapp_number column to bids table
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);

-- Create index for faster WhatsApp number lookups
CREATE INDEX IF NOT EXISTS idx_bids_whatsapp_number
ON bids(whatsapp_number);

-- Add comments for documentation
COMMENT ON COLUMN bids.contact_method IS
'Preferred contact method: whatsapp or email';

COMMENT ON COLUMN bids.whatsapp_number IS
'WhatsApp number with country code (e.g., +971501234567) if contact_method is whatsapp';

-- Note: bidder_email column remains for backward compatibility
-- For WhatsApp bids, bidder_email may contain a placeholder like 'whatsapp:+971501234567'
