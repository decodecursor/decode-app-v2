import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// User session proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER] Request received')
    
    // Parse request body to get access token
    let requestData
    try {
      requestData = await request.json()
    } catch (parseError) {
      console.error('❌ [PROXY-USER] Failed to parse request JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { access_token } = requestData
    
    if (!access_token) {
      console.error('❌ [PROXY-USER] Missing access token')
      return NextResponse.json(
        { error: 'Access token required' },
        { status: 400 }
      )
    }
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [PROXY-USER] Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error - missing environment variables' },
        { status: 500 }
      )
    }
    
    // Use service role Supabase client (service role IS needed for getUser with access token)
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Get user info using the access token
    const { data: { user }, error } = await supabase.auth.getUser(access_token)
    
    if (error) {
      console.error('❌ [PROXY-USER] Error getting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    
    if (!user) {
      console.error('❌ [PROXY-USER] No user found')
      return NextResponse.json(
        { error: 'No user found' },
        { status: 404 }
      )
    }
    
    console.log('✅ [PROXY-USER] User retrieved successfully:', user.id)
    
    // Return user data
    return NextResponse.json({
      user: user,
      success: true
    })
    
  } catch (error: any) {
    console.error('💥 [PROXY-USER] Proxy user error:', error)
    return NextResponse.json(
      { error: 'Server error during user retrieval', details: error.message },
      { status: 500 }
    )
  }
}