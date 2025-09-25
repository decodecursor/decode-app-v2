import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use fallback values if environment variables are not available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vdgjzaaxvstbouklgsft.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ2p6YWF4dnN0Ym91a2xnc2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzE3MzQsImV4cCI6MjA2NjI0NzczNH0.98TuBpnqy3rHMRQtVJxuC466ymjCBAikik7KgGX5QDM'

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables')
    throw new Error('supabaseKey is required.')
  }

  // Add mobile-friendly options
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        // Extend cookie lifetime for mobile browsers
        domain: undefined, // Let browser handle domain
        path: '/',
        sameSite: 'lax',
        secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
      },
      auth: {
        // Add longer timeouts for mobile networks
        storageKey: 'supabase.auth.token',
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        // Extend timeout for mobile connections
        flowType: 'pkce',
      },
    }
  )
}