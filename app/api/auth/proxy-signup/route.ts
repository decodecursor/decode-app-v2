import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Direct auth proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  console.log('🔄 [PROXY-SIGNUP] === PROXY SIGNUP ROUTE CALLED ===')
  console.log('🔄 [PROXY-SIGNUP] Timestamp:', new Date().toISOString())
  console.log('🔄 [PROXY-SIGNUP] Node version:', process.version)
  console.log('🔄 [PROXY-SIGNUP] Environment:', process.env.NODE_ENV)
  
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
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('🔍 [PROXY-SIGNUP] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 30) || 'missing',
      serviceRoleKeyPrefix: serviceRoleKey?.substring(0, 20) || 'missing',
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')).sort()
    })

    if (!supabaseUrl) {
      console.error('❌ [PROXY-SIGNUP] Missing NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json(
        { error: 'Server configuration error - missing Supabase URL' },
        { status: 500 }
      )
    }

    if (!serviceRoleKey) {
      console.error('❌ [PROXY-SIGNUP] Missing SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json(
        { error: 'Server configuration error - missing service role key' },
        { status: 500 }
      )
    }
    
    // Use service role Supabase client for server-side signup (bypasses RLS)
    let supabase
    try {
      supabase = createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      console.log('✅ Supabase service client created successfully')
    } catch (clientError) {
      console.error('❌ Failed to create Supabase service client:', clientError)
      return NextResponse.json(
        { error: 'Failed to initialize authentication service' },
        { status: 500 }
      )
    }
    
    // Attempt signup
    console.log('🚀 Starting Supabase signup...')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    console.log('📝 Signup result:', { 
      hasData: !!data, 
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      hasError: !!error,
      errorMessage: error?.message
    })
    
    if (error) {
      console.error('❌ Supabase signup error:', {
        message: error.message,
        status: error.status,
        code: error.code || 'no_code'
      })
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    if (!data) {
      console.error('❌ No data returned from signup')
      return NextResponse.json(
        { error: 'No data returned from signup' },
        { status: 500 }
      )
    }

    console.log('✅ Signup successful:', {
      userId: data.user?.id,
      userEmail: data.user?.email,
      hasSession: !!data.session
    })
    
    // Return success with user and session data (matches client-side signUp response)
    return NextResponse.json({
      user: data.user,
      session: data.session,
      success: true
    })
    
  } catch (error: any) {
    console.error('💥 [PROXY-SIGNUP] TOP LEVEL ERROR CAUGHT:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500) || 'no stack',
      cause: error.cause || 'no cause',
      toString: error.toString(),
      typeof: typeof error
    })
    
    // Try to return a proper error response even if something is very wrong
    try {
      return NextResponse.json(
        { 
          error: 'Server error during signup', 
          details: error.message || 'Unknown error',
          errorType: error.name || 'UnknownError'
        },
        { status: 500 }
      )
    } catch (responseError) {
      console.error('💥 [PROXY-SIGNUP] FAILED TO RETURN ERROR RESPONSE:', responseError)
      // Last resort - return a basic response
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}