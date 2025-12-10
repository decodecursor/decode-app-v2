#!/bin/bash

# Script to fix all API routes using incorrect client-side Supabase import

echo "🔧 Fixing Supabase imports in API routes..."

# List of files to fix
files=(
  "app/api/companies/suggestions/route.ts"
  "app/api/health/route.ts"
  "app/api/webhooks/stripe/route.ts"
  "app/api/webhooks/crossmint/route.ts"
  "app/api/wallet/transactions/route.ts"
  "app/api/stripe/connect-account/route.ts"
  "app/api/stripe/account-status/route.ts"
  "app/api/stripe/account-session/route.ts"
  "app/api/stripe/account-balance/route.ts"
  "app/api/profile/verify-email/route.ts"
  "app/api/profile/change-email/route.ts"
  "app/api/payment/manual-complete/route.ts"
  "app/api/payment/create-stripe-session/route.ts"
  "app/api/payment/create-payment-intent/route.ts"
  "app/api/payment/create-crossmint-order/route.ts"
  "app/api/metrics/route.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."

  # Check if file exists
  if [ -f "$file" ]; then
    # Replace the import statement
    sed -i "s|import { supabase } from '@/lib/supabase'|import { createClient } from '@/utils/supabase/server'|g" "$file"

    # Add supabase client creation after imports if not already present
    # This is more complex and needs to be done file by file
    echo "  - Updated import statement"
  else
    echo "  - File not found, skipping"
  fi
done

echo "✅ Import statements updated. Now need to update usage in each file..."