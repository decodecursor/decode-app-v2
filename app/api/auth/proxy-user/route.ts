import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// User session proxy that runs on Vercel servers (avoiding network issues)

// GET method - reads manually-set cookies and retrieves user
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER GET] Request received from:', request.headers.get('referer') || 'unknown')

    // Get access token from cookies - manually parse since we manually set them
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    let sessionData: any = null

    // Debug: Log all cookies
    console.log('🍪 [PROXY-USER] All cookies:', allCookies.map(c => c.name))

    // Look for Supabase session cookies
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    console.log('🔍 [PROXY-USER] Looking for cookies with name:', cookieName)

    // Check if it's a single cookie or chunked
    const singleCookie = allCookies.find(c => c.name === cookieName)

    if (singleCookie) {
      // Single cookie - parse directly
      console.log('✅ [PROXY-USER] Found single session cookie')
      try {
        sessionData = JSON.parse(singleCookie.value)
        console.log('Successfully parsed session from single cookie')
      } catch (e) {
        console.log('Failed to parse session:', e)
      }
    } else {
      // Look for chunked cookies
      const chunks: string[] = []
      let chunkIndex = 0

      while (true) {
        const chunkCookie = allCookies.find(c => c.name === `${cookieName}.${chunkIndex}`)
        if (!chunkCookie) break
        chunks.push(chunkCookie.value)
        chunkIndex++
      }

      if (chunks.length > 0) {
        console.log(`✅ [PROXY-USER] Found ${chunks.length} cookie chunks to reconstruct`)
        try {
          // Combine chunks and parse
          const fullSession = chunks.join('')
          sessionData = JSON.parse(fullSession)
          console.log('Successfully reconstructed session from chunked cookies')
        } catch (e) {
          console.log('Failed to parse reconstructed session:', e)
        }
      } else {
        console.log('❌ [PROXY-USER] No session cookies found')
      }
    }

    if (!sessionData) {
      console.log('❌ [PROXY-USER GET] No auth session found in cookies')
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

    // Use service role to get user with access token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [PROXY-USER GET] Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

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
      console.log('❌ [PROXY-USER GET] No user found')
      return NextResponse.json(
        { error: 'No user found' },
        { status: 401 }
      )
    }

    console.log('✅ [PROXY-USER GET] User retrieved successfully:', user.id)

    // Return user data
    return NextResponse.json({
      user: user,
      success: true
    })

  } catch (error: any) {
    console.error('💥 [PROXY-USER GET] Server error:', error)
    return NextResponse.json(
      { error: 'Server error during user retrieval', details: error.message },
      { status: 500 }
    )
  }
}

// POST method - same implementation as GET for consistency
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER POST] Request received')

    // Get access token from cookies - manually parse since we manually set them
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    let sessionData: any = null

    // Debug: Log all cookies
    console.log('🍪 [PROXY-USER] All cookies:', allCookies.map(c => c.name))

    // Look for Supabase session cookies
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    console.log('🔍 [PROXY-USER] Looking for cookies with name:', cookieName)

    // Check if it's a single cookie or chunked
    const singleCookie = allCookies.find(c => c.name === cookieName)

    if (singleCookie) {
      // Single cookie - parse directly
      console.log('✅ [PROXY-USER] Found single session cookie')
      try {
        sessionData = JSON.parse(singleCookie.value)
        console.log('Successfully parsed session from single cookie')
      } catch (e) {
        console.log('Failed to parse session:', e)
      }
    } else {
      // Look for chunked cookies
      const chunks: string[] = []
      let chunkIndex = 0

      while (true) {
        const chunkCookie = allCookies.find(c => c.name === `${cookieName}.${chunkIndex}`)
        if (!chunkCookie) break
        chunks.push(chunkCookie.value)
        chunkIndex++
      }

      if (chunks.length > 0) {
        console.log(`✅ [PROXY-USER] Found ${chunks.length} cookie chunks to reconstruct`)
        try {
          // Combine chunks and parse
          const fullSession = chunks.join('')
          sessionData = JSON.parse(fullSession)
          console.log('Successfully reconstructed session from chunked cookies')
        } catch (e) {
          console.log('Failed to parse reconstructed session:', e)
        }
      } else {
        console.log('❌ [PROXY-USER] No session cookies found')
      }
    }

    if (!sessionData) {
      console.log('❌ [PROXY-USER POST] No auth session found in cookies')
      return NextResponse.json(
        { error: 'No authentication session found' },
        { status: 401 }
      )
    }

    const access_token = sessionData.access_token

    if (!access_token) {
      console.error('❌ [PROXY-USER POST] Could not extract access token from cookie')
      return NextResponse.json(
        { error: 'Invalid authentication token format' },
        { status: 401 }
      )
    }

    // Use service role to get user with access token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [PROXY-USER POST] Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

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
      console.error('❌ [PROXY-USER POST] Error getting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('❌ [PROXY-USER POST] No user found')
      return NextResponse.json(
        { error: 'No user found' },
        { status: 401 }
      )
    }

    console.log('✅ [PROXY-USER POST] User retrieved successfully:', user.id)

    // Return user data
    return NextResponse.json({
      user: user,
      success: true
    })

  } catch (error: any) {
    console.error('💥 [PROXY-USER POST] Server error:', error)
    return NextResponse.json(
      { error: 'Server error during user retrieval', details: error.message },
      { status: 500 }
    )
  }
}