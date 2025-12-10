# 🚀 Auction System Deployment Guide

## Pre-Deployment Checklist

Before deploying the auction system, ensure all the following steps are completed:

---

## Step 1: Database Migration

### Apply the Auction Schema

```bash
# Connect to your Supabase database
psql $DATABASE_URL -f migrations/20250102_auction_system.sql

# Or use Supabase CLI
supabase migration up
```

### Verify Tables Created

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('auctions', 'bids', 'guest_bidders', 'auction_videos', 'auction_payouts');

-- Should return 5 rows
```

### Verify RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'auction%' OR tablename IN ('bids', 'guest_bidders');

-- All should show rowsecurity = true
```

---

## Step 2: Supabase Storage Setup

### Create Storage Bucket

Option 1: Via Supabase Dashboard
1. Go to Storage → Create Bucket
2. Name: `auction_videos`
3. Public: **No** (private bucket)
4. Click Create

Option 2: Via SQL
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction_videos', 'auction_videos', false);
```

### Add Storage Policies

```sql
-- Policy 1: Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'auction_videos' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow auction creators to view videos
CREATE POLICY "Creators can view their auction videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'auction_videos' AND
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.creator_id = auth.uid()
    AND SPLIT_PART(storage.objects.name, '/', 2) = auctions.id::text
  )
);

-- Policy 3: Allow service role to delete expired videos
CREATE POLICY "Service role can delete videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'auction_videos' AND
  auth.jwt()->>'role' = 'service_role'
);
```

### Verify Storage Setup

```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE name = 'auction_videos';

-- Check policies
SELECT * FROM storage.policies WHERE bucket_id = 'auction_videos';
-- Should return 3 policies
```

---

## Step 3: Environment Variables

### Add to `.env.local`

```env
# Existing Stripe variables (should already be configured)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Existing Supabase variables (should already be configured)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NEW: Cron job authentication
CRON_SECRET=your_secure_random_string_here

# NEW: Application URL (for email links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Generate Secure CRON_SECRET

```bash
# Generate a secure random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 32
```

### Production Environment Variables

For Vercel deployment:
```bash
# Set via Vercel CLI
vercel env add CRON_SECRET

# Or via Vercel Dashboard
# Project Settings → Environment Variables → Add
```

---

## Step 4: Cron Jobs Configuration

### Vercel Cron Setup

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/auctions/cron/close-auctions",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/auctions/cron/cleanup-videos",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Cron Schedule Explained:**
- `*/5 * * * *` - Every 5 minutes (close auctions)
- `0 0 * * *` - Daily at midnight UTC (cleanup videos)

### Test Cron Endpoints Locally

```bash
# Test close auctions endpoint
curl -X POST http://localhost:3000/api/auctions/cron/close-auctions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test cleanup videos endpoint
curl -X POST http://localhost:3000/api/auctions/cron/cleanup-videos \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Alternative: GitHub Actions Cron

If not using Vercel, create `.github/workflows/cron.yml`:

```yaml
name: Auction Cron Jobs

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
    - cron: '0 0 * * *'    # Daily at midnight

jobs:
  close-auctions:
    runs-on: ubuntu-latest
    steps:
      - name: Close Ended Auctions
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/auctions/cron/close-auctions \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  cleanup-videos:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 0 * * *'
    steps:
      - name: Cleanup Expired Videos
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/auctions/cron/cleanup-videos \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## Step 5: Stripe Webhook Configuration

### 1. Create Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Description: `DECODE Auction System Webhooks`

### 2. Select Events to Listen To

**Required Events for Auctions:**
- ✅ `payment_intent.amount_capturable_updated`
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `payment_intent.canceled`

**Existing Events (keep these):**
- ✅ `checkout.session.completed`
- ✅ `invoice.payment_succeeded`

### 3. Get Webhook Signing Secret

1. After creating endpoint, reveal **Signing secret**
2. Copy the secret (starts with `whsec_`)
3. Update environment variable:

```bash
# Update STRIPE_WEBHOOK_SECRET
STRIPE_WEBHOOK_SECRET=whsec_your_signing_secret_here
```

### 4. Test Webhook

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

---

## Step 6: Supabase Realtime Configuration

### Enable Realtime for Auction Tables

Via Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for:
   - ✅ `auctions`
   - ✅ `bids`
   - ✅ `guest_bidders`
   - ✅ `auction_videos`

Via SQL:
```sql
-- Enable realtime for auction tables
ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
ALTER PUBLICATION supabase_realtime ADD TABLE guest_bidders;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_videos;
```

### Verify Realtime Setup

```sql
-- Check realtime publications
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public';
```

---

## Step 7: Email Service Configuration

### Verify Email Service

The auction system uses the existing `emailService` from `/lib/email-service.ts`.

Ensure these environment variables are set:
```env
# For Resend (recommended)
RESEND_API_KEY=re_...

# OR for SendGrid
SENDGRID_API_KEY=SG...
```

### Test Email Notifications

```javascript
// Test winner notification
const { AuctionNotificationService } = require('./lib/services/AuctionNotificationService');

const notificationService = new AuctionNotificationService();
await notificationService.notifyWinner({
  auction_id: 'test-auction-id',
  bid_id: 'test-bid-id',
  winner_email: 'test@example.com',
  winner_name: 'Test User',
  auction_title: 'Test Auction',
  winning_amount: 100,
  recording_token: 'test-token',
});
```

---

## Step 8: Install Dependencies

### Check Required Packages

```bash
# Core dependencies (should already be installed)
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
npm install @supabase/supabase-js
npm install @headlessui/react

# Verify installation
npm list stripe @stripe/stripe-js @supabase/supabase-js
```

---

## Step 9: Build and Deploy

### Local Build Test

```bash
# Install dependencies
npm install

# Run type checking
npx tsc --noEmit

# Build the application
npm run build

# Start production server
npm run start
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Post-Deployment Verification

1. **Check environment variables:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Ensure all required variables are set

2. **Check build logs:**
   - Look for any TypeScript errors
   - Verify all imports resolve correctly

3. **Check runtime logs:**
   - Vercel Dashboard → Project → Logs
   - Monitor for any errors during initialization

---

## Step 10: Post-Deployment Testing

### 1. Database Connectivity

```bash
# Test API endpoint
curl https://your-domain.com/api/auctions/list

# Should return: { success: true, auctions: [], count: 0 }
```

### 2. Realtime Connection

1. Open browser console on `/auctions`
2. Check for WebSocket connection:
   ```
   Auction channel auction:xxx status: subscribed
   ```

### 3. Stripe Integration

1. Create a test auction as MODEL user
2. Place a test bid
3. Check Stripe Dashboard → Payments
4. Verify PaymentIntent created with `capture_method: manual`

### 4. Webhook Delivery

1. Stripe Dashboard → Webhooks → Your endpoint
2. Check "Recent deliveries"
3. Verify `200 OK` responses

### 5. Cron Jobs

Wait 5 minutes and check:
```bash
# Check Vercel function logs
vercel logs --follow

# Should see: "🔔 Stripe webhook received: cron.job.run"
```

---

## Troubleshooting

### Database Issues

**Error: "relation 'auctions' does not exist"**
```bash
# Verify migration applied
psql $DATABASE_URL -c "\dt auctions"

# Re-run migration if needed
psql $DATABASE_URL -f migrations/20250102_auction_system.sql
```

### Storage Issues

**Error: "Storage bucket not found"**
```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE name = 'auction_videos';

-- Recreate if needed
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction_videos', 'auction_videos', false);
```

### Realtime Issues

**No live updates appearing**
```sql
-- Check realtime is enabled
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('auctions', 'bids');

-- Enable if missing
ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
```

### Webhook Issues

**Error: "Webhook signature verification failed"**
1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Check it matches Stripe Dashboard webhook signing secret
3. Ensure no extra whitespace in environment variable

### Cron Job Issues

**Cron jobs not running**
1. Verify `vercel.json` exists in project root
2. Check `CRON_SECRET` environment variable is set
3. Verify cron endpoints return 200 OK with correct auth header

---

## Security Checklist

Before going live:

- [ ] All RLS policies enabled on auction tables
- [ ] Storage bucket is private (not public)
- [ ] `CRON_SECRET` is a strong random string
- [ ] `STRIPE_WEBHOOK_SECRET` is set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept secret
- [ ] Video recording tokens expire after 24 hours
- [ ] Videos auto-delete after 7 days
- [ ] Email validation in place for guest bidders
- [ ] IP addresses logged for fraud detection
- [ ] Rate limiting configured (via Stripe)

---

## Monitoring

### Key Metrics to Monitor

1. **Auction Metrics:**
   - Active auctions count
   - Total bids placed
   - Average bid amount
   - Conversion rate (bids → wins)

2. **Payment Metrics:**
   - Pre-authorizations created
   - Successful captures
   - Failed captures (should trigger fallback)
   - Refunds issued

3. **Video Metrics:**
   - Videos uploaded
   - Upload success rate
   - Videos auto-deleted
   - Storage usage

4. **Error Metrics:**
   - Webhook delivery failures
   - Database errors
   - Realtime disconnections
   - Email delivery failures

### Logging

```javascript
// Enable debug logging in production
console.log('Auction created:', auction.id);
console.log('Bid placed:', bid.id, bid.amount);
console.log('Payment captured:', paymentIntent.id);
```

---

## Rollback Plan

If issues arise after deployment:

### Option 1: Disable Auctions

```sql
-- Prevent new auctions from being created
UPDATE users SET role = 'Beauty Professional'
WHERE role = 'Beauty Model';

-- End all active auctions
UPDATE auctions SET status = 'cancelled'
WHERE status = 'active';
```

### Option 2: Remove Tables (Nuclear Option)

```sql
-- WARNING: This deletes all auction data!
DROP TABLE IF EXISTS auction_payouts CASCADE;
DROP TABLE IF EXISTS auction_videos CASCADE;
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS guest_bidders CASCADE;
DROP TABLE IF EXISTS auctions CASCADE;
```

---

## Support

For issues or questions:
1. Check logs in Vercel Dashboard
2. Check Supabase logs for database errors
3. Check Stripe Dashboard for payment issues
4. Review `AUCTION_IMPLEMENTATION_COMPLETE.md` for feature details

---

## Success Criteria

Deployment is successful when:

✅ All database tables exist with RLS enabled
✅ Storage bucket created with proper policies
✅ Environment variables set correctly
✅ Stripe webhooks delivering successfully
✅ Cron jobs running every 5 minutes
✅ Realtime updates working on frontend
✅ Test auction can be created
✅ Test bid can be placed
✅ Payment pre-authorization works
✅ Video recording works
✅ Email notifications sent

**Once all criteria are met, the auction system is live! 🎉**
