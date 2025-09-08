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
  
  // Create the Supabase client with minimal configuration
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'decode-app.supabase.auth.token',
    },
  })
  
  console.log('✅ New Supabase client created successfully')
  console.log('🔍 Client config - URL:', url.substring(0, 20) + '...', 'Key:', anonKey.substring(0, 20) + '...')
  
  // Add debug logging for auth calls in development
  if (process.env.NODE_ENV === 'development') {
    const originalSignIn = client.auth.signInWithPassword.bind(client.auth)
    const originalSignUp = client.auth.signUp.bind(client.auth)
    
    client.auth.signInWithPassword = async (credentials) => {
      const identifier = 'email' in credentials ? credentials.email : credentials.phone
      console.log('🔐 Auth: signInWithPassword called for:', identifier)
      const result = await originalSignIn(credentials)
      console.log('🔐 Auth: signInWithPassword result:', result.error ? '❌ Error' : '✅ Success')
      return result
    }
    
    client.auth.signUp = async (credentials) => {
      const identifier = 'email' in credentials ? credentials.email : credentials.phone
      console.log('📝 Auth: signUp called for:', identifier)
      const result = await originalSignUp(credentials)
      console.log('📝 Auth: signUp result:', result.error ? '❌ Error' : '✅ Success')
      return result
    }
  }
  
  return client
}

// Simple singleton client variable
let _supabaseClient: SupabaseClient | undefined

/**
 * Get or create Supabase client with simple singleton pattern
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    try {
      _supabaseClient = createSupabaseClient()
      console.log('🔧 Created Supabase client successfully')
    } catch (error) {
      console.error('💥 Failed to create Supabase client:', error)
      throw error
    }
  }
  return _supabaseClient
}

/**
 * Direct singleton export - no proxy, preserves method binding
 */
export const supabase = getSupabaseClient()

/**
 * Reset client for development/testing
 */
export function resetSupabaseClient(): void {
  _supabaseClient = undefined
  console.log('🔄 Reset Supabase client')
}