# Apple Pay Setup Guide for DECODE Beauty App

## 🍎 Overview
This guide explains how to properly configure Apple Pay for the DECODE Beauty payment system using Stripe's Express Checkout Element.

## ✅ Prerequisites

1. **Stripe Account Setup**
   - Apple Pay must be enabled in your Stripe Dashboard
   - Navigate to: Settings > Payment methods > Apple Pay
   - Ensure Apple Pay is activated

2. **Domain Requirements**
   - Your domain must be served over HTTPS (required even in development)
   - Domain must be verified with Apple through Stripe

## 🔧 Implementation Status

### ✅ Already Configured in Code:
1. **Express Checkout Element** (`/components/payment/CustomPaymentForm.tsx`)
   - Apple Pay set to `'always'` to show button even if not set up
   - Proper button theming configured
   - Debug logging added for troubleshooting

2. **Payment Intent** (`/lib/stripe.ts`)
   - Added `payment_method_types: ['card']`
   - Enabled `automatic_payment_methods` for wallet support
   - Proper metadata configuration

3. **Domain Verification File** (`/public/.well-known/apple-developer-merchantid-domain-association`)
   - Apple verification file created and placed in correct location
   - This file is automatically served by Next.js

## 📋 Required Setup Steps

### 1. **Verify Domain in Stripe Dashboard**
   1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
   2. Navigate to Settings > Payment methods > Apple Pay
   3. Click "Add a new domain"
   4. Enter your production domain (e.g., `decode-app-v2.vercel.app`)
   5. Click "Add" - Stripe will automatically verify the domain using the file we created

### 2. **Test on HTTPS**
   For local development, you must use HTTPS:
   ```bash
   # Option 1: Use ngrok (recommended)
   ngrok http 3000
   
   # Option 2: Use local-ssl-proxy
   npm install -g local-ssl-proxy
   local-ssl-proxy --source 3001 --target 3000
   # Then access https://localhost:3001
   ```

### 3. **Device Requirements**
   Apple Pay will only appear on:
   - **iOS**: Safari on iPhone/iPad with iOS 10.1+
   - **macOS**: Safari 10+ or Chrome/Edge on Mac with Touch ID
   - **Device must have**: Apple Pay set up with at least one card

## 🐛 Troubleshooting

### Debug Console Logs
Open browser console to see these debug messages:
- `🍎 DEBUG: Express Checkout ready event:` - Shows when element loads
- `✅ DEBUG: Apple Pay is available` - Apple Pay can be used
- `❌ DEBUG: Apple Pay is NOT available` - Check requirements below

### Common Issues & Solutions

1. **Apple Pay not showing on iPhone**
   - ✅ Ensure HTTPS is used (not HTTP)
   - ✅ Verify domain in Stripe Dashboard
   - ✅ Check Safari settings: Settings > Safari > Advanced > "Allow websites to check for Apple Pay"
   - ✅ Ensure at least one card is added to Apple Wallet

2. **"No payment methods available" in console**
   - Payment intent might not be created properly
   - Check browser console for errors
   - Verify Stripe API keys are correct

3. **Apple Pay shows on Mac but not iPhone**
   - Usually indicates HTTPS issue
   - Domain verification might be incomplete
   - Try clearing Safari cache

## 🧪 Testing Apple Pay

### Test Cards for Apple Pay
Use these test cards in Apple Wallet (Sandbox mode):
- `4242 4242 4242 4242` - Successful payment
- `4000 0000 0000 9995` - Payment declined

### Testing Checklist
- [ ] Domain verified in Stripe Dashboard
- [ ] HTTPS enabled (production or ngrok for dev)
- [ ] Apple Pay enabled in Stripe settings
- [ ] Test on actual iPhone/iPad with Safari
- [ ] Check console for debug messages
- [ ] Verify payment completes successfully

## 📱 User Experience

When properly configured, users will see:
1. Both Apple Pay and Google Pay buttons in the Express Checkout box
2. Buttons appear side by side on desktop, stacked on mobile
3. Native Apple Pay sheet when clicking the button
4. Smooth payment flow with Face ID/Touch ID authentication

## 🔗 Useful Links

- [Stripe Apple Pay Documentation](https://stripe.com/docs/apple-pay)
- [Express Checkout Element Guide](https://stripe.com/docs/elements/express-checkout-element)
- [Apple Pay Web Integration](https://developer.apple.com/apple-pay/implementation/)
- [Stripe Dashboard - Payment Methods](https://dashboard.stripe.com/settings/payment_methods)

## 💡 Additional Notes

- The `paymentMethods.applePay: 'always'` setting ensures the button appears even if the user hasn't set up Apple Pay
- Apple Pay availability is determined by device, browser, and user setup - not just your configuration
- The domain verification file must be accessible at `/.well-known/apple-developer-merchantid-domain-association`
- Changes to payment method availability may take a few minutes to propagate