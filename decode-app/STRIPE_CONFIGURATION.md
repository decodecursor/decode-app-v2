# Stripe Configuration Guide for DECODE Beauty App

## Problem Solved
Payment links were showing failure messages because Stripe API keys were missing or invalid. This guide explains how to properly configure Stripe for both development and production environments.

## Quick Fix Summary
1. ✅ **Environment Files Updated**: Added missing Stripe configuration to `.env.production` 
2. ✅ **Placeholder Keys Fixed**: Replaced invalid placeholder keys in `.env.local`
3. ✅ **Better Error Messages**: Improved Stripe service to detect invalid keys and provide helpful guidance
4. 🔧 **Action Required**: You need to add your actual Stripe API keys

## How to Get Your Stripe API Keys

### For Development (Test Mode)
1. Go to [Stripe Dashboard - Test API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy your "Secret key" (starts with `sk_test_`)
3. Copy your "Publishable key" (starts with `pk_test_`)

### For Production (Live Mode)
1. Go to [Stripe Dashboard - Live API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your "Secret key" (starts with `sk_live_`)
3. Copy your "Publishable key" (starts with `pk_live_`)

## Environment Variable Configuration

### Development Environment (`.env.local`)
```bash
# Replace these placeholder values with your actual Stripe test keys
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_stripe_webhook_secret_here
STRIPE_ENVIRONMENT=test
```

### Production Environment (`.env.production`)
```bash
# Replace these placeholder values with your actual Stripe live keys
STRIPE_SECRET_KEY=sk_live_your_actual_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_actual_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_stripe_webhook_secret_here
STRIPE_ENVIRONMENT=live
```

### Vercel Deployment
For production deployment on Vercel, add these environment variables in your Vercel dashboard:
1. Go to your project settings on Vercel
2. Navigate to "Environment Variables"
3. Add the production Stripe keys listed above

## Testing Your Configuration

### 1. Check Console Output
After updating your keys, restart your development server:
```bash
npm run dev
```

Look for this success message in the console:
```
✅ Stripe configured for test environment
```

### 2. Test Payment Intent API
You can test if Stripe is working by making a request to the payment intent API:
```bash
curl -X POST http://localhost:3000/api/payment/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "your-payment-link-id",
    "amount": 1000,
    "currency": "usd",
    "customerEmail": "test@example.com"
  }'
```

### 3. Expected Responses
- ✅ **Success**: Returns `{"success": true, "clientSecret": "pi_..."}`
- ❌ **Invalid Key**: Returns `{"error": "Invalid API Key provided"}`
- ❌ **Missing Key**: Returns clear error message about configuration

## Common Error Messages and Solutions

### "Invalid API Key provided"
- **Cause**: Stripe API key is incorrect or malformed
- **Solution**: Double-check you copied the key correctly from Stripe dashboard

### "Stripe not configured: STRIPE_SECRET_KEY appears to be a placeholder"
- **Cause**: Environment variable still contains placeholder text
- **Solution**: Replace with actual Stripe key from dashboard

### "Missing Stripe secret key"
- **Cause**: Environment variable not set
- **Solution**: Add the `STRIPE_SECRET_KEY` to your environment file

## Security Notes
- ❌ **Never commit** real API keys to git repositories
- ✅ **Use test keys** for development
- ✅ **Use live keys** only in production
- ✅ **Restrict live keys** in Stripe dashboard to specific domains

## Next Steps
1. **Update your environment variables** with real Stripe keys
2. **Test payment flow** with a real payment link
3. **Deploy to production** with live keys configured in Vercel
4. **Monitor payments** in your Stripe dashboard

## Need Help?
- [Stripe API Keys Documentation](https://stripe.com/docs/keys)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- Check the application console for detailed error messages