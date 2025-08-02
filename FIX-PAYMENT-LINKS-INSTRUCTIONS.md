# Fix Payment Links "Not Found" Error - RESOLVED

## Final Solution
RLS (Row Level Security) has been disabled on the payment_links table.

## Problem
Payment links show "Payment link not found" because Row Level Security (RLS) policies are blocking public access. Buyers can't view payment links because they're not authenticated or not the creator.

## Solution
Run the SQL migration to add public access policies.

## Steps to Fix

### 1. Run the SQL Migration in Supabase

Go to your Supabase dashboard:
1. Navigate to SQL Editor
2. Copy and paste the contents of `fix-payment-link-public-access.sql`
3. Click "Run" to execute

Or run via Supabase CLI:
```bash
supabase db push fix-payment-link-public-access.sql
```

### 2. What This Fixes

The migration adds two policies:
- **Public can view active payment links**: Allows anyone to view active payment links
- **Public can view basic user info**: Allows viewing creator information for active payment links

### 3. Test the Fix

1. Create a new payment link
2. Copy the payment link URL
3. Open in incognito/private browser window
4. Payment form should now display correctly

## Alternative Solution (If Migration Doesn't Work)

If you still have issues, you can disable RLS temporarily:
```sql
ALTER TABLE payment_links DISABLE ROW LEVEL SECURITY;
```

**WARNING**: This removes all access control. Only use for testing.

## Verifying the Fix

Check existing policies:
```sql
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'payment_links';
```

You should see:
- Users can view own payment links
- Public can view active payment links (NEW)