# Stripe Payment Status Tracking - Deployment Guide

This comprehensive solution fixes the Stripe payment status tracking issues by implementing a robust, end-to-end system that ensures payment status is consistently reflected across the database and UI.

## 🔧 What This Solution Fixes

### Problems Resolved:
1. **Payment Status Inconsistency**: Payment links not showing as paid after successful Stripe payments
2. **Database Schema Issues**: Multiple conflicting transaction table definitions
3. **Webhook Processing Problems**: Complex, unreliable transaction matching logic
4. **Status Detection Issues**: Overly complex status checking with multiple fallback methods
5. **Missing Idempotency**: Duplicate webhook processing causing data inconsistencies

### Solution Components:
1. **Unified Database Schema**: Single, comprehensive transaction table design
2. **Atomic Status Updates**: Database triggers ensure payment_links and transactions stay in sync
3. **Idempotent Webhooks**: Prevents duplicate processing and ensures reliability
4. **Simplified Status Logic**: Direct status checking using dedicated payment_status field
5. **Comprehensive Testing**: Full test suite to validate the implementation

## 📋 Pre-Deployment Checklist

### Environment Requirements:
- [ ] Supabase project with admin access
- [ ] Stripe account with webhook access
- [ ] Node.js environment for running test scripts
- [ ] Database backup completed

### Required Environment Variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

## 🚀 Deployment Steps

### Step 1: Database Migrations

Run the following SQL migrations in your Supabase dashboard (SQL Editor) **in this exact order**:

#### 1.1 Create Unified Transactions Schema
```sql
-- File: migrations/unified-transactions-schema.sql
-- This creates the new comprehensive transactions table
```
**⚠️ Important**: This will drop the existing transactions table. Ensure you have a backup if needed.

#### 1.2 Add Payment Status to Payment Links
```sql
-- File: migrations/add-payment-status-to-payment-links.sql
-- This adds payment_status tracking to payment_links table
```

#### 1.3 Create Payment Completion Procedure
```sql
-- File: migrations/create-payment-completion-procedure.sql
-- This creates the atomic payment completion stored procedure
```

### Step 2: Deploy Application Code

The following files have been updated and need to be deployed:

#### 2.1 Updated Webhook Handler
- **File**: `app/api/webhooks/stripe/route.ts`
- **Changes**: Idempotent processing, simplified transaction matching, atomic updates

#### 2.2 Updated Payment Page
- **File**: `app/pay/[linkId]/page.tsx`
- **Changes**: Simplified status detection using payment_status field

#### 2.3 Updated My Links Page
- **File**: `app/my-links/page.tsx`
- **Changes**: Direct status checking from payment_status field

#### 2.4 Updated Session Creation API
- **File**: `app/api/payment/create-stripe-session/route.ts`
- **Changes**: Proper field mapping for new transaction schema

### Step 3: Webhook Configuration

#### 3.1 Update Stripe Webhook Events
Ensure your Stripe webhook is configured to send these events:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

#### 3.2 Verify Webhook URL
- Development: `https://your-domain.com/api/webhooks/stripe`
- Production: Update accordingly

### Step 4: Testing and Validation

#### 4.1 Run Automated Tests
```bash
# Install dependencies if needed
npm install @supabase/supabase-js

# Update test configuration in the script
# Edit scripts/test-payment-status-tracking.js:
# - Set TEST_USER_ID to actual test user UUID
# - Verify environment variables are set

# Run the test suite
node scripts/test-payment-status-tracking.js
```

#### 4.2 Manual Testing Checklist
- [ ] Create a new payment link
- [ ] Verify payment link shows as "unpaid" initially
- [ ] Complete a test payment through Stripe
- [ ] Verify webhook is received and processed
- [ ] Check that payment link shows as "paid" after completion
- [ ] Verify "My PayLinks" page shows correct status
- [ ] Test visiting a paid payment link shows "already paid" message

## 🔍 Monitoring and Troubleshooting

### Key Monitoring Points:

#### 1. Database Consistency
```sql
-- Check for payment status mismatches
SELECT 
  pl.id,
  pl.payment_status,
  pl.paid_at,
  COUNT(t.id) as transaction_count,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_count
FROM payment_links pl
LEFT JOIN transactions t ON pl.id = t.payment_link_id
GROUP BY pl.id, pl.payment_status, pl.paid_at
HAVING 
  (pl.payment_status = 'paid' AND COUNT(CASE WHEN t.status = 'completed' THEN 1 END) = 0)
  OR (pl.payment_status = 'unpaid' AND COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0);
```

#### 2. Webhook Processing Status
```sql
-- Check recent webhook processing
SELECT 
  event_type,
  status,
  COUNT(*) as count,
  MAX(processed_at) as last_processed
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, status
ORDER BY event_type, status;
```

#### 3. Transaction Status Distribution
```sql
-- Monitor transaction status distribution
SELECT 
  payment_processor,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_completion_time_seconds
FROM transactions 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY payment_processor, status
ORDER BY payment_processor, status;
```

### Common Issues and Solutions:

#### Issue: Webhook not being processed
**Symptoms**: Payment completes in Stripe but status not updated in app
**Solution**: 
1. Check webhook endpoint is accessible
2. Verify webhook secret is correct
3. Check webhook_events table for error messages
4. Ensure Stripe webhook is sending to correct URL

#### Issue: Payment status not updating
**Symptoms**: Transaction marked as completed but payment_link still shows unpaid
**Solution**:
1. Check if the database trigger is installed: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'update_payment_link_status_trigger';`
2. Manually trigger status update: `SELECT update_payment_link_status();`
3. Check for constraint violations in the trigger function

#### Issue: Duplicate webhook processing
**Symptoms**: Multiple transactions created for same payment
**Solution**:
1. Verify webhook idempotency is working
2. Check webhook_events table for duplicate event_ids
3. Ensure upsert logic is functioning in webhook handler

## 🔄 Rollback Plan

If issues occur after deployment:

### Emergency Rollback:
1. **Revert application code** to previous version
2. **Disable webhook processing** temporarily by commenting out webhook handler logic
3. **Manual status updates** can be performed using:
```sql
-- Manually mark payment link as paid
UPDATE payment_links 
SET payment_status = 'paid', paid_at = NOW() 
WHERE id = 'payment-link-id-here';
```

### Full Rollback (if needed):
1. Restore database from backup
2. Revert all application code changes
3. Update Stripe webhook configuration if changed

## 📊 Success Metrics

Monitor these metrics to validate the solution:

1. **Webhook Processing Success Rate**: Should be >99%
2. **Payment Status Accuracy**: Manual spot checks should show 100% accuracy
3. **User Complaint Reduction**: Payment status confusion should be eliminated
4. **System Performance**: Database query performance should improve due to simpler status logic

## 🎯 Final Validation

Before considering the deployment complete:

1. [ ] All automated tests pass
2. [ ] Manual test payments work end-to-end
3. [ ] Webhook processing is reliable (test with multiple payments)
4. [ ] UI correctly shows payment status in all states
5. [ ] Database constraints and triggers are functioning
6. [ ] Monitoring queries return expected results
7. [ ] Error handling works as expected

## 📞 Support

If issues arise during deployment:

1. Check the test script output for specific failure points
2. Review database logs for constraint violations or trigger errors
3. Monitor Stripe webhook delivery attempts and responses
4. Use the monitoring queries provided to identify data inconsistencies

This comprehensive solution addresses all the identified issues with Stripe payment status tracking and provides a robust, scalable foundation for reliable payment processing.