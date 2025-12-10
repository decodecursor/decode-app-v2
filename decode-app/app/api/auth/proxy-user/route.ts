import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// User session proxy using standard server client
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER GET] Request received')

    // Use standard server client with automatic cookie handling
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [PROXY-USER GET] Auth error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('❌ [PROXY-USER GET] No authenticated user found')
      return NextResponse.json(
        { error: 'No authenticated user found' },
        { status: 401 }
      )
    }

    console.log('✅ [PROXY-USER GET] User authenticated:', user.id)

    return NextResponse.json({
      success: true,
      user: user
    })

  } catch (error: any) {
    console.error('❌ [PROXY-USER GET] Unexpected error:', error.message)

    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

// POST method for manual session setting (legacy support)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-USER POST] Request received')

    const { access_token, refresh_token } = await request.json()

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Tokens required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })

    if (error) {
      console.error('❌ [PROXY-USER POST] Session error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.log('✅ [PROXY-USER POST] Session set successfully')

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session
    })

  } catch (error: any) {
    console.error('❌ [PROXY-USER POST] Unexpected error:', error.message)

    return NextResponse.json(
      { error: 'Session setup failed' },
      { status: 500 }
    )
  }
}