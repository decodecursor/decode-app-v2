import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Direct auth verification proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  try {
    const { token, type } = await request.json()
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      )
    }
    
    if (!type) {
      return NextResponse.json(
        { error: 'Type required (e.g., "signup")' },
        { status: 400 }
      )
    }
    
    // Use service role Supabase client for server-side verification (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Attempt email verification
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'signup' | 'email_change'
    })
    
    if (error) {
      console.error('Verification error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    // Return success with user and session data (matches client-side verifyOtp response)
    return NextResponse.json({
      user: data.user,
      session: data.session,
      success: true
    })
    
  } catch (error: any) {
    console.error('Proxy verification error:', error)
    return NextResponse.json(
      { error: 'Server error during verification', details: error.message },
      { status: 500 }
    )
  }
}