import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Get environment variables with proper validation
 * Simplified approach - direct access to environment variables
 */
function getSupabaseEnvVars() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  return { url, anonKey }
}

/**
 * Create a new Supabase client instance
 * Removed singleton pattern to prevent caching of invalid clients
 */
export function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseEnvVars()
  
  // Validate environment variables
  if (!url || !anonKey) {
    console.error('❌ Critical: Missing Supabase environment variables')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', url ? '✓ Set' : '❌ Missing')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', anonKey ? '✓ Set' : '❌ Missing')
    
    throw new Error('Missing required Supabase environment variables. Check your .env.local file.')
  }
  
  // Validate URL format
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.error('❌ Invalid Supabase URL format:', url)
    throw new Error('Invalid Supabase URL format')
  }
  
  // Detect browser type for Firefox-specific configuration
  const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')
  
  // Create the Supabase client with browser-optimized configuration
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Enhanced storage configuration for session persistence
      storage: typeof window !== 'undefined' ? {
        getItem: (key: string) => {
          try {
            return window.localStorage.getItem(key)
          } catch (error) {
            console.warn('Failed to read from localStorage:', error)
            return null
          }
        },
        setItem: (key: string, value: string) => {
          try {
            window.localStorage.setItem(key, value)
          } catch (error) {
            console.warn('Failed to write to localStorage:', error)
          }
        },
        removeItem: (key: string) => {
          try {
            window.localStorage.removeItem(key)
          } catch (error) {
            console.warn('Failed to remove from localStorage:', error)
          }
        }
      } : undefined,
      // Unique storage key to avoid conflicts
      storageKey: 'decode-app.supabase.auth.token',
      debug: process.env.NODE_ENV === 'development',
    },
    // Global configuration with browser-specific headers
    global: {
      headers: {
        'x-client-info': 'decode-app@1.0.0',
        // Firefox requires explicit headers for CORS
        ...(isFirefox && typeof window !== 'undefined' ? {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        } : {}),
      },
    },
    // Database configuration
    db: {
      schema: 'public',
    },
    // Realtime configuration
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  })
  
  console.log('✅ New Supabase client created successfully')
  return client
}

// Global singleton client variable
let _supabaseClient: SupabaseClient | null = null

/**
 * Get Supabase client instance with proper singleton pattern
 * This ensures the same client persists across hot-reloads
 */
export function getSupabaseClient(): SupabaseClient {
  // Return existing client if available
  if (_supabaseClient) {
    return _supabaseClient
  }

  // Create new client only if none exists
  try {
    _supabaseClient = createSupabaseClient()
    console.log('🔧 Created new Supabase client singleton')
    
    // Attempt session recovery on client creation
    if (typeof window !== 'undefined') {
      setTimeout(async () => {
        try {
          const { data: { session }, error } = await _supabaseClient!.auth.getSession()
          if (session && !error) {
            console.log('🔄 Session recovered successfully after client creation')
          }
        } catch (error) {
          console.warn('⚠️ Session recovery failed:', error)
        }
      }, 100)
    }
    
    return _supabaseClient
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    throw error
  }
}

/**
 * Force recreation of client (useful for development/testing)
 */
export function resetSupabaseClient(): void {
  if (_supabaseClient) {
    console.log('🔄 Resetting Supabase client singleton')
    _supabaseClient = null
  }
}

/**
 * Utility function to check and recover session state
 * Call this after hot-reloads or when auth state seems lost
 */
export async function recoverSession(): Promise<boolean> {
  try {
    const client = getSupabaseClient()
    const { data: { session }, error } = await client.auth.getSession()
    
    if (session && !error) {
      console.log('✅ Session recovered successfully')
      return true
    } else {
      console.log('ℹ️ No active session found')
      return false
    }
  } catch (error) {
    console.error('❌ Session recovery failed:', error)
    return false
  }
}

// Export singleton client using lazy initialization
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClient()
    return client[prop as keyof SupabaseClient]
  }
})