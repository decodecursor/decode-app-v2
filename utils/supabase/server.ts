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
              const sameSiteValue = process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const
              const mobileOptions = {
                ...options,
                // Use 'none' for production to ensure cookies work on mobile
                // but 'lax' for development
                sameSite: sameSiteValue,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                // Extend expiry for mobile browsers
                maxAge: options?.maxAge || 60 * 60 * 13, // 13 hours
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