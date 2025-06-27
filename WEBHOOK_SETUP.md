# Crossmint Webhook Setup Guide

This guide explains how to set up and configure Crossmint webhooks for the DECODE payment platform.

## Overview

Webhooks allow Crossmint to notify your application in real-time when payment events occur. This ensures that your application stays in sync with payment statuses without requiring constant polling.

## Webhook Endpoint

The webhook endpoint is available at:
```
POST /api/webhooks/crossmint
```

Full URL: `https://yourdomain.com/api/webhooks/crossmint`

## Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Crossmint webhook secret for signature verification
CROSSMINT_WEBHOOK_SECRET=your_webhook_secret_here

# Crossmint API configuration
NEXT_PUBLIC_CROSSMINT_API_KEY=your_api_key_here
CROSSMINT_ENVIRONMENT=staging
```

## Database Setup

Run the following SQL files to set up the required database tables:

1. **Webhook Events Table**:
   ```bash
   # Apply webhook events table schema
   psql -d your_database -f supabase-webhook-events-table.sql
   ```

2. **Email Logs Table**:
   ```bash
   # Apply email logs table schema
   psql -d your_database -f supabase-email-logs-table.sql
   ```

3. **Transaction Table Updates**:
   ```bash
   # Update transactions table for webhook support
   psql -d your_database -f supabase-transactions-table-updates.sql
   ```

## Crossmint Dashboard Configuration

### 1. Access Crossmint Dashboard
- Log in to your Crossmint developer dashboard
- Navigate to the "Webhooks" section

### 2. Add Webhook Endpoint
- Click "Add Webhook Endpoint"
- Enter your webhook URL: `https://yourdomain.com/api/webhooks/crossmint`
- Select the events you want to receive:
  - `payment.succeeded`
  - `payment.failed`
  - `payment.pending`
  - `payment.cancelled`
  - `payment.refunded`
  - `payment.expired`

### 3. Configure Webhook Secret
- Generate a secure webhook secret (recommended: 32+ random characters)
- Add the secret to your Crossmint webhook configuration
- Add the same secret to your environment variables as `CROSSMINT_WEBHOOK_SECRET`

### 4. Test Configuration
- Use the Crossmint dashboard to send test webhooks
- Verify that your endpoint receives and processes them correctly

## Event Types

The webhook handler supports the following event types:

### payment.succeeded / payment.completed
Triggered when a payment is successfully processed.

**Payload Example**:
```json
{
  "type": "payment.succeeded",
  "data": {
    "id": "tx_1234567890",
    "status": "completed",
    "amount": 99.99,
    "currency": "USD",
    "metadata": {
      "paymentLinkId": "123e4567-e89b-12d3-a456-426614174000",
      "creatorId": "creator@example.com",
      "buyerEmail": "buyer@example.com"
    },
    "paymentMethod": {
      "type": "credit_card",
      "details": { "last4": "4242", "brand": "visa" }
    },
    "customer": {
      "email": "buyer@example.com",
      "id": "cust_123"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### payment.failed / payment.declined
Triggered when a payment fails.

**Payload Example**:
```json
{
  "type": "payment.failed",
  "data": {
    "id": "tx_failed_123",
    "status": "failed",
    "amount": 99.99,
    "currency": "USD",
    "error": {
      "code": "card_declined",
      "message": "Your card was declined."
    }
  }
}
```

### payment.pending / payment.processing
Triggered when a payment is pending (e.g., bank transfers).

### payment.cancelled / payment.refunded
Triggered when a payment is cancelled or refunded.

### payment.expired
Triggered when a payment session expires.

## Security

### Signature Verification
All webhook requests are signed using HMAC-SHA256. The signature is included in the `x-crossmint-signature` header.

The webhook handler automatically verifies signatures using your configured webhook secret.

### IP Allowlisting (Optional)
For additional security, you can allowlist Crossmint's webhook IP addresses in your firewall or CDN:
- Contact Crossmint support for current IP ranges
- Configure your firewall to only allow webhook requests from these IPs

## Testing

### Local Testing
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Use ngrok or similar tool to expose your local server:
   ```bash
   ngrok http 3000
   ```

3. Update your Crossmint webhook URL to the ngrok URL:
   ```
   https://your-ngrok-id.ngrok.io/api/webhooks/crossmint
   ```

### Test Script
Run the included test script to verify webhook processing:

```bash
# Set environment variables
export WEBHOOK_URL=http://localhost:3000/api/webhooks/crossmint
export CROSSMINT_WEBHOOK_SECRET=your_test_secret

# Install dependencies and run test
npm install node-fetch
node test-webhook-handler.js
```

### Health Check
The webhook endpoint provides a health check via GET request:

```bash
curl https://yourdomain.com/api/webhooks/crossmint
```

Expected response:
```json
{
  "message": "Crossmint webhook endpoint is active",
  "timestamp": "2024-01-01T12:00:00Z",
  "environment": "development"
}
```

## Monitoring

### Webhook Events Log
All webhook events are logged in the `webhook_events` table for debugging and audit purposes.

Query recent webhook events:
```sql
SELECT 
  event_type,
  status,
  error_message,
  processed_at
FROM webhook_events 
ORDER BY processed_at DESC 
LIMIT 20;
```

### Failed Events
Monitor for failed webhook processing:
```sql
SELECT 
  event_type,
  event_data->>'id' as transaction_id,
  error_message,
  processed_at
FROM webhook_events 
WHERE status = 'failed'
ORDER BY processed_at DESC;
```

### Email Notifications
Check email notification status:
```sql
SELECT 
  recipient_email,
  email_type,
  status,
  error_message,
  created_at
FROM email_logs 
WHERE status = 'failed'
ORDER BY created_at DESC;
```

## Troubleshooting

### Common Issues

1. **Signature Verification Fails**
   - Verify webhook secret matches between Crossmint dashboard and environment variable
   - Check that the signature header is being received correctly
   - Ensure the payload hasn't been modified in transit

2. **Database Errors**
   - Verify all required tables exist and have correct permissions
   - Check that foreign key references are valid
   - Ensure Supabase service role has necessary permissions

3. **Missing Payment Link ID**
   - Verify that payment link metadata includes `paymentLinkId`
   - Check that the payment link ID exists in the database
   - Ensure metadata is being passed correctly from the payment form

4. **Webhook Timeouts**
   - Webhook processing should complete within 30 seconds
   - Optimize database queries if processing is slow
   - Consider moving time-intensive operations to background jobs

### Debug Mode
Set environment variable for detailed logging:
```bash
DEBUG_WEBHOOKS=true
```

This will enable additional console logging for webhook processing.

## Production Deployment

### Checklist
- [ ] Webhook secret is securely generated and stored
- [ ] Database tables are created and properly indexed
- [ ] RLS policies are configured correctly
- [ ] HTTPS is enabled for webhook endpoint
- [ ] Error monitoring is set up (e.g., Sentry)
- [ ] Log aggregation is configured
- [ ] Backup and recovery procedures are in place

### Performance Considerations
- Webhook processing should be fast (< 5 seconds)
- Use database indexes for efficient queries
- Consider implementing webhook event deduplication
- Monitor webhook endpoint response times
- Set up alerts for failed webhook processing

## Support

For issues with:
- **Crossmint webhooks**: Contact Crossmint support
- **DECODE webhook handler**: Check the application logs and database
- **Database issues**: Verify Supabase configuration and permissions

## Changelog

### v1.0.0
- Initial webhook implementation
- Support for all major payment events
- Signature verification
- Database logging
- Email notification framework