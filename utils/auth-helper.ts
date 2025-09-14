import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export async function getUserWithProxy(): Promise<{ user: User | null, error: string | null }> {
  const supabase = createClient()

  try {
    // First try direct connection
    console.log('🔍 [AUTH-HELPER] Attempting direct getUser...')
    const { data: { user }, error } = await supabase.auth.getUser()

    if (user && !error) {
      console.log('✅ [AUTH-HELPER] Direct getUser successful:', user.id)
      return { user, error: null }
    }

    // If no user found OR there's a network error, try proxy
    // This ensures proxy is used when cookies aren't readable by client
    if (!user || error?.message?.includes('NetworkError') ||
        error?.message?.includes('fetch') ||
        error?.message?.includes('Failed to fetch')) {
      console.log('🔄 [AUTH-HELPER] No user from direct connection, trying proxy...')

      try {
        const proxyResponse = await fetch('/api/auth/proxy-user', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        if (proxyResponse.ok) {
          const proxyData = await proxyResponse.json()
          if (proxyData.user) {
            console.log('✅ [AUTH-HELPER] Proxy getUser successful:', proxyData.user.id)
            return { user: proxyData.user, error: null }
          }
        } else if (proxyResponse.status === 401) {
          console.log('❌ [AUTH-HELPER] No authenticated user found via proxy')
          return { user: null, error: null }
        } else {
          const errorData = await proxyResponse.json()
          console.error('❌ [AUTH-HELPER] Proxy failed:', errorData.error)
          return { user: null, error: errorData.error || 'Authentication failed' }
        }
      } catch (proxyError: any) {
        console.error('❌ [AUTH-HELPER] Proxy request failed:', proxyError.message)
        // Don't return error if it's just no user
        return { user: null, error: null }
      }
    }

    // If direct failed for other reasons, return the error
    if (error) {
      console.error('❌ [AUTH-HELPER] Direct auth failed:', error.message)
      return { user: null, error: error.message }
    }

    // No user found
    return { user: null, error: null }

  } catch (error: any) {
    console.error('❌ [AUTH-HELPER] Unexpected error:', error.message)

    // Try proxy as last resort
    try {
      console.log('🔄 [AUTH-HELPER] Attempting proxy as fallback...')
      const proxyResponse = await fetch('/api/auth/proxy-user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json()
        if (proxyData.user) {
          console.log('✅ [AUTH-HELPER] Fallback proxy successful:', proxyData.user.id)
          return { user: proxyData.user, error: null }
        }
      }
    } catch (fallbackError) {
      console.error('❌ [AUTH-HELPER] Fallback proxy also failed')
    }

    return { user: null, error: error.message || 'Authentication check failed' }
  }
}