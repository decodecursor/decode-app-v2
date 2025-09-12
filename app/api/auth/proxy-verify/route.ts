import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Direct auth verification proxy that runs on Vercel servers (avoiding VPN/network issues)
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🔄 [PROXY-VERIFY] === EMAIL VERIFICATION PROXY CALLED ===')
  
  try {
    const { token, type } = await request.json()
    
    if (!token || !type) {
      console.error('❌ [PROXY-VERIFY] Missing token or type:', { hasToken: !!token, hasType: !!type })
      return NextResponse.json(
        { 
          success: false,
          error: 'Token and type are required',
          code: 'MISSING_PARAMS'
        },
        { status: 400 }
      )
    }
    
    console.log('🔍 [PROXY-VERIFY] Verifying token:', {
      tokenPrefix: token.substring(0, 20) + '...',
      type,
      timestamp: new Date().toISOString()
    })
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !anonKey) {
      console.error('❌ [PROXY-VERIFY] Missing environment variables')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    // Use anon key Supabase client for server-side verification (correct for user auth operations)
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'x-proxy-verify': 'true',
          'x-request-id': `proxy-verify-${Date.now()}`
        }
      }
    })
    
    console.log('🚀 [PROXY-VERIFY] Starting email verification...')
    
    // Attempt verification with timeout
    let verifyResult
    try {
      verifyResult = await Promise.race([
        supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'signup' | 'recovery' | 'invite' | 'email_change' | 'phone_change'
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Verification timeout after 15 seconds')), 15000)
        )
      ])
    } catch (timeoutError) {
      console.error('⏰ [PROXY-VERIFY] Verification timeout:', timeoutError.message)
      return NextResponse.json(
        { 
          success: false,
          error: 'Verification request timed out',
          code: 'TIMEOUT_ERROR'
        },
        { status: 408 }
      )
    }
    
    const { data, error } = verifyResult
    
    console.log('📝 [PROXY-VERIFY] Verification result:', { 
      hasData: !!data,
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      hasError: !!error,
      errorMessage: error?.message,
      processingTimeMs: Date.now() - startTime
    })
    
    if (error) {
      console.error('❌ [PROXY-VERIFY] Verification error:', error)
      
      let userMessage = error.message
      if (error.message?.includes('expired')) {
        userMessage = 'Verification link has expired. Please request a new one.'
      } else if (error.message?.includes('invalid')) {
        userMessage = 'Invalid verification link. Please check your email for the correct link.'
      } else if (error.message?.includes('rate limit')) {
        userMessage = 'Too many verification attempts. Please wait a moment and try again.'
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: userMessage,
          code: error.code || 'VERIFICATION_ERROR',
          originalError: error.message
        },
        { status: 400 }
      )
    }
    
    if (!data || !data.user) {
      console.error('❌ [PROXY-VERIFY] No user data returned from verification')
      return NextResponse.json(
        { 
          success: false,
          error: 'Verification completed but no user data returned',
          code: 'NO_USER_DATA'
        },
        { status: 500 }
      )
    }
    
    console.log('✅ [PROXY-VERIFY] Email verification successful:', {
      userId: data.user.id,
      userEmail: data.user.email,
      emailConfirmed: !!data.user.email_confirmed_at,
      hasSession: !!data.session,
      processingTimeMs: Date.now() - startTime
    })
    
    // Return success with user and session data (matches client-side verifyOtp response)
    const response = {
      success: true,
      user: data.user,
      session: data.session,
      processingTimeMs: Date.now() - startTime
    }
    
    console.log('📤 [PROXY-VERIFY] Returning successful verification response')
    return NextResponse.json(response)
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime
    console.error('💥 [PROXY-VERIFY] Top level error:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500),
      processingTimeMs: processingTime
    })
    
    let userMessage = 'Server error during verification'
    let errorCode = 'SERVER_ERROR'
    
    if (error.message?.includes('fetch')) {
      userMessage = 'Network connection error during verification. Please try again.'
      errorCode = 'NETWORK_ERROR'
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Verification timed out. Please try again.'
      errorCode = 'TIMEOUT_ERROR'
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: userMessage,
        code: errorCode,
        details: error.message,
        processingTimeMs: processingTime
      },
      { status: 500 }
    )
  }
}