# 🚨 URGENT: Database Migration Required

## Issue
Users cannot register and get this error:
```
Registration failed: new row for relation "users" violates check constraint "users_role_check"
```

## Root Cause
The application code was updated to use "Staff" instead of "User" for roles, but the database constraint was not updated to match.

## Solution
Run the migration file: `fix-role-constraint-2025-09-18.sql`

## How to Apply Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `migrations/fix-role-constraint-2025-09-18.sql`
4. Click "Run" to execute the migration

### Option 2: Command Line (if you have direct database access)
```bash
psql -h [your-db-host] -U [username] -d [database] -f migrations/fix-role-constraint-2025-09-18.sql
```

## What This Migration Does
- ✅ Updates database constraint to accept: `Admin`, `Staff`, `Model`
- ✅ Converts any existing `User` records to `Staff`
- ✅ Converts any existing `Beauty Professional` records to `Staff`
- ✅ Converts any existing `Beauty Model` records to `Model`
- ✅ Adds verification to ensure migration worked

## After Migration
- ✅ Users will be able to register successfully
- ✅ Role preselection in invitation modal will work
- ✅ All existing user data will be preserved with updated role names

## Urgent Priority
This migration must be run immediately as it's blocking all new user registrations.