import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Ensure cookies work properly in both development and production
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax', // Always use 'lax' for better compatibility
              httpOnly: false, // Allow client-side access for session management
              path: '/', // Ensure cookies are available site-wide
            })
          )
        },
      },
    }
  )

  // REMOVED: Auth checks in middleware - this was causing slowness!
  // The middleware should ONLY handle cookie refresh, not auth checks.
  // Auth checks are handled by components/pages that need them.

  return supabaseResponse
}