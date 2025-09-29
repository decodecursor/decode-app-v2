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

    // Create response first
    const response = NextResponse.json({
      success: true,
      message: 'Login successful'
    })

    // Get the Supabase project ref from the URL
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

    // Convert session data to base64 encoded string (Supabase SSR format)
    const sessionString = Buffer.from(JSON.stringify(sessionData)).toString('base64')

    // Cookie options matching Supabase SSR defaults
    const sameSiteValue: 'none' | 'lax' = process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    const cookieOptions = {
      httpOnly: false, // Client needs to read these
      secure: process.env.NODE_ENV === 'production',
      sameSite: sameSiteValue,
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    }

    // The cookie name format Supabase SSR expects
    const cookieName = `sb-${projectRef}-auth-token`

    // Chunk size for cookies (browsers have limits)
    const MAX_CHUNK_SIZE = 3180

    if (sessionString.length <= MAX_CHUNK_SIZE) {
      // Single cookie if it fits
      console.log(`📝 [PROXY-LOGIN] Setting single cookie: ${cookieName}`)
      response.cookies.set(cookieName, sessionString, cookieOptions)
    } else {
      // Split into multiple chunks if needed
      const chunks: string[] = []
      let currentChunk = sessionString

      while (currentChunk.length > 0) {
        chunks.push(currentChunk.slice(0, MAX_CHUNK_SIZE))
        currentChunk = currentChunk.slice(MAX_CHUNK_SIZE)
      }

      console.log(`📝 [PROXY-LOGIN] Setting ${chunks.length} cookie chunks for project: ${projectRef}`)

      // Set each chunk as a separate cookie
      chunks.forEach((chunk, index) => {
        const chunkName = `${cookieName}.${index}`
        console.log(`  - Setting cookie: ${chunkName} (${chunk.length} chars)`)
        response.cookies.set(chunkName, chunk, cookieOptions)
      })
    }

    console.log('✅ Proxy login successful for user:', data.user.email)

    // Return response with cookies attached
    return response

  } catch (error: any) {
    console.error('Proxy login server error:', error)
    return NextResponse.json(
      { error: 'Server error during login', details: error.message },
      { status: 500 }
    )
  }
}