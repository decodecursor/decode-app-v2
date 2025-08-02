import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Create a Supabase client with the service role key for admin operations
// This bypasses RLS policies and should only be used in server-side code
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)