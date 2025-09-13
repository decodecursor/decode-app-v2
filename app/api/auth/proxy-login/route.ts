import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Direct auth proxy that runs on Vercel servers (avoiding UAE network issues)
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    // Use server-side Supabase client (runs on Vercel, not affected by UAE issues)
    const supabase = await createClient()

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'Login failed - no session created' },
        { status: 401 }
      )
    }

    // Create response with session data
    const response = NextResponse.json({
      user: data.user,
      session: data.session,
      success: true
    })

    // Set session cookies for better compatibility
    const expiresAt = new Date(data.session.expires_at! * 1000)
    const isProduction = process.env.NODE_ENV === 'production'

    // Set the auth token cookie
    response.cookies.set({
      name: 'sb-auth-token',
      value: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: 'bearer',
        user: data.user
      }),
      httpOnly: false, // Allow client-side access
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt
    })

    // Also set a backup cookie
    response.cookies.set({
      name: 'sb-backup-session',
      value: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
        expires_at: data.session.expires_at,
        stored_at: Date.now()
      }),
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt
    })

    console.log('✅ Proxy login successful, cookies set')
    return response

  } catch (error: any) {
    console.error('Proxy login error:', error)
    return NextResponse.json(
      { error: 'Server error during login', details: error.message },
      { status: 500 }
    )
  }
}