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

  // Skip auth operations for public and static routes
  const pathname = request.nextUrl.pathname
  const isPublicRoute =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg')

  if (!isPublicRoute) {
    // Only try to get the user, don't force refresh
    try {
      await supabase.auth.getUser()
    } catch (error) {
      // Silent fail - let the client handle auth state
      console.log('Middleware: Auth check skipped due to error')
    }
  }

  return supabaseResponse
}