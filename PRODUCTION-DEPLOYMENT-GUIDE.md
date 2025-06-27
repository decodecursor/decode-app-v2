# DECODE Production Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account
- Crossmint account for payment processing
- Domain name and SSL certificate
- Email service (Resend or SendGrid) account

## Step 1: Environment Setup

### 1.1 Configure Production Environment Variables

Copy the `.env.production` file and update with your actual production values:

```bash
cp .env.production .env.local
```

Update the following critical variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your production Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your production Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your production Supabase service role key
- `NEXT_PUBLIC_CROSSMINT_PROJECT_ID` - Your Crossmint project ID
- `CROSSMINT_CLIENT_ID` - Your Crossmint client ID
- `CROSSMINT_CLIENT_SECRET` - Your Crossmint client secret
- `CROSSMINT_WEBHOOK_SECRET` - Your Crossmint webhook secret
- `NEXT_PUBLIC_APP_URL` - Your production domain (e.g., https://decode.beauty)
- `RESEND_API_KEY` - Your Resend API key for emails

### 1.2 Set Up Production Domain

Update `next.config.ts` with your production domain:
- Update `allowedOrigins` in serverActions
- Update CORS origins in headers
- Configure domain in images configuration

## Step 2: Database Setup

### 2.1 Create Supabase Production Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Copy the Project URL and anon key to your environment file
4. Go to Settings → API to get your service role key

### 2.2 Execute Database Schema

Run these SQL scripts in your Supabase SQL editor in order:

1. **Users Table:**
```sql
-- Execute supabase-users-table.sql
```

2. **Payment Links Table:**
```sql
-- Execute supabase-payment-links-table.sql
```

3. **Transactions Table (Corrected):**
```sql
-- Execute supabase-transactions-table-corrected.sql
```

4. **Webhook Events Table:**
```sql
-- Execute supabase-webhook-events-table.sql
```

5. **Additional Tables (if needed):**
```sql
-- Execute supabase-payment-splitting-tables.sql
-- Execute supabase-analytics-tables.sql
-- Execute supabase-email-logs-table.sql
```

### 2.3 Verify Row Level Security

Ensure all tables have RLS enabled and policies are active:
- Check that users can only see their own data
- Verify payment link creators can manage their links
- Confirm transaction access is properly restricted

## Step 3: Payment Processor Setup

### 3.1 Configure Crossmint

1. Log into your Crossmint dashboard
2. Create a production project
3. Get your production API keys
4. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/crossmint`
5. Configure webhook events: payment.completed, payment.failed, payment.pending
6. Test webhook signature verification

### 3.2 Test Payment Flow

1. Create a test payment link
2. Make a small test payment
3. Verify webhook is received and processed
4. Check that transaction is recorded in database

## Step 4: Email Service Setup

### 4.1 Configure Resend (Recommended)

1. Sign up at [Resend](https://resend.com)
2. Verify your domain
3. Get your API key
4. Update `RESEND_API_KEY` in environment file
5. Test email sending with `npm run test:email`

### 4.2 Alternative: Configure SendGrid

1. Sign up at [SendGrid](https://sendgrid.com)
2. Get your API key
3. Update `SENDGRID_API_KEY` in environment file
4. Set `EMAIL_PROVIDER=sendgrid`

## Step 5: Application Build and Test

### 5.1 Install Dependencies

```bash
npm install
```

### 5.2 Run Type Check

```bash
npm run type-check
```

### 5.3 Run Lint

```bash
npm run lint
```

### 5.4 Build Application

```bash
npm run build
```

### 5.5 Test Production Build

```bash
npm run start
```

## Step 6: End-to-End Testing

### 6.1 Authentication Flow

- [ ] User registration (Beauty Professional & Beauty Model)
- [ ] User login
- [ ] Role-based dashboard access
- [ ] Logout functionality

### 6.2 Payment Link Management

- [ ] Create payment link
- [ ] View payment links in My Links
- [ ] Copy payment link URL
- [ ] Deactivate payment link

### 6.3 Payment Processing

- [ ] Load public payment page
- [ ] Process test payment with Crossmint
- [ ] Verify transaction recorded
- [ ] Test webhook processing

### 6.4 Dashboard Features

- [ ] Dashboard stats display correctly
- [ ] Revenue calculations accurate
- [ ] Transaction history shows

### 6.5 Mobile Responsiveness

- [ ] All pages work on mobile
- [ ] Payment form mobile-friendly
- [ ] Navigation works on small screens

## Step 7: Monitoring and Health Checks

### 7.1 Health Check Endpoint

Test the health check endpoint:
```bash
curl https://yourdomain.com/api/health
```

### 7.2 Metrics Endpoint

Verify metrics collection:
```bash
curl https://yourdomain.com/api/metrics
```

### 7.3 Set Up Monitoring (Optional)

Configure Prometheus monitoring using the provided metrics endpoint.

## Step 8: Deployment

### 8.1 Deploy to Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy from main branch
4. Verify domain configuration

### 8.2 Alternative: Deploy to Other Platforms

The application supports Docker deployment:
```bash
docker build -t decode-app .
docker run -p 3000:3000 decode-app
```

## Step 9: Post-Deployment Checklist

- [ ] SSL certificate is valid and working
- [ ] All environment variables are set correctly
- [ ] Database connection is working
- [ ] Payment processing is functional
- [ ] Email notifications are working
- [ ] Webhook endpoint is receiving and processing events
- [ ] Health check returns healthy status
- [ ] Error monitoring is set up
- [ ] Backup strategy is in place

## Troubleshooting

### Common Issues

**Database Connection Fails:**
- Verify Supabase URL and keys are correct
- Check that RLS policies allow access
- Ensure database is in the same region

**Payment Processing Fails:**
- Verify Crossmint API keys are for production
- Check webhook URL is accessible from internet
- Verify webhook signature validation

**Email Not Sending:**
- Check email provider API key
- Verify domain is authenticated
- Test with simple email script

**Build Fails:**
- Run type check to identify TypeScript errors
- Check for missing dependencies
- Verify environment variables are set

## Support

For issues with specific services:
- **Supabase:** [Supabase Support](https://supabase.com/support)
- **Crossmint:** [Crossmint Docs](https://docs.crossmint.com)
- **Resend:** [Resend Support](https://resend.com/support)

## Security Considerations

- All API keys should be production-only and secured
- Webhook signatures must be verified
- RLS policies should be tested thoroughly
- Regular security audits recommended
- Monitor for unusual transaction patterns