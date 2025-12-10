# Email Service Configuration Guide

## Overview
The DECODE email service supports multiple providers: Resend, SendGrid, and a mock provider for development.

## Environment Variables

### Required for all providers:
```bash
# Email service provider (resend, sendgrid, or mock)
EMAIL_PROVIDER=resend

# From email address
EMAIL_FROM="DECODE Beauty <noreply@decode.beauty>"

# Support email for customer inquiries
SUPPORT_EMAIL="support@decode.beauty"

# App URL for generating links in emails
NEXT_PUBLIC_APP_URL="https://decode.beauty"
```

### Resend Configuration:
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
```

### SendGrid Configuration:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_api_key_here
```

### Mock Provider (Development):
```bash
EMAIL_PROVIDER=mock
# No additional keys required - emails will be logged to console
```

## Provider Setup Instructions

### 1. Resend (Recommended)
1. Sign up at https://resend.com
2. Verify your domain or use a Resend subdomain
3. Generate an API key in the dashboard
4. Add `RESEND_API_KEY` to your environment variables

### 2. SendGrid
1. Sign up at https://sendgrid.com
2. Complete sender authentication (domain or single sender)
3. Generate an API key with Mail Send permissions
4. Add `SENDGRID_API_KEY` to your environment variables

### 3. Mock Provider
- Use for development and testing
- Emails are logged to console instead of being sent
- No external API keys required

## Testing Email Configuration

Use the test script to verify your email setup:

```bash
# Test with mock provider
EMAIL_PROVIDER=mock npm run test:email

# Test with real provider
EMAIL_PROVIDER=resend RESEND_API_KEY=your_key npm run test:email
```

## Email Templates

The service includes three main email templates:

1. **Payment Confirmation** - Sent when payment succeeds
2. **Payment Failed** - Sent when payment fails
3. **Payment Receipt** - Detailed receipt for completed payments

All templates support both HTML and plain text versions for maximum compatibility.

## Database Logging

All email attempts are logged to the `email_logs` table with:
- Recipient email
- Email type and status
- Provider used
- Error messages (if any)
- Timestamps

## Troubleshooting

### Common Issues:

1. **"Email provider not configured"**
   - Check `EMAIL_PROVIDER` environment variable
   - Ensure API key is set for the selected provider

2. **Authentication errors**
   - Verify API key is correct and active
   - Check provider dashboard for key permissions

3. **Domain verification issues**
   - Complete domain verification in provider dashboard
   - Use verified sender addresses only

4. **Rate limiting**
   - Check provider rate limits
   - Implement retry logic if needed

### Debug Mode:
Set `DEBUG_EMAIL=true` to enable detailed logging of email operations.