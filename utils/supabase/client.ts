import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables:', {
      url: supabaseUrl ? 'SET' : 'MISSING',
      key: supabaseAnonKey ? 'SET' : 'MISSING'
    })
    throw new Error('Supabase configuration is missing')
  }

  const client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Disable to prevent URL parsing delays
        flowType: 'implicit', // Use simpler flow for better performance
        // Use a consistent storage key across all instances
        storageKey: 'sb-auth-token',
        // Ensure proper storage configuration for development
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    }
  )

  // Add debug logging in development
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.log('🔧 Supabase client created with storage key: sb-auth-token')
  }

  return client
}