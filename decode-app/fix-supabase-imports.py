#!/usr/bin/env python3
import os
import re

# Define the files and their required auth type
files_to_fix = {
    # Service role files (system operations, webhooks, cron jobs)
    'app/api/debug/env-check/route.ts': 'service',
    'app/api/health/route.ts': 'service',
    'app/api/metrics/route.ts': 'service',
    'app/api/webhooks/stripe/route.ts': 'service',
    'app/api/webhooks/crossmint/route.ts': 'service',
    'app/api/stripe/connect-webhook/route.ts': 'service',
    'app/api/cron/weekly-payouts/route.ts': 'service',

    # User auth files (need authenticated user context)
    'app/api/payment/create-crossmint-order/route.ts': 'user',
    'app/api/payment/create-payment-intent/route.ts': 'user',
    'app/api/payment/create-stripe-session/route.ts': 'user',
    'app/api/payment/manual-complete/route.ts': 'user',
    'app/api/payment/update-transaction/route.ts': 'user',
    'app/api/profile/verify-email/route.ts': 'user',
    'app/api/stripe/account-balance/route.ts': 'user',
    'app/api/stripe/account-session/route.ts': 'user',
    'app/api/stripe/connect-account/route.ts': 'user',
    'app/api/stripe/create-transfer/route.ts': 'user',
    'app/api/wallet/transactions/route.ts': 'user',
    'app/api/payouts/request/route.ts': 'user',
    'app/api/payouts/status/route.ts': 'user',
}

def fix_file(filepath, auth_type):
    if not os.path.exists(filepath):
        print(f"⚠️  File not found: {filepath}")
        return False

    with open(filepath, 'r') as f:
        content = f.read()

    # Check if file needs fixing
    if "import { supabase } from '@/lib/supabase'" not in content:
        print(f"✅ Already fixed or doesn't need fixing: {filepath}")
        return True

    original_content = content

    if auth_type == 'user':
        # Replace import for user auth
        content = content.replace(
            "import { supabase } from '@/lib/supabase'",
            "import { createClient } from '@/utils/supabase/server'"
        )

        # Find first usage of supabase and add client creation
        # Look for patterns like "await supabase" or "supabase."
        first_usage_pattern = r'(\n\s+)(.*?)(await )?supabase\.'
        match = re.search(first_usage_pattern, content)

        if match:
            # Find the function where this occurs
            lines = content[:match.start()].split('\n')
            # Look backwards for function declaration
            for i in range(len(lines) - 1, -1, -1):
                if 'export async function' in lines[i] or 'export function' in lines[i]:
                    # Insert supabase creation after try statement
                    if '  try {' in content:
                        content = re.sub(
                            r'(\n\s+try \{\n)',
                            r'\1    const supabase = await createClient()\n',
                            content,
                            count=1
                        )
                    else:
                        # Insert after function opening
                        func_pattern = r'(export async function \w+\([^)]*\) \{\n)'
                        content = re.sub(
                            func_pattern,
                            r'\1  const supabase = await createClient()\n',
                            content,
                            count=1
                        )
                    break

    elif auth_type == 'service':
        # Replace import for service role
        content = content.replace(
            "import { supabase } from '@/lib/supabase'",
            "import { createServiceRoleClient } from '@/utils/supabase/service-role'"
        )

        # Find first usage and add client creation
        first_usage_pattern = r'(\n\s+)(.*?)(await )?supabase\.'
        match = re.search(first_usage_pattern, content)

        if match:
            # Find the function where this occurs
            lines = content[:match.start()].split('\n')
            for i in range(len(lines) - 1, -1, -1):
                if 'export async function' in lines[i] or 'export function' in lines[i]:
                    # Insert supabase creation after try statement
                    if '  try {' in content:
                        content = re.sub(
                            r'(\n\s+try \{\n)',
                            r'\1    const supabase = createServiceRoleClient()\n',
                            content,
                            count=1
                        )
                    else:
                        # Insert after function opening
                        func_pattern = r'(export async function \w+\([^)]*\) \{\n)'
                        content = re.sub(
                            func_pattern,
                            r'\1  const supabase = createServiceRoleClient()\n',
                            content,
                            count=1
                        )
                    break

    # Write back if changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"✅ Fixed: {filepath} (auth type: {auth_type})")
        return True
    else:
        print(f"⚠️  Could not automatically fix: {filepath}")
        return False

# Process all files
print("🔧 Fixing Supabase imports in API routes...\n")
fixed_count = 0
failed_count = 0

for filepath, auth_type in files_to_fix.items():
    if fix_file(filepath, auth_type):
        fixed_count += 1
    else:
        failed_count += 1

print(f"\n✅ Successfully fixed: {fixed_count} files")
if failed_count > 0:
    print(f"⚠️  Failed or need manual review: {failed_count} files")