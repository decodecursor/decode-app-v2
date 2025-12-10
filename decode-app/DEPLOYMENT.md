# DECODE App Deployment Guide

## Environment Variables Setup

### Required Environment Variables for Vercel Dashboard:

#### Supabase Configuration:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://vdgjzaaxvstbouklgsft.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ2p6YWF4dnN0Ym91a2xnc2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzE3MzQsImV4cCI6MjA2NjI0NzczNH0.98TuBpnqy3rHMRQtVJxuC466ymjCBAikik7KgGX5QDM`
- `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ2p6YWF4dnN0Ym91a2xnc2Z0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDY3MTczNCwiZXhwIjoyMDY2MjQ3NzM0fQ.K0X8v4TNfQ8BjOrpuSkE3EhQLMOb0ZkQZwCAM6_6Z5Y`

#### Crossmint Configuration:
- `CROSSMINT_API_KEY` = `sk_production_5P1d43U3e6VM5NVhDXBNj5j9HTXF1fuETZQHH7bRJ1nAYS54vjBsUX5Av6PbycioyPc4hTjpB4C5wxDf9p4fkrryJWYoC8FT9ikJ1cDXgnLPuuxWgC4LZs35GG32MSjyy12fphubQu3wL1qmunJrz2kSXjfoXQhCZGPChZAUjD9Gyf4UASjuWXndGG37Te6pUi5wypjoywrQ5o6EUiprw69Z`
- `NEXT_PUBLIC_CROSSMINT_API_KEY` = `ck_production_5P1d43U3e6VM5NVhDXBNj5j9HTXF1fuETZQHH7bRJ1nAYS54vjBsUX5Av6PbycioyPc4hTjpB4C5wxDf9p4fkrryJWYoC8FT9ikJ1cDXgnLPuuxWgC4LZs35GG32MSjyy12fphubQu3wL1qmunJrz2kSXjfoXQhCZGPChZAUjD9Gyf4UASjuWXndGG37Te6pUi5wypjoywrQ5o6EUiprw69Z`
- `CROSSMINT_PROJECT_ID` = `10630979-cdbd-453e-8b49-cdca01318624`
- `NEXT_PUBLIC_CROSSMINT_PROJECT_ID` = `10630979-cdbd-453e-8b49-cdca01318624`
- `CROSSMINT_CLIENT_ID` = `10630979-cdbd-453e-8b49-cdca01318624`
- `CROSSMINT_WEBHOOK_SECRET` = `whsec_e+YB01ZA2LF+g0YMC2LHvgUwpNt9ENhY`
- `CROSSMINT_ENVIRONMENT` = `production`

#### Email Configuration:
- `EMAIL_PROVIDER` = `resend`
- `RESEND_API_KEY` = `re_3yxEgGkq_KgFdwuqCrNVbjJ54mxazBvVs`

#### Other:
- `DECODE_WALLET_ADDRESS` = `8SSGJhohYgtqhhPswWXZjsLd95HS8LX2eBusDBqHn7DY`

## Security Note:
These environment variables have been removed from vercel.json and must be set in the Vercel dashboard for security.

## Database Setup:
Make sure to apply the SQL migrations in /sql/ directory to set up the database schema.

## Testing:
1. Test payment flow at `/payment` (test page)
2. Test real payment links at `/pay/[linkId]`
3. Test wallet creation API at `/api/wallet/create`
4. Test webhook endpoint at `/api/webhooks/crossmint`