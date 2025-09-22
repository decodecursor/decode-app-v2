# DECODE Beauty Platform

A modern payment platform for beauty professionals in the UAE, built with Next.js, Stripe Connect, and Supabase.

## Features

- **Stripe Connect Integration**: Embedded onboarding for beauty professionals
- **Weekly Automated Payouts**: Automatic Monday payouts to connected bank accounts
- **Payment Links**: Create and share payment links with clients
- **Real-time Dashboard**: Track earnings, view payout history, and manage bank accounts
- **Mobile-Optimized**: Responsive design for all devices
- **Secure Webhooks**: Stripe webhook integration for real-time payment processing

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Payments**: Stripe Connect, Stripe Elements
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Stripe account with Connect enabled
- Supabase project

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd decode-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local` file with:
   - Stripe API keys (test or live)
   - Supabase project credentials
   - Application URL
   - Webhook secrets

5. Run database migrations:
```sql
-- Run the migrations in /migrations folder in your Supabase SQL editor
```

6. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Environment Variables

See `.env.example` for all required environment variables. Key variables include:

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Webhook endpoint secret from Stripe dashboard
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-side operations
- `CRON_SECRET`: Secret for authenticating cron job requests

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run typecheck`: Run TypeScript type checking
- `npm run lint`: Run ESLint
- `npm run test:env`: Validate environment variables
- `npm run validate`: Run all validation checks

## Stripe Setup

1. **Enable Stripe Connect** in your Stripe dashboard
2. **Configure Connect settings**:
   - Set platform name and icon
   - Configure onboarding settings
   - Set up webhook endpoints
3. **Add webhook endpoints**:
   - Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - For Connect events: `https://your-domain.com/api/stripe/connect-webhook`
4. **Configure Apple Pay domain** (if using):
   - Add your domain in Stripe dashboard
   - Verify domain ownership

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

### Cron Jobs

The application includes a weekly payout cron job configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-payouts",
      "schedule": "0 20 * * 0"
    }
  ]
}
```

This runs every Monday at midnight GST (Sunday 8 PM UTC).

To enable:
1. Set `CRON_SECRET` in your environment variables
2. Deploy to Vercel (cron jobs are automatically registered)

## API Endpoints

### Payment APIs
- `POST /api/payment/create-link`: Create a payment link
- `POST /api/payment/create-payment-intent`: Create Stripe payment intent
- `POST /api/payment/create-stripe-session`: Create Stripe checkout session

### Stripe Connect APIs
- `POST /api/stripe/connect-account`: Create a Connect account
- `GET /api/stripe/account-status`: Get account status
- `GET /api/stripe/account-balance`: Get account balance
- `POST /api/stripe/bank-account/set-primary`: Set primary bank account
- `DELETE /api/stripe/bank-account/remove`: Remove bank account

### Webhook Endpoints
- `POST /api/webhooks/stripe`: Main Stripe webhook handler
- `POST /api/stripe/connect-webhook`: Stripe Connect webhook handler
- `GET /api/cron/weekly-payouts`: Weekly payout cron job

## Troubleshooting

### Common Issues

1. **Stripe webhook signature verification fails**:
   - Ensure `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe dashboard
   - Check that the raw request body is being used for signature verification

2. **Apple Pay not showing**:
   - Verify domain is registered and verified in Stripe dashboard
   - Ensure you're testing on an Apple device with Apple Pay configured

3. **Database connection errors**:
   - Check Supabase service is running
   - Verify database credentials are correct
   - Ensure migrations have been run

4. **Environment validation fails**:
   - Run `npm run test:env` to check which variables are missing
   - Ensure no placeholder values (containing "..." or "your-") are used

### Debug Mode

Enable debug logging by setting:
```
DEBUG=true
DEBUG_WEBHOOKS=true
```

## Security Considerations

- Always use environment variables for sensitive data
- Implement proper authentication on all API endpoints
- Validate webhook signatures for all incoming webhooks
- Use HTTPS in production
- Regularly update dependencies
- Monitor for suspicious activity in Stripe dashboard

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary and confidential.

## Support

For support, email support@decode.beauty or create an issue in the repository.

<!-- Last updated: 2025-09-22 - Database migration completed - service amounts now display correctly -->