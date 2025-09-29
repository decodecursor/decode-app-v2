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

    // Manually set session cookies on the response
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

    // Set the session cookies in the format Supabase SSR expects
    const sessionString = JSON.stringify(sessionData)

    // Cookie options matching Supabase SSR defaults
    const cookieOptions = {
      httpOnly: false, // Supabase client needs to read these
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    }

    // Chunk the raw JSON string using URL encoding like Supabase SSR does
    const MAX_CHUNK_SIZE = 3180
    const cookieName = `sb-${projectRef}-auth-token`

    // URL encode the value for chunking
    let encodedValue = encodeURIComponent(sessionString)

    if (encodedValue.length <= MAX_CHUNK_SIZE) {
      // Single cookie if it fits
      console.log(`📝 [PROXY-LOGIN] Setting single cookie: ${cookieName}`)
      response.cookies.set(cookieName, sessionString, cookieOptions)
    } else {
      // Multiple chunks needed
      const chunks: string[] = []

      while (encodedValue.length > 0) {
        let encodedChunkHead = encodedValue.slice(0, MAX_CHUNK_SIZE)
        const lastEscapePos = encodedChunkHead.lastIndexOf('%')

        // Check if we're splitting in the middle of an escape sequence
        if (lastEscapePos > MAX_CHUNK_SIZE - 3) {
          encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos)
        }

        // Decode back to get the actual chunk value
        const chunkValue = decodeURIComponent(encodedChunkHead)
        chunks.push(chunkValue)

        // Remove processed part from encodedValue
        encodedValue = encodedValue.slice(encodedChunkHead.length)
      }

      console.log(`📝 [PROXY-LOGIN] Setting ${chunks.length} cookie chunks for project: ${projectRef}`)
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