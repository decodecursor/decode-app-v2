import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { normalizeRole } from '@/types/user'

export async function getUserWithProxy(): Promise<{ user: User | null, error: string | null }> {
  try {
    // Try proxy first for consistent fast response
    console.log('🔍 [AUTH-HELPER] Attempting proxy getUser...')

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

        // Fall back to direct connection as last resort
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (user && !error) {
          console.log('✅ [AUTH-HELPER] Direct getUser fallback successful:', user.id)
          return { user, error: null }
        }

        return { user: null, error: null }
      } else {
        const errorData = await proxyResponse.json()
        console.error('❌ [AUTH-HELPER] Proxy failed:', errorData.error)
        return { user: null, error: errorData.error || 'Authentication failed' }
      }
    } catch (proxyError: any) {
      console.error('❌ [AUTH-HELPER] Proxy request failed:', proxyError.message)

      // Fall back to direct connection
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (user && !error) {
        console.log('✅ [AUTH-HELPER] Direct getUser fallback successful:', user.id)
        return { user, error: null }
      }

      return { user: null, error: null }
    }

  } catch (error: any) {
    console.error('❌ [AUTH-HELPER] Unexpected error:', error.message)
    return { user: null, error: error.message || 'Authentication check failed' }
  }
}