import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Session refresh proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json()
    
    if (!refresh_token) {
      return NextResponse.json(
        { error: 'Refresh token required' },
        { status: 400 }
      )
    }
    
    // Use server-side Supabase client (runs on Vercel, not affected by network issues)
    const supabase = await createClient()
    
    // Attempt to refresh the session
    const { data, error } = await supabase.auth.setSession({
      access_token: '', // Will be refreshed
      refresh_token: refresh_token
    })
    
    if (error) {
      console.error('Session refresh error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    
    if (!data.session) {
      return NextResponse.json(
        { error: 'Failed to refresh session' },
        { status: 401 }
      )
    }
    
    // Return refreshed session data
    return NextResponse.json({
      session: data.session,
      user: data.user,
      success: true
    })
    
  } catch (error: any) {
    console.error('Proxy session refresh error:', error)
    return NextResponse.json(
      { error: 'Server error during session refresh', details: error.message },
      { status: 500 }
    )
  }
}