# Stripe Integration Setup Guide

## Overview
This guide explains how to configure Stripe payment processing for the DECODE Beauty platform. The application now supports both Stripe (for traditional card payments) and Crossmint (for crypto payments).

## Environment Variables Required

Add these environment variables to your deployment platform (Vercel, etc.):

### Stripe Configuration
```bash
# Stripe API Keys (Get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_... # Use sk_live_... for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Use pk_live_... for production

# Stripe Webhook Secret (Get from Stripe Dashboard > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Environment (test or live)
STRIPE_ENVIRONMENT=test # Use 'live' for production
```

### Existing Variables (Keep these)
```bash
# Crossmint (existing)
NEXT_PUBLIC_CROSSMINT_PROJECT_ID=...
CROSSMINT_API_KEY=...
CROSSMINT_ENVIRONMENT=production

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Stripe Dashboard Setup

### 1. Create Stripe Account
1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete account verification for live payments

### 2. Get API Keys
1. Go to Stripe Dashboard > Developers > API Keys
2. Copy the **Publishable key** (starts with `pk_test_...`)
3. Reveal and copy the **Secret key** (starts with `sk_test_...`)

### 3. Setup Webhooks
1. Go to Stripe Dashboard > Developers > Webhooks
2. Click **"Add endpoint"**
3. Set endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select these events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_...`)

## Testing with Test Cards

### Test Card Numbers (Sandbox)
```bash
# Successful payments
4242424242424242  # Visa
4000056655665556  # Visa (debit)
5555555555554444  # Mastercard

# Failed payments
4000000000000002  # Card declined
4000000000009995  # Insufficient funds
4000000000000069  # Expired card

# Use any future expiry date (e.g., 12/25)
# Use any 3-digit CVC (e.g., 123)
# Use any postal code (e.g., 12345)
```

### Testing Flow
1. Go to payment page with Stripe option selected
2. Click "Pay with Stripe" button
3. Use test card numbers above
4. Verify webhook processing in Stripe Dashboard > Webhooks
5. Check transaction records in Supabase database

## Production Checklist

### Before Going Live:
- [ ] Replace `sk_test_...` with `sk_live_...`
- [ ] Replace `pk_test_...` with `pk_live_...`
- [ ] Set `STRIPE_ENVIRONMENT=live`
- [ ] Complete Stripe account verification
- [ ] Test with real cards in small amounts
- [ ] Verify webhook endpoint is accessible
- [ ] Update webhook URL to production domain

## Database Schema

The existing `transactions` table supports Stripe with these fields:
- `processor`: 'stripe' or 'crossmint'
- `processor_session_id`: Stripe checkout session ID
- `processor_payment_id`: Stripe payment intent ID
- `status`: 'pending', 'completed', 'failed'

## API Endpoints

### Created for Stripe:
- `POST /api/payment/create-stripe-session` - Create checkout session
- `GET /api/payment/create-stripe-session?sessionId=...` - Get session status
- `POST /api/webhooks/stripe` - Handle Stripe webhooks
- `GET /api/webhooks/stripe` - Health check

## Features Implemented

✅ **Dual Payment Processing**: Users can choose between Stripe and Crossmint
✅ **Currency Conversion**: AED to USD conversion for Stripe
✅ **Webhook Processing**: Automatic transaction status updates
✅ **Error Handling**: Comprehensive error handling and logging
✅ **Security**: Webhook signature verification
✅ **Database Integration**: Transaction logging in existing schema

## Next Steps

1. **Add Customer Input**: Collect customer email/name before payment
2. **Enhanced UI**: Improve payment method selection interface
3. **Analytics**: Track payment method preferences
4. **Payout Integration**: Implement automatic payouts to beauty professionals
5. **Email Notifications**: Send payment confirmations

## Support

For issues with Stripe integration:
1. Check Stripe Dashboard > Logs for API errors
2. Check application logs for webhook processing
3. Verify environment variables are set correctly
4. Test with different card numbers if payments fail