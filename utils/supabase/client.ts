import { createBrowserClient } from '@supabase/ssr'

// Singleton instance
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Use fallback values if environment variables are not available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vdgjzaaxvstbouklgsft.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ2p6YWF4dnN0Ym91a2xnc2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzE3MzQsImV4cCI6MjA2NjI0NzczNH0.98TuBpnqy3rHMRQtVJxuC466ymjCBAikik7KgGX5QDM'

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables')
    throw new Error('supabaseKey is required.')
  }

  // Create the client instance
  supabaseInstance = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'sb-auth-token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    }
  )

  // Add auth state change listener for debugging
  if (typeof window !== 'undefined') {
    supabaseInstance.auth.onAuthStateChange((event, session) => {
      console.log(`🔄 Auth State Change: ${event}`, session?.user?.id || 'no user')

      // Sync backup session on auth state changes
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        try {
          const backupSession = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: session.user,
            expires_at: session.expires_at,
            stored_at: Date.now()
          }
          localStorage.setItem('supabase_backup_session', JSON.stringify(backupSession))
          console.log('✅ Backup session synced on auth state change')
        } catch (error) {
          console.warn('Could not sync backup session:', error)
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear backup session on sign out
        localStorage.removeItem('supabase_backup_session')
        console.log('🗑️ Backup session cleared on sign out')
      }
    })
  }

  return supabaseInstance
}

// Export a function to clear the singleton (useful for testing or forced refresh)
export function clearClientInstance() {
  supabaseInstance = null
}