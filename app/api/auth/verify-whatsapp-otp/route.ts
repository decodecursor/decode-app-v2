import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * POST /api/auth/verify-whatsapp-otp
 *
 * Verifies WhatsApp OTP code and creates authenticated session
 * Implements brute force protection and one-time use
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { phoneNumber, otpCode } = body

    console.log('🔐 [OTP-VERIFY] Verification attempt for phone:', phoneNumber?.substring(0, 7) + '****')

    // Validate inputs
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    if (!otpCode || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode)) {
      return NextResponse.json(
        { error: 'Invalid OTP code. Must be 6 digits.' },
        { status: 400 }
      )
    }

    // Initialize Supabase admin client
    const supabase = await createClient()

    // Fetch the OTP record from database
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !otpRecord) {
      console.log('❌ [OTP-VERIFY] No OTP record found for phone:', phoneNumber.substring(0, 7) + '****')
      return NextResponse.json(
        { error: 'No OTP found. Please request a new code.' },
        { status: 404 }
      )
    }

    // Check if account is locked due to too many failed attempts
    if (otpRecord.locked_until) {
      const lockExpiry = new Date(otpRecord.locked_until)
      if (lockExpiry > new Date()) {
        const minutesRemaining = Math.ceil((lockExpiry.getTime() - Date.now()) / 1000 / 60)
        console.log('🔒 [OTP-VERIFY] Account locked for phone:', phoneNumber.substring(0, 7) + '****')
        return NextResponse.json(
          { error: `Too many failed attempts. Please try again in ${minutesRemaining} minutes.` },
          { status: 429 }
        )
      } else {
        // Lock expired, reset attempts and locked_until
        await supabase
          .from('otp_verifications')
          .update({ attempts: 0, locked_until: null })
          .eq('id', otpRecord.id)
      }
    }

    // Check if OTP has expired (5 minutes)
    const expiryTime = new Date(otpRecord.expires_at)
    if (expiryTime < new Date()) {
      console.log('⏰ [OTP-VERIFY] OTP expired for phone:', phoneNumber.substring(0, 7) + '****')
      return NextResponse.json(
        { error: 'OTP code has expired. Please request a new code.' },
        { status: 410 }
      )
    }

    // Check if OTP has already been used
    if (otpRecord.used) {
      console.log('♻️ [OTP-VERIFY] OTP already used for phone:', phoneNumber.substring(0, 7) + '****')
      return NextResponse.json(
        { error: 'This code has already been used. Please request a new code.' },
        { status: 410 }
      )
    }

    // Verify OTP code matches
    if (otpRecord.otp_code !== otpCode) {
      // Increment failed attempts
      const newAttempts = (otpRecord.attempts || 0) + 1
      console.log(`❌ [OTP-VERIFY] Invalid OTP attempt ${newAttempts}/5 for phone:`, phoneNumber.substring(0, 7) + '****')

      // Lock account after 5 failed attempts
      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        await supabase
          .from('otp_verifications')
          .update({
            attempts: newAttempts,
            locked_until: lockUntil
          })
          .eq('id', otpRecord.id)

        console.log('🔒 [OTP-VERIFY] Account locked after 5 failed attempts:', phoneNumber.substring(0, 7) + '****')
        return NextResponse.json(
          { error: 'Too many failed attempts. Your account has been locked for 1 hour.' },
          { status: 429 }
        )
      } else {
        // Update attempt count
        await supabase
          .from('otp_verifications')
          .update({ attempts: newAttempts })
          .eq('id', otpRecord.id)

        return NextResponse.json(
          { error: `Invalid OTP code. ${5 - newAttempts} attempts remaining.` },
          { status: 401 }
        )
      }
    }

    // OTP is valid! Mark as used
    const { error: updateError } = await supabase
      .from('otp_verifications')
      .update({ used: true })
      .eq('id', otpRecord.id)

    if (updateError) {
      console.error('❌ [OTP-VERIFY] Failed to mark OTP as used:', updateError)
      return NextResponse.json(
        { error: 'Failed to process verification. Please try again.' },
        { status: 500 }
      )
    }

    console.log('✅ [OTP-VERIFY] OTP code verified successfully for:', phoneNumber.substring(0, 7) + '****')

    // Check if user exists in users table
    const { data: existingUser, error: userFetchError } = await supabase
      .from('users')
      .select('id, email, phone_number')
      .eq('phone_number', phoneNumber)
      .single()

    let userId: string

    if (existingUser) {
      // Existing user - sign them in
      console.log('✅ [OTP-VERIFY] Existing user found:', existingUser.id)
      userId = existingUser.id

      // Check if they have a Supabase Auth account
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers?.users?.find(u => u.phone === phoneNumber)

      if (authUser) {
        // Sign in existing auth user
        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
          phone: phoneNumber,
          password: 'not-used' // Phone-based auth doesn't use password
        })

        if (signInError) {
          console.error('❌ [OTP-VERIFY] Failed to sign in existing user:', signInError)
        }
      }
    } else {
      // New user - they'll need to complete profile after redirect
      console.log('🆕 [OTP-VERIFY] New user, will need to create profile')

      // For now, we'll create a temporary auth user
      // The actual profile will be created via RoleSelectionModal
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        phone: phoneNumber,
        password: Math.random().toString(36).slice(-16), // Random password (not used)
        options: {
          data: {
            phone_verified: true,
            auth_method: 'whatsapp_otp'
          }
        }
      })

      if (signUpError || !signUpData.user) {
        console.error('❌ [OTP-VERIFY] Failed to create Supabase Auth user:', signUpError)
        return NextResponse.json(
          { error: 'Failed to create user session. Please try again.' },
          { status: 500 }
        )
      }

      userId = signUpData.user.id
      console.log('✅ [OTP-VERIFY] Created new Supabase Auth user:', userId)
    }

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      console.error('❌ [OTP-VERIFY] Failed to retrieve session:', sessionError)
      return NextResponse.json(
        { error: 'Authentication successful but session creation failed. Please try logging in again.' },
        { status: 500 }
      )
    }

    console.log('✅ [OTP-VERIFY] Session created successfully for user:', userId)

    // Return success with session data
    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      session: session,
      user: {
        id: userId,
        phoneNumber: phoneNumber,
        hasProfile: !!existingUser
      }
    })

  } catch (error: any) {
    console.error('❌ [OTP-VERIFY] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
