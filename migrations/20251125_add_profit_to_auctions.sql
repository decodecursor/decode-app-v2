-- Migration: Add Profit Columns to Auctions Table
-- Date: 2025-11-25
-- Description: Adds profit, platform fee, and model payout columns to auctions table for simplified payout tracking

ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS model_payout_amount DECIMAL(10, 2) DEFAULT 0;

UPDATE auctions
SET
  profit_amount = GREATEST(CAST(auction_current_price AS DECIMAL) - CAST(auction_start_price AS DECIMAL), 0),
  platform_fee_amount = GREATEST(CAST(auction_current_price AS DECIMAL) - CAST(auction_start_price AS DECIMAL), 0) * 0.25,
  model_payout_amount = CAST(auction_current_price AS DECIMAL) - (GREATEST(CAST(auction_current_price AS DECIMAL) - CAST(auction_start_price AS DECIMAL), 0) * 0.25)
WHERE status IN ('completed', 'ended')
AND auction_current_price > 0;

COMMENT ON COLUMN auctions.profit_amount IS 'Profit from auction (auction_current_price - auction_start_price)';
COMMENT ON COLUMN auctions.platform_fee_amount IS 'Platform fee (25% of profit)';
COMMENT ON COLUMN auctions.model_payout_amount IS 'Amount model receives (auction_current_price - platform_fee)';
