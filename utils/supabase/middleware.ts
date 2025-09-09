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
              // Ensure cookies are properly configured for development
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              httpOnly: false, // Allow client-side access for session management
            })
          )
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  try {
    await supabase.auth.getUser()
  } catch (error) {
    // In development, don't fail hard on auth errors
    if (process.env.NODE_ENV === 'development') {
      console.warn('Auth refresh failed in development mode:', error)
    }
  }

  return supabaseResponse
}