# Supabase Authentication Setup Guide

## Overview
This guide walks through configuring Supabase Auth to use Resend for magic link emails and setting up WhatsApp OTP authentication.

---

## Phase 1: Configure Supabase Auth with Resend SMTP

### Step 1: Get Resend SMTP Credentials

1. Log in to [Resend Dashboard](https://resend.com/dashboard)
2. Navigate to **API Keys** → **Create API Key**
3. Name it "DECODE Supabase Auth" and select appropriate permissions
4. Copy the API key (starts with `re_`)

### Step 2: Configure Supabase Auth Settings

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your DECODE project: `vdgjzaaxvstbouklgsft`
3. Navigate to **Authentication** → **Email Templates**

### Step 3: Enable Magic Link Authentication

1. In **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. **Disable** "Confirm email" if you want instant magic link access
4. **Enable** "Magic Link" option
5. Set magic link expiration to **900 seconds (15 minutes)**

### Step 4: Configure Custom SMTP (Resend)

1. Navigate to **Project Settings** → **Authentication**
2. Scroll to **SMTP Settings**
3. Enable "Use custom SMTP server"
4. Fill in the following:

```
Host: smtp.resend.com
Port: 465
Username: resend
Password: [Your Resend API Key - re_...]
Sender email: DECODE <noreply@welovedecode.com>
Sender name: DECODE
```

5. Click **Save**

### Step 5: Test SMTP Connection

1. In **SMTP Settings**, click "Send test email"
2. Enter your email address
3. Verify you receive the test email

---

## Phase 2: Customize Magic Link Email Template

### Step 1: Navigate to Email Templates

1. Go to **Authentication** → **Email Templates**
2. Select **Magic Link** template

### Step 2: Customize the Template

Replace the default template with:

```html
<html>
  <head>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background-color: #f5f5f5;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        padding: 40px 30px;
        text-align: center;
      }
      .header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 28px;
        font-weight: 700;
      }
      .content {
        padding: 40px 30px;
      }
      .content p {
        color: #374151;
        font-size: 16px;
        line-height: 1.6;
        margin: 0 0 20px 0;
      }
      .button {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 32px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 16px;
        margin: 20px 0;
        text-align: center;
      }
      .button-container {
        text-align: center;
        margin: 30px 0;
      }
      .footer {
        background-color: #f9fafb;
        padding: 30px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
      }
      .footer p {
        color: #6b7280;
        font-size: 14px;
        margin: 5px 0;
      }
      .security-note {
        background-color: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 15px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .security-note p {
        color: #92400e;
        font-size: 14px;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎨 DECODE Beauty</h1>
      </div>
      <div class="content">
        <p>Hello!</p>
        <p>Click the button below to sign in to your DECODE account. This link will expire in <strong>15 minutes</strong>.</p>

        <div class="button-container">
          <a href="{{ .ConfirmationURL }}" class="button">Sign in to DECODE</a>
        </div>

        <div class="security-note">
          <p><strong>⚠️ Security Notice:</strong> Never share this link with anyone. DECODE will never ask you for this link.</p>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
      <div class="footer">
        <p><strong>DECODE</strong></p>
        <p>Empowering Beauty Professionals</p>
        <p style="margin-top: 15px;">
          <a href="https://welovedecode.com" style="color: #6366f1; text-decoration: none;">welovedecode.com</a>
        </p>
      </div>
    </div>
  </body>
</html>
```

3. **Save** the template
4. Send a test email to verify formatting

---

## Phase 3: Configure Auth Redirects

### Step 1: Set Redirect URLs

1. Navigate to **Authentication** → **URL Configuration**
2. Add the following **Redirect URLs**:

```
https://welovedecode.com/auth/callback
https://welovedecode.com/auth/verify
http://localhost:3000/auth/callback
http://localhost:3000/auth/verify
```

3. Set **Site URL** to: `https://welovedecode.com`

### Step 2: Configure Email Link Behavior

1. In **Authentication** → **Email Auth**
2. Enable "Secure email change"
3. Set "Email confirm redirect" to: `/auth/verify`

---

## Phase 4: WhatsApp Business API Setup

### Step 1: Create Meta Business Account

1. Go to [Meta Business Suite](https://business.facebook.com)
2. Create a new Business Account (if you don't have one)
3. Complete business verification (required for production)

### Step 2: Create WhatsApp Business App

1. Navigate to [Meta for Developers](https://developers.facebook.com)
2. Click **Create App** → **Business** type
3. Name it "DECODE Authentication"
4. Add **WhatsApp** product to your app

### Step 3: Get API Credentials

1. In your WhatsApp app, go to **WhatsApp** → **API Setup**
2. Copy the following:
   - **Phone Number ID** (starts with numbers)
   - **WhatsApp Business Account ID** (starts with numbers)
   - **Temporary Access Token** (starts with `EAAG...`)

### Step 4: Generate Permanent Access Token

⚠️ The temporary token expires in 24 hours. For production:

1. Go to **App Settings** → **Basic**
2. Note your **App ID** and **App Secret**
3. Follow [Meta's System User Token Guide](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-user-access-token)
4. Generate a permanent system user token with `whatsapp_business_messaging` permission

### Step 5: Create Message Template

1. In WhatsApp Manager, go to **Message Templates**
2. Click **Create Template**
3. Use these details:

**Template Name:** `decode_login_otp`
**Category:** `Authentication`
**Language:** English
**Body:**
```
Your DECODE login code is *{{1}}*

This code expires in 5 minutes. Do not share this code with anyone.
```

**Variables:** `{{1}}` = OTP code

4. **Submit for approval** (takes 1-24 hours)
5. Wait for Meta to approve the template

### Step 6: Add WhatsApp Test Numbers

1. In **WhatsApp** → **API Setup**
2. Add test phone numbers under "To" field
3. Verify the numbers receive test messages

### Step 7: Update Environment Variables

Add these to your `.env.local` and production environment:

```env
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_API_VERSION=v21.0
WHATSAPP_TEMPLATE_NAME=decode_login_otp
```

---

## Phase 5: Database Migrations

Run the following migrations in Supabase SQL Editor:

1. Navigate to **SQL Editor** in Supabase Dashboard
2. Run `001_add_phone_auth.sql` (adds phone_number column)
3. Run `002_create_otp_verifications.sql` (creates OTP table)
4. Verify tables are created successfully

---

## Phase 6: Testing

### Test Magic Link Email

1. Deploy the updated auth page
2. Try logging in with email
3. Verify:
   - ✅ Email received within 30 seconds
   - ✅ Link works and redirects correctly
   - ✅ Link expires after 15 minutes
   - ✅ Link can only be used once

### Test WhatsApp OTP

1. Ensure your number is added to WhatsApp test numbers
2. Try logging in with phone number
3. Verify:
   - ✅ WhatsApp message received within 10 seconds
   - ✅ OTP code is 6 digits
   - ✅ Code works for authentication
   - ✅ Code expires after 5 minutes
   - ✅ Rate limiting works (max 3 sends per 15min)

---

## Troubleshooting

### Magic Link Issues

**Problem:** Emails not sending
- **Check:** SMTP credentials in Supabase are correct
- **Check:** Resend API key has appropriate permissions
- **Check:** Sender email domain is verified in Resend

**Problem:** Links expire immediately
- **Check:** Token expiration setting (should be 900 seconds)
- **Check:** Server time is synchronized

### WhatsApp Issues

**Problem:** Messages not sending
- **Check:** Phone Number ID is correct
- **Check:** Access token is valid (not expired)
- **Check:** Template is approved by Meta
- **Check:** Test phone number is registered

**Problem:** Template rejected
- **Check:** Message follows [WhatsApp Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)
- **Check:** No promotional content in authentication template
- **Check:** Variables are properly formatted

---

## Production Checklist

Before going live:

- [ ] Resend account verified and production-ready
- [ ] Custom SMTP configured in Supabase
- [ ] Magic link email template tested
- [ ] WhatsApp Business Account verified by Meta
- [ ] WhatsApp message template approved
- [ ] Permanent access token generated
- [ ] All environment variables set in production
- [ ] Database migrations run successfully
- [ ] Rate limiting tested and working
- [ ] Both auth flows tested end-to-end
- [ ] Error handling tested (expired codes, invalid inputs)
- [ ] Mobile responsiveness verified
- [ ] Redirect URLs configured for production domain

---

## Support Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Resend Documentation](https://resend.com/docs)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Meta Business Verification](https://www.facebook.com/business/help/159334372093366)

---

**Last Updated:** 2025-11-20
