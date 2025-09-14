import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// User session proxy that runs on Vercel servers (avoiding network issues)

// GET method - uses server-side Supabase client to get user
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER GET] Request received')

    // Use server-side Supabase client which automatically reads cookies
    const supabase = await createClient()

    // Get user - this automatically reads the session cookies that were set during login
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [PROXY-USER GET] Error getting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('❌ [PROXY-USER GET] No authenticated user found')
      return NextResponse.json(
        { error: 'No authenticated user' },
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

// POST method - legacy endpoint for backward compatibility
// New code should use GET method instead
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER POST] Request received')

    // For POST requests, we still use the server client
    // This maintains backward compatibility but uses the same approach as GET
    const supabase = await createClient()

    // Get user - this automatically reads the session cookies
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [PROXY-USER POST] Error getting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('❌ [PROXY-USER POST] No authenticated user found')
      return NextResponse.json(
        { error: 'No authenticated user' },
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