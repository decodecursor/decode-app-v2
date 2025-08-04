# Database Migrations

## Running Migrations

To apply the Stripe Connect fields migration, run the following SQL file in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste the contents of `add_stripe_connect_fields.sql`
5. Run the query

## Migration Files

### add_stripe_connect_fields.sql
This migration adds the necessary fields for Stripe Connect integration:
- Adds Stripe Connect account fields to users table
- Creates transfers table for tracking money transfers
- Creates payouts table for tracking weekly payouts
- Sets up proper indexes and RLS policies

## Environment Variables Required

Make sure to add the following to your `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

This is needed for webhook handlers to bypass RLS policies.