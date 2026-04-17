import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { phoneToInternalEmail } from '@/lib/ambassador/auth'

/**
 * POST /api/ambassador/auth/verify-otp
 *
 * Verifies a WhatsApp OTP code and establishes a Supabase session.
 *
 * Session establishment flow:
 *   1. Validate OTP from otp_verifications table
 *   2. Compute deterministic internal email from phone
 *   3. Find or create auth.users row
 *   4. Generate magic link → return hashed_token
 *   5. Client calls supabase.auth.verifyOtp({ token_hash, type: 'email' })
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, otpCode } = body

    console.log('[Ambassador OTP-Verify] Attempt for:', phoneNumber?.substring(0, 7) + '****')

    // Validate inputs
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }
    if (!otpCode || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode)) {
      return NextResponse.json({ error: 'Invalid code. Must be 6 digits.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Fetch OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !otpRecord) {
      return NextResponse.json({ error: 'No code found. Please request a new one.' }, { status: 404 })
    }

    // Check brute-force lock
    if (otpRecord.locked_until) {
      const lockExpiry = new Date(otpRecord.locked_until)
      if (lockExpiry > new Date()) {
        const mins = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Too many failed attempts. Try again in ${mins} minutes.` },
          { status: 429 }
        )
      }
      // Lock expired — reset
      await supabase
        .from('otp_verifications')
        .update({ attempts: 0, locked_until: null })
        .eq('id', otpRecord.id)
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 410 })
    }

    // Check already used
    if (otpRecord.used) {
      return NextResponse.json({ error: 'Code already used. Please request a new one.' }, { status: 410 })
    }

    // Verify code
    if (otpRecord.otp_code !== otpCode) {
      const newAttempts = (otpRecord.attempts || 0) + 1

      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        await supabase
          .from('otp_verifications')
          .update({ attempts: newAttempts, locked_until: lockUntil })
          .eq('id', otpRecord.id)

        return NextResponse.json(
          { error: 'Too many failed attempts. Locked for 1 hour.' },
          { status: 429 }
        )
      }

      await supabase
        .from('otp_verifications')
        .update({ attempts: newAttempts })
        .eq('id', otpRecord.id)

      return NextResponse.json(
        { error: `Wrong code. ${5 - newAttempts} attempts remaining.`, attemptsRemaining: 5 - newAttempts },
        { status: 401 }
      )
    }

    // OTP valid — mark as used
    await supabase
      .from('otp_verifications')
      .update({ used: true })
      .eq('id', otpRecord.id)

    console.log('[Ambassador OTP-Verify] Code verified for:', phoneNumber.substring(0, 7) + '****')

    // Compute deterministic internal email for this phone
    const internalEmail = phoneToInternalEmail(phoneNumber)

    // Try to generate a magic link (works if user already exists)
    let hashedToken: string | null = null
    let userId: string | null = null

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: internalEmail,
    })

    if (linkData && !linkError) {
      // Existing user
      hashedToken = linkData.properties.hashed_token
      userId = linkData.user.id
      console.log('[Ambassador OTP-Verify] Existing auth user found:', userId)
    } else {
      // New user — create with deterministic internal email
      console.log('[Ambassador OTP-Verify] Creating new auth user')
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: internalEmail,
        email_confirm: true,
        user_metadata: {
          phone_number: phoneNumber,
          auth_method: 'whatsapp_otp',
          phone_verified: true,
        },
      })

      if (createError || !newUser.user) {
        console.error('[Ambassador OTP-Verify] Failed to create auth user:', createError)
        return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
      }

      userId = newUser.user.id

      // Generate session token for new user
      const { data: newLinkData, error: newLinkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: internalEmail,
      })

      if (newLinkError || !newLinkData) {
        console.error('[Ambassador OTP-Verify] Link generation failed:', newLinkError)
        return NextResponse.json({ error: 'Failed to create session. Please try again.' }, { status: 500 })
      }

      hashedToken = newLinkData.properties.hashed_token
    }

    // Check if model_profiles exists for this user
    const { data: profile } = await supabase
      .from('model_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const hasProfile = !!profile

    console.log('[Ambassador OTP-Verify] Session created. hasProfile:', hasProfile)

    return NextResponse.json({
      success: true,
      hashed_token: hashedToken,
      hasProfile,
    })
  } catch (error) {
    console.error('[Ambassador OTP-Verify] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
