// DEPRECATED FOR CLIENT-SIDE USE - Use @/utils/supabase/client for client components
// This file is kept for server-side API routes that haven't been migrated yet
// TODO: Migrate all API routes to use @/utils/supabase/server instead

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)