-- Migration: Add Payment Method Storage to Guest Bidders
-- Date: 2025-01-23
-- Description: Adds columns to store default payment method for guest bidders

-- ============================================================================
-- ADD PAYMENT METHOD COLUMNS TO GUEST_BIDDERS TABLE
-- ============================================================================

-- Add default payment method ID column (Stripe payment method token)
ALTER TABLE guest_bidders
ADD COLUMN IF NOT EXISTS default_payment_method_id VARCHAR(255);

-- Add timestamp for when payment method was last saved
ALTER TABLE guest_bidders
ADD COLUMN IF NOT EXISTS last_payment_method_saved_at TIMESTAMPTZ;

-- Create index for faster payment method lookups
CREATE INDEX IF NOT EXISTS idx_guest_bidders_payment_method
ON guest_bidders(default_payment_method_id)
WHERE default_payment_method_id IS NOT NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN guest_bidders.default_payment_method_id IS 'Stripe PaymentMethod ID (pm_xxx) for saved card - tokenized, PCI compliant';
COMMENT ON COLUMN guest_bidders.last_payment_method_saved_at IS 'Timestamp when payment method was last saved/updated';
