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
    // This client automatically handles cookie setting via the setAll callback in server.ts
    const supabase = await createClient()

    // Attempt login - cookies will be set automatically
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

    console.log('✅ Proxy login successful for user:', data.user.email)

    // Return success - cookies have been automatically set by Supabase
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