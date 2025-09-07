import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance
let supabaseInstance: SupabaseClient | null = null

/**
 * Get environment variables at runtime (not build time)
 * This ensures they're available in Vercel deployments
 */
function getSupabaseEnvVars() {
  // Try to get from process.env first (server-side)
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // If not available and we're in browser, try window object
  if (typeof window !== 'undefined') {
    // In production, Next.js should inject these
    url = url || (window as any).__NEXT_DATA__?.props?.pageProps?.env?.NEXT_PUBLIC_SUPABASE_URL
    anonKey = anonKey || (window as any).__NEXT_DATA__?.props?.pageProps?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
  
  return { url, anonKey }
}

/**
 * Create or get the Supabase client instance
 * This is a factory function that creates the client at runtime
 */
export function getSupabaseClient(): SupabaseClient {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  // Get environment variables at runtime
  const { url, anonKey } = getSupabaseEnvVars()
  
  // Validate environment variables
  if (!url || !anonKey) {
    console.error('❌ Missing Supabase environment variables!')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', url ? '✓ Set' : '✗ Missing')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', anonKey ? '✓ Set' : '✗ Missing')
    console.error('Make sure these are set in Vercel dashboard!')
    
    // Create a dummy client to prevent crashes
    // This will fail on actual API calls but won't break the build
    supabaseInstance = createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    ) as any
    
    return supabaseInstance
  }
  
  // Create the real Supabase client
  supabaseInstance = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }) as any
  
  console.log('✓ Supabase client initialized successfully')
  
  return supabaseInstance
}

// Export a getter for backward compatibility
export const supabase = getSupabaseClient()