import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Direct auth proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Proxy signup request received')
    
    // Parse request body
    let requestData
    try {
      requestData = await request.json()
      console.log('📝 Request data parsed:', { 
        hasEmail: !!requestData.email, 
        hasPassword: !!requestData.password,
        emailLength: requestData.email?.length || 0
      })
    } catch (parseError) {
      console.error('❌ Failed to parse request JSON:', parseError)
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
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('🔍 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 20) || 'missing'
    })

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error - missing environment variables' },
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
    console.error('💥 Proxy signup error:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 200) || 'no stack'
    })
    return NextResponse.json(
      { error: 'Server error during signup', details: error.message },
      { status: 500 }
    )
  }
}