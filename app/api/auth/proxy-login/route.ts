import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Direct auth proxy that runs on Vercel servers (avoiding network issues)
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    // Use server-side Supabase client (runs on Vercel, not affected by network issues)
    const supabase = await createClient()

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Proxy login error:', error)
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

    // Use Supabase SSR to properly set the session cookies
    // This ensures cookies are in the correct format that the client can read
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })

    if (sessionError) {
      console.error('❌ [PROXY-LOGIN] Failed to set session cookies:', sessionError.message)
      return NextResponse.json(
        { error: 'Failed to establish session' },
        { status: 500 }
      )
    }

    console.log('✅ [PROXY-LOGIN] Session cookies set properly via Supabase SSR for user:', data.user.email)

    // Return success response - cookies are already set by Supabase SSR
    return NextResponse.json({
      success: true,
      message: 'Login successful'
    })

  } catch (error: any) {
    console.error('Proxy login server error:', error)
    return NextResponse.json(
      { error: 'Server error during login', details: error.message },
      { status: 500 }
    )
  }
}