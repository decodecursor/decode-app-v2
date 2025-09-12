import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Direct auth proxy that runs on Vercel servers (avoiding VPN/network issues)
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
    
    // Attempt signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) {
      console.error('Signup error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    // Return success with user and session data (matches client-side signUp response)
    return NextResponse.json({
      user: data.user,
      session: data.session,
      success: true
    })
    
  } catch (error: any) {
    console.error('Proxy signup error:', error)
    return NextResponse.json(
      { error: 'Server error during signup', details: error.message },
      { status: 500 }
    )
  }
}