import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Create a Supabase client with the service role key for admin operations
// This bypasses RLS policies and should only be used in server-side code
// Lazy initialization to avoid build-time errors when env vars aren't available

let supabaseAdminInstance: SupabaseClient | null = null;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!supabaseAdminInstance) {
      supabaseAdminInstance = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    }
    return (supabaseAdminInstance as any)[prop];
  }
}) as any;