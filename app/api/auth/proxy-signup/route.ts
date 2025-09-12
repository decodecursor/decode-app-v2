import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Direct auth proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🔄 [PROXY-SIGNUP] === PROXY SIGNUP ROUTE CALLED ===')
  console.log('🔄 [PROXY-SIGNUP] Timestamp:', new Date().toISOString())
  console.log('🔄 [PROXY-SIGNUP] Node version:', process.version)
  console.log('🔄 [PROXY-SIGNUP] Environment:', process.env.NODE_ENV)
  console.log('🔄 [PROXY-SIGNUP] Route URL:', request.url)
  console.log('🔄 [PROXY-SIGNUP] User agent:', request.headers.get('user-agent'))
  console.log('🔄 [PROXY-SIGNUP] Vercel region:', process.env.VERCEL_REGION || 'unknown')
  
  try {
    console.log('🔄 [PROXY-SIGNUP] Request received')
    console.log('🔄 [PROXY-SIGNUP] Request method:', request.method)
    console.log('🔄 [PROXY-SIGNUP] Request URL:', request.url)
    console.log('🔄 [PROXY-SIGNUP] Request headers:', Object.fromEntries(request.headers.entries()))
    
    // Parse request body
    let requestData
    try {
      requestData = await request.json()
      console.log('📝 [PROXY-SIGNUP] Request data parsed successfully:', { 
        hasEmail: !!requestData.email, 
        hasPassword: !!requestData.password,
        emailLength: requestData.email?.length || 0,
        passwordLength: requestData.password?.length || 0,
        emailType: typeof requestData.email,
        passwordType: typeof requestData.password
      })
    } catch (parseError) {
      console.error('❌ [PROXY-SIGNUP] Failed to parse request JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { email, password } = requestData
    
    // Enhanced validation
    if (!email || !password) {
      console.error('❌ Missing credentials:', { hasEmail: !!email, hasPassword: !!password })
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      console.error('❌ Invalid credential types:', { emailType: typeof email, passwordType: typeof password })
      return NextResponse.json(
        { error: 'Email and password must be strings' },
        { status: 400 }
      )
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format:', email.substring(0, 5) + '***')
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      console.error('❌ Password too short:', password.length)
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    if (password.length > 72) {
      console.error('❌ Password too long:', password.length)
      return NextResponse.json(
        { error: 'Password must be 72 characters or less' },
        { status: 400 }
      )
    }
    
    console.log('📧 Attempting signup for email:', email.substring(0, 3) + '***@' + email.split('@')[1])
    
    // Check environment variables with detailed logging
    console.log('🔍 [PROXY-SIGNUP] Checking environment variables...')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    console.log('🔍 [PROXY-SIGNUP] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasAnonKey: !!anonKey,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 30) || 'missing',
      anonKeyPrefix: anonKey?.substring(0, 20) || 'missing',
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')).sort()
    })

    if (!supabaseUrl) {
      console.error('❌ [PROXY-SIGNUP] Missing NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json(
        { error: 'Server configuration error - missing Supabase URL' },
        { status: 500 }
      )
    }

    if (!anonKey) {
      console.error('❌ [PROXY-SIGNUP] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
      return NextResponse.json(
        { error: 'Server configuration error - missing anon key' },
        { status: 500 }
      )
    }
    
    // Use anon key Supabase client for server-side signup (correct for user auth operations)
    let supabase
    try {
      supabase = createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          },
          global: {
            headers: {
              'x-proxy-signup': 'true',
              'x-request-id': `proxy-signup-${Date.now()}`,
              'apikey': anonKey
            },
            fetch: (url, options = {}) => {
              console.log('🌐 [PROXY-SIGNUP] Making fetch request to:', url)
              return fetch(url, {
                ...options,
                headers: {
                  ...(options.headers || {}),
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'User-Agent': 'decode-app-proxy/1.0'
                }
              })
            }
          }
        }
      )
      console.log('✅ [PROXY-SIGNUP] Supabase anon client created successfully')
      
    } catch (clientError) {
      console.error('❌ [PROXY-SIGNUP] Failed to create Supabase anon client:', clientError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to initialize authentication service',
          details: clientError.message
        },
        { status: 500 }
      )
    }
    
    // Attempt signup with timeout (no retries to avoid rate limit exhaustion)
    console.log('🚀 [PROXY-SIGNUP] Starting Supabase signup...')
    
    let signupResult
    try {
      signupResult = await Promise.race([
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              email_confirm: true
            }
          }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Signup timeout after 20 seconds')), 20000)
        )
      ])
      
      console.log('✅ [PROXY-SIGNUP] Signup successful')
    } catch (signupError: any) {
      console.error('❌ [PROXY-SIGNUP] Signup failed:', {
        message: signupError.message,
        name: signupError.name,
        cause: signupError.cause
      })
      
      // Don't retry - just throw the error to handle it properly
      throw signupError
    }
    
    const { data, error } = signupResult
    
    console.log('📝 [PROXY-SIGNUP] Signup result:', { 
      hasData: !!data, 
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      hasError: !!error,
      errorMessage: error?.message,
      processingTimeMs: Date.now() - startTime
    })
    
    if (error) {
      console.error('❌ [PROXY-SIGNUP] Supabase signup error:', {
        message: error.message,
        status: error.status,
        code: error.code || 'no_code'
      })
      
      // Map common errors to user-friendly messages
      let userMessage = error.message
      let errorCode = error.code || 'SIGNUP_ERROR'
      
      if (error.message?.includes('Email rate limit exceeded') || error.message?.includes('rate limit') || error.status === 429) {
        userMessage = 'Email rate limit reached. Please wait 10-15 minutes before trying again, or try logging in if you already have an account.'
        errorCode = 'RATE_LIMIT_ERROR'
      } else if (error.message?.includes('User already registered')) {
        userMessage = 'This email is already registered. Try logging in instead.'
        errorCode = 'USER_EXISTS'
      } else if (error.message?.includes('Invalid email')) {
        userMessage = 'Please provide a valid email address.'
        errorCode = 'INVALID_EMAIL'
      } else if (error.message?.includes('weak password') || error.message?.includes('Password')) {
        userMessage = 'Password must be at least 6 characters long.'
        errorCode = 'WEAK_PASSWORD'
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: userMessage,
          code: errorCode,
          originalError: error.message,
          retryAfter: errorCode === 'RATE_LIMIT_ERROR' ? '15 minutes' : undefined
        },
        { status: error.status || 400 }
      )
    }
    
    if (!data) {
      console.error('❌ [PROXY-SIGNUP] No data returned from signup')
      return NextResponse.json(
        { 
          success: false,
          error: 'No data returned from signup',
          code: 'NO_DATA_ERROR'
        },
        { status: 500 }
      )
    }

    console.log('✅ [PROXY-SIGNUP] Signup successful:', {
      userId: data.user?.id,
      userEmail: data.user?.email,
      emailConfirmed: !!data.user?.email_confirmed_at,
      hasSession: !!data.session,
      processingTimeMs: Date.now() - startTime
    })
    
    // Return success with user and session data (matches client-side signUp response format)
    const response = {
      success: true,
      user: data.user,
      session: data.session,
      processingTimeMs: Date.now() - startTime
    }
    
    console.log('📤 [PROXY-SIGNUP] Returning successful response')
    return NextResponse.json(response)
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime
    console.error('💥 [PROXY-SIGNUP] TOP LEVEL ERROR CAUGHT:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500) || 'no stack',
      cause: error.cause || 'no cause',
      toString: error.toString(),
      typeof: typeof error,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      nodeEnv: process.env.NODE_ENV,
      vercelRegion: process.env.VERCEL_REGION,
      requestUrl: request?.url || 'unknown'
    })
    
    // Log environment status for debugging
    console.error('🔍 [PROXY-SIGNUP] Environment debug:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrlLen: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      anonKeyLen: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
    })
    
    // Map errors to user-friendly messages
    let userMessage = 'Server error during signup'
    let errorCode = 'SERVER_ERROR'
    
    if (error.message?.includes('Email rate limit exceeded') || error.message?.includes('rate limit') || error.status === 429) {
      userMessage = 'Email rate limit reached. Please wait 10-15 minutes before trying again, or try logging in if you already have an account.'
      errorCode = 'RATE_LIMIT_ERROR'
    } else if (error.message?.includes('fetch')) {
      userMessage = 'Network connection error. Please check your internet connection and try again.'
      errorCode = 'NETWORK_ERROR'
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Request timed out. Please try again.'
      errorCode = 'TIMEOUT_ERROR'
    } else if (error.name === 'TypeError') {
      userMessage = 'Configuration error. Please try again or contact support.'
      errorCode = 'CONFIG_ERROR'
    }
    
    // Try to return a proper error response even if something is very wrong
    try {
      return NextResponse.json(
        { 
          success: false,
          error: userMessage,
          code: errorCode,
          details: error.message || 'Unknown error',
          errorType: error.name || 'UnknownError',
          processingTimeMs: processingTime,
          retryAfter: errorCode === 'RATE_LIMIT_ERROR' ? '15 minutes' : undefined
        },
        { status: errorCode === 'RATE_LIMIT_ERROR' ? 429 : 500 }
      )
    } catch (responseError) {
      console.error('💥 [PROXY-SIGNUP] FAILED TO RETURN ERROR RESPONSE:', responseError)
      // Last resort - return a basic response that matches expected format
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        code: 'RESPONSE_ERROR'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}