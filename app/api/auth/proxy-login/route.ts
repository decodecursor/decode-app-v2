import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

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

    // Manually set session cookies to ensure they're available for subsequent requests
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const projectRef = supabaseUrl.split('//')[1].split('.')[0]

    // Prepare session data for cookies
    const sessionData = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.user
    }

    // Set the session cookies in the format Supabase expects
    const sessionString = JSON.stringify(sessionData)
    const sessionBase64 = Buffer.from(sessionString).toString('base64')

    // Cookie options
    const cookieOptions = {
      httpOnly: false, // Supabase client needs to read these
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }

    // Set the auth token cookies (Supabase uses chunked cookies)
    const chunkSize = 3900 // Max cookie size is ~4KB
    const chunks = []

    for (let i = 0; i < sessionBase64.length; i += chunkSize) {
      chunks.push(sessionBase64.slice(i, i + chunkSize))
    }

    // Set each chunk as a separate cookie
    chunks.forEach((chunk, index) => {
      cookieStore.set(
        `sb-${projectRef}-auth-token.${index}`,
        chunk,
        cookieOptions
      )
    })

    // Also set a marker cookie
    cookieStore.set(
      `sb-${projectRef}-auth-token`,
      'base64-' + chunks.length,
      cookieOptions
    )

    console.log('✅ Proxy login successful for user:', data.user.email)

    // Return success
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