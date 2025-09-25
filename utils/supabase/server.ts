import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Mobile-friendly cookie settings
              const mobileOptions = {
                ...options,
                // Use 'none' for mobile browsers to ensure cookies work across redirects
                // but fallback to 'lax' for localhost
                sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as const,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                // Extend expiry for mobile browsers
                maxAge: options?.maxAge || 60 * 60 * 24 * 7, // 7 days
              }
              cookieStore.set(name, value, mobileOptions)
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.warn('[COOKIES] Failed to set cookies:', error)
          }
        },
      },
    }
  )
}