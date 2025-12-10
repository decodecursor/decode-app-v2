import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with the service role key for admin operations
// This bypasses RLS policies and should only be used in server-side code
// Temporarily remove type safety to fix build issues
// TODO: Generate correct types from Supabase database
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) as any