# Supabase Storage Setup for Auction Videos

This document provides step-by-step instructions to configure Supabase Storage for the auction video recording feature.

## Overview

The auction video feature requires:
1. A private storage bucket named `auction_videos`
2. Three Row Level Security (RLS) policies for access control
3. Proper configuration to work with authenticated and guest users

## Prerequisites

- Access to your Supabase project dashboard
- Admin/Owner permissions on the Supabase project

---

## Step 1: Create Storage Bucket

### Via Supabase Dashboard (Recommended)

1. Navigate to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Configure the bucket:
   - **Name**: `auction_videos`
   - **Public bucket**: **OFF** (keep private)
   - **Allowed MIME types**: Leave empty (will handle in code)
   - **File size limit**: 50 MB (or leave default)
4. Click **Create bucket**

### Via SQL (Alternative)

```sql
-- Create private bucket for auction videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction_videos', 'auction_videos', false);
```

---

## Step 2: Apply Storage RLS Policies

Go to **Storage** → **Policies** → **auction_videos** bucket → **New Policy**

Apply the following three policies:

### Policy 1: Allow Authenticated Users to Upload

**Policy Name:** `Authenticated users can upload videos`

**Operation:** INSERT

**Policy Definition:**
```sql
(bucket_id = 'auction_videos'::text)
AND (auth.role() = 'authenticated'::text)
```

**Full SQL:**
```sql
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'auction_videos' AND
  auth.role() = 'authenticated'
);
```

---

### Policy 2: Allow Creators to View Their Auction Videos

**Policy Name:** `Creators can view their auction videos`

**Operation:** SELECT

**Policy Definition:**
```sql
(bucket_id = 'auction_videos'::text)
AND (
  EXISTS (
    SELECT 1
    FROM auctions
    WHERE (
      (auctions.creator_id = auth.uid())
      AND (split_part((storage.objects.name)::text, '/'::text, 2) = (auctions.id)::text)
    )
  )
)
```

**Full SQL:**
```sql
CREATE POLICY "Creators can view their auction videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'auction_videos' AND
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.creator_id = auth.uid()
    AND split_part(storage.objects.name, '/', 2) = auctions.id::text
  )
);
```

---

### Policy 3: Allow Service Role to Delete Videos

**Policy Name:** `Service role can delete videos`

**Operation:** DELETE

**Policy Definition:**
```sql
(bucket_id = 'auction_videos'::text)
AND ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
```

**Full SQL:**
```sql
CREATE POLICY "Service role can delete videos"
ON storage.objects FOR DELETE
TO service_role
USING (
  bucket_id = 'auction_videos' AND
  (auth.jwt()->>'role') = 'service_role'
);
```

---

## Step 3: Verify Configuration

### Test Bucket Creation

Run this query in the SQL Editor:

```sql
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'auction_videos';
```

**Expected Result:**
```
id             | name           | public | file_size_limit
---------------|----------------|--------|----------------
auction_videos | auction_videos | false  | 52428800
```

### Test Policies

Check that all three policies are active:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%auction%video%';
```

**Expected Result:** 3 policies returned

---

## File Path Structure

Videos are stored with this path structure:

```
auction-videos/
  └── {auction_id}/
      └── {bid_id}/
          └── {timestamp}.webm
```

**Example:**
```
auction-videos/
  └── a1b2c3d4-e5f6-7890-abcd-ef1234567890/
      └── b2c3d4e5-f6g7-8901-bcde-f12345678901/
          └── 1704067200000.webm
```

---

## Environment Variables Required

Ensure these environment variables are set in your `.env.local` (development) and Vercel (production):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Required for guest uploads

# Application URL (for email links)
NEXT_PUBLIC_APP_URL=https://app.welovedecode.com

# Cron authentication
CRON_SECRET=<generated_secret>
```

---

## Troubleshooting

### Upload Fails with "bucket not found"

**Cause:** Bucket `auction_videos` doesn't exist
**Solution:** Create the bucket (Step 1)

### Upload Fails with "new row violates row-level security policy"

**Cause:** RLS policies not applied or incorrect
**Solution:**
1. Check policies exist (Step 3)
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. Check user is authenticated (for authenticated uploads)

### Creator Can't View Videos

**Cause:** SELECT policy not applied or user is not the auction creator
**Solution:**
1. Verify Policy 2 is applied
2. Check `auctions.creator_id` matches current user's `auth.uid()`
3. Verify file path structure matches: `auction-videos/{auction_id}/{bid_id}/{filename}`

### Videos Not Being Deleted by Cron

**Cause:** DELETE policy not applied or service role key incorrect
**Solution:**
1. Verify Policy 3 is applied
2. Check `SUPABASE_SERVICE_ROLE_KEY` is set in environment
3. Verify `CRON_SECRET` is set and matches cron authorization header

### Guest Bidders Can't Upload

**Cause:** Service role key missing
**Solution:** Set `SUPABASE_SERVICE_ROLE_KEY` in environment variables

---

## Storage Quota Management

### Monitor Storage Usage

```sql
-- Check total storage used by auction videos
SELECT
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'auction_videos'
GROUP BY bucket_id;
```

### Supabase Free Tier Limits

- **Storage:** 1 GB
- **Bandwidth:** 2 GB (per month)
- **File uploads:** 50 MB per file

### Video Auto-Deletion

Videos are automatically deleted after 7 days:
- Cron job runs daily at midnight
- Deletes files from storage
- Marks as `deleted_at` in database
- Helps manage storage quota

---

## Security Notes

1. **Private Bucket:** Videos are NOT publicly accessible
2. **Creator-Only Access:** Only auction creators can view winner videos
3. **No Downloads:** Player has `controlsList="nodownload"` to prevent easy downloads
4. **Token-Based Recording:** 64-character random tokens with 24-hour expiry
5. **Service Role:** Used only for guest bidder uploads, not exposed to frontend

---

## Testing the Setup

### Test Upload (Authenticated User)

1. Create a test auction
2. Place a winning bid (authenticated user)
3. End the auction
4. Record and upload a video
5. Check storage bucket for file

### Test Upload (Guest Bidder)

1. Create a test auction
2. Place winning bid as guest
3. Use email link to record video
4. Verify upload succeeds

### Test Creator Viewing

1. Log in as auction creator
2. Navigate to auction detail page
3. Verify video player appears and plays

### Test Auto-Deletion

1. Upload test video
2. Manually set `expires_at` to past date in database
3. Run cron: `POST /api/auctions/cron/cleanup-videos` with CRON_SECRET
4. Verify file deleted from storage
5. Verify `deleted_at` set in database

---

## Support

If you encounter issues:
1. Check Supabase logs: **Database** → **Logs**
2. Check storage logs: **Storage** → **Logs**
3. Verify all policies are active: **Storage** → **Policies**
4. Test with SQL queries above
5. Check browser console for client-side errors

---

## Maintenance

### Regular Tasks

- **Monitor storage quota** (weekly)
- **Verify cron jobs running** (check logs)
- **Review deleted videos count** (monthly)

### Recommended Alerts

Set up alerts in Supabase for:
- Storage usage > 80%
- Failed uploads spike
- Cron job failures

---

Last Updated: 2025-01-23
