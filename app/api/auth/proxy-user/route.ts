import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// User session proxy that runs on Vercel servers (avoiding VPN/network issues)

// GET method - extracts access token from cookies
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER GET] Request received')

    // Get access token from cookies - Supabase stores session in multiple cookies
    const cookieStore = await cookies()

    // Try to find the Supabase auth token cookie
    // The cookie name format is: sb-[project-ref]-auth-token.0 and sb-[project-ref]-auth-token.1
    const allCookies = cookieStore.getAll()
    let sessionData: any = null

    // Look for Supabase session cookies
    for (const cookie of allCookies) {
      if (cookie.name.includes('auth-token')) {
        try {
          // Supabase splits the session into multiple cookies
          if (cookie.name.endsWith('.0')) {
            // First part contains the base64 encoded session
            const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8')
            sessionData = JSON.parse(decoded)
            break
          }
        } catch (e) {
          console.log('Failed to parse cookie:', cookie.name, e)
        }
      }
    }

    if (!sessionData) {
      console.error('❌ [PROXY-USER GET] No auth session found in cookies')
      return NextResponse.json(
        { error: 'No authentication session found' },
        { status: 401 }
      )
    }

    const access_token = sessionData.access_token

    if (!access_token) {
      console.error('❌ [PROXY-USER GET] Could not extract access token from cookie')
      return NextResponse.json(
        { error: 'Invalid authentication token format' },
        { status: 401 }
      )
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [PROXY-USER GET] Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error - missing environment variables' },
        { status: 500 }
      )
    }

    // Use service role Supabase client
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
      console.error('❌ [PROXY-USER GET] Error getting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.error('❌ [PROXY-USER GET] No user found')
      return NextResponse.json(
        { error: 'No user found' },
        { status: 404 }
      )
    }

    console.log('✅ [PROXY-USER GET] User retrieved successfully:', user.id)

    // Return user data
    return NextResponse.json({
      user: user,
      success: true
    })

  } catch (error: any) {
    console.error('💥 [PROXY-USER GET] Proxy user error:', error)
    return NextResponse.json(
      { error: 'Server error during user retrieval', details: error.message },
      { status: 500 }
    )
  }
}

// POST method - accepts access token in request body (original implementation)
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