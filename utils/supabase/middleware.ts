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

  // Skip auth refresh for auth routes to improve performance
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  
  if (!isAuthRoute) {
    // Check if we have a proxy session first (to avoid interfering with it)
    let hasProxySession = false
    try {
      const cookies = request.cookies.getAll()
      const authCookie = cookies.find(c => c.name.startsWith('sb-auth-token'))
      
      if (authCookie?.value) {
        const sessionData = JSON.parse(authCookie.value)
        // Check if this looks like a proxy session (has our specific structure)
        if (sessionData.access_token && sessionData.user && sessionData.expires_at) {
          const expiresAt = sessionData.expires_at * 1000 // Convert to milliseconds
          if (expiresAt > Date.now()) {
            hasProxySession = true
            console.log('🔍 Middleware: Found valid proxy session, preserving it')
          }
        }
      }
    } catch (cookieError) {
      // Cookie parsing failed, continue with normal flow
    }
    
    // Only attempt auth refresh if we don't have a valid proxy session
    if (!hasProxySession) {
      try {
        await supabase.auth.getUser()
      } catch (error) {
        // In development, don't fail hard on auth errors
        if (process.env.NODE_ENV === 'development') {
          console.warn('Auth refresh failed in development mode:', error)
        }
      }
    }
  }

  return supabaseResponse
}