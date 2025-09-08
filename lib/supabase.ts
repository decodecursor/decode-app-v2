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
      // Storage configuration for better browser compatibility
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Firefox-specific settings
      storageKey: 'supabase.auth.token',
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

/**
 * Get Supabase client instance
 * This creates a new client each time to avoid caching issues
 */
export function getSupabaseClient(): SupabaseClient {
  try {
    return createSupabaseClient()
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    throw error
  }
}

// Create a default client for backward compatibility, but don't cache it
export const supabase = getSupabaseClient()