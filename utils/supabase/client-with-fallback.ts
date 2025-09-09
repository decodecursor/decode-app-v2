import { createBrowserClient } from '@supabase/ssr'

// Enhanced client with fallback to proxy when direct connection fails
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
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'sb-auth-token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache',
        },
        // Add custom fetch that falls back to proxy on connection errors
        fetch: async (url: string, options: RequestInit = {}) => {
          // First try direct connection
          try {
            const response = await fetch(url, {
              ...options,
              signal: AbortSignal.timeout(5000), // 5 second timeout for direct
            })
            
            // If we get a response, return it
            if (response) {
              return response
            }
          } catch (error: any) {
            console.log('Direct connection failed, trying proxy...', error.message)
            
            // Parse the URL to get the endpoint
            const urlObj = new URL(url)
            const endpoint = urlObj.pathname + urlObj.search
            
            // Use proxy as fallback
            try {
              const proxyResponse = await fetch('/api/supabase-proxy', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  endpoint,
                  method: options.method || 'GET',
                  headers: options.headers || {},
                  body: options.body ? JSON.parse(options.body as string) : undefined,
                }),
              })
              
              if (proxyResponse.ok) {
                console.log('✅ Proxy connection successful')
                return proxyResponse
              }
              
              // If proxy also fails, throw the original error
              throw error
            } catch (proxyError) {
              console.error('Both direct and proxy connections failed')
              throw error // Throw original error
            }
          }
          
          // This shouldn't be reached, but just in case
          throw new Error('Connection failed')
        }
      }
    }
  )

  // Add debug logging in development
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.log('🔧 Supabase client created with fallback proxy support')
  }

  return client
}