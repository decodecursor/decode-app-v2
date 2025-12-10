# Auction Fee Implementation - 25% Profit-Based Model

**Date:** 2025-11-20
**Status:** ✅ Code Complete - Migration Pending

## Summary

Successfully implemented a **25% profit-based fee model** for all auctions with clear column naming and a dedicated fee breakdown UI for MODEL creators.

### Fee Calculation Example

```
Starting Price (Base Service Cost): AED 2,000
Winning Bid: AED 3,000
Profit: AED 3,000 - AED 2,000 = AED 1,000
DECODE Fee (25% of profit): AED 1,000 × 25% = AED 250
Model Net Earnings: AED 3,000 - AED 250 = AED 2,750
```

**Special Case:** If profit = 0 (winning bid equals start price), then DECODE fee = 0.

---

## Changes Made

### 1. Database Schema Changes

**Migration File:** `migrations/20251120_auction_profit_based_fees.sql`

**Column Renames:**

| Table | Old Column | New Column |
|-------|-----------|------------|
| `auctions` | `start_price` | `auction_start_price` |
| `auctions` | `current_price` | `auction_current_price` |
| `auctions` | `buy_now_price` | `auction_buy_now_price` |
| `bids` | `amount` | `bid_amount` |
| `auction_payouts` | `gross_amount` | `auction_winning_amount` |
| `auction_payouts` | `platform_fee` | `auction_profit_decode_amount` |
| `auction_payouts` | `platform_fee_percentage` | `auction_profit_decode_percentage` |
| `auction_payouts` | `net_amount` | `auction_profit_model_amount` |

**New Column:**
- `auction_payouts.auction_profit_amount` (DECIMAL 10,2) - Stores calculated profit for reporting

### 2. Backend Updates

**Fee Calculation Logic Updated:**
- File: `lib/models/AuctionPayout.model.ts`
- Changed from: 10% flat fee on winning bid
- Changed to: **25% fee on profit** (profit = winning_bid - start_price)
- Zero profit = zero fee

**Files Modified:**
- ✅ `lib/models/Auction.model.ts` - Interface updated
- ✅ `lib/models/Bid.model.ts` - Interface updated
- ✅ `lib/models/AuctionPayout.model.ts` - Profit-based calculation
- ✅ `lib/services/AuctionService.ts` - Auction creation
- ✅ `lib/services/BiddingService.ts` - Bid placement
- ✅ `lib/payments/processors/AuctionPaymentSplitter.ts` - Fee calculation
- ✅ `lib/payments/processors/AuctionPaymentProcessor.ts` - Payment capture
- ✅ `app/api/auctions/create/route.ts` - Create API
- ✅ `app/api/auctions/[id]/bid/route.ts` - Bid API
- ✅ `app/api/auctions/[id]/leaderboard/route.ts` - Leaderboard API
- ✅ `app/api/auctions/cron/close-auctions/route.ts` - Cron closing
- ✅ `app/api/auctions/eventbridge/close/route.ts` - EventBridge closing

### 3. Frontend Updates

**New Component:**
- ✅ `components/auctions/AuctionFeeBreakdown.tsx` - Displays profit breakdown
  - Only visible to MODEL creator
  - Shows live estimates during auction
  - Shows final breakdown when completed

**Files Modified:**
- ✅ `app/auctions/[id]/AuctionDetailClient.tsx` - Integrated fee breakdown
- ✅ `components/auctions/BiddingInterface.tsx` - Bid submission
- ✅ `components/auctions/AuctionCard.tsx` - Auction listing cards
- ✅ `components/auctions/CreateAuctionModal.tsx` - Auction creation form
- ✅ `lib/hooks/useLeaderboard.ts` - Leaderboard realtime updates
- ✅ `lib/realtime/BidBroadcaster.ts` - Realtime bid broadcasting

---

## How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com/
2. Navigate to your project: **vdgjzaaxvstbouklgsft**
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `migrations/20251120_auction_profit_based_fees.sql`
6. Paste into the SQL editor
7. Click **Run** or press `Ctrl+Enter`
8. Verify success - you should see "Success. No rows returned"

### Option 2: Using psql (If you have PostgreSQL client)

```bash
# Get your database connection string from Supabase Dashboard
# Project Settings > Database > Connection String (Direct connection)

psql "postgresql://postgres:[YOUR-PASSWORD]@db.vdgjzaaxvstbouklgsft.supabase.co:5432/postgres" \
  -f migrations/20251120_auction_profit_based_fees.sql
```

### Option 3: Using Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref vdgjzaaxvstbouklgsft

# Run migration
supabase db push
```

---

## Migration Verification

After running the migration, verify with these queries:

```sql
-- Check auctions table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'auctions'
AND column_name LIKE 'auction_%';

-- Check auction_payouts table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'auction_payouts'
AND column_name LIKE 'auction_%';

-- Check bids table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bids'
AND column_name = 'bid_amount';
```

Expected results:
- `auctions`: auction_start_price, auction_current_price, auction_buy_now_price
- `auction_payouts`: auction_winning_amount, auction_profit_amount, auction_profit_decode_amount, auction_profit_decode_percentage, auction_profit_model_amount
- `bids`: bid_amount

---

## Testing Checklist

After migration, test the following:

### Backend Testing
- [ ] Create a new auction via API
- [ ] Place a bid on an auction
- [ ] View leaderboard updates in real-time
- [ ] Let an auction close (manually or wait)
- [ ] Verify payout record created with correct profit calculation

### Frontend Testing
- [ ] MODEL user creates auction - form works
- [ ] Bidder places bid - bidding interface works
- [ ] MODEL views auction detail page
- [ ] **Fee Breakdown Component displays correctly** (only for MODEL creator)
- [ ] Leaderboard updates in real-time
- [ ] Auction cards display correct prices

### Fee Calculation Testing

Test these scenarios:

**Scenario 1: Profit exists**
```
Start Price: AED 1,000
Winning Bid: AED 1,500
Expected Profit: AED 500
Expected DECODE Fee: AED 125 (25% of 500)
Expected Model Earnings: AED 1,375
```

**Scenario 2: No profit (edge case)**
```
Start Price: AED 1,000
Winning Bid: AED 1,000
Expected Profit: AED 0
Expected DECODE Fee: AED 0
Expected Model Earnings: AED 1,000
```

**Scenario 3: Your example**
```
Start Price: AED 2,000
Winning Bid: AED 3,000
Expected Profit: AED 1,000
Expected DECODE Fee: AED 250 (25% of 1,000)
Expected Model Earnings: AED 2,750
```

---

## UI Changes - Fee Breakdown Display

The new `AuctionFeeBreakdown` component displays on the auction detail page:

**Visibility:** Only shown to the MODEL creator who created the auction

**Display Location:** Below the auction timer, above the leaderboard

**Information Shown:**
1. Auction Start Price (Base Service Cost)
2. Current Highest Bid / Winning Bid
3. Profit (Bid - Start Price)
4. DECODE Auction Fee (25% of profit)
5. **Your Net Earnings** (highlighted in green)

**Dynamic Behavior:**
- During active auction: Shows "Estimated Earnings" based on current bid
- After auction closes: Shows "Final Earnings Breakdown"
- Includes detailed calculation breakdown when completed

---

## Rollback Plan

If you need to rollback this migration:

```sql
-- Rollback script (reverses all changes)
ALTER TABLE auctions RENAME COLUMN auction_start_price TO start_price;
ALTER TABLE auctions RENAME COLUMN auction_current_price TO current_price;
ALTER TABLE auctions RENAME COLUMN auction_buy_now_price TO buy_now_price;

ALTER TABLE bids RENAME COLUMN bid_amount TO amount;

ALTER TABLE auction_payouts RENAME COLUMN auction_winning_amount TO gross_amount;
ALTER TABLE auction_payouts RENAME COLUMN auction_profit_decode_amount TO platform_fee;
ALTER TABLE auction_payouts RENAME COLUMN auction_profit_decode_percentage TO platform_fee_percentage;
ALTER TABLE auction_payouts RENAME COLUMN auction_profit_model_amount TO net_amount;
ALTER TABLE auction_payouts DROP COLUMN auction_profit_amount;

-- Update fee percentage back to 10% in code
-- Change DEFAULT_AUCTION_FEE_PERCENTAGE from 25 to 10 in AuctionPayout.model.ts
```

---

## Next Steps

1. **Run the migration** using one of the methods above
2. **Verify** the migration with the verification queries
3. **Test** the fee calculation with a test auction
4. **Deploy** the updated code to production
5. **Monitor** the first few real auctions to ensure fees calculate correctly

---

## Support

If you encounter any issues:

1. Check migration file syntax
2. Verify all table/column names exist
3. Check for any existing auctions in the database (migration handles existing data)
4. Review Supabase logs for any errors

---

**Implementation Complete!** ✅

All code changes are done. The migration is ready to run whenever you're ready to apply the database schema changes.
