import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { phoneToInternalEmail } from '@/lib/ambassador/auth'

/**
 * POST /api/ambassador/auth/verify-otp
 *
 * Verifies a WhatsApp OTP code and establishes a Supabase session.
 *
 * Session establishment flow (Slice 1.5 Path B — admin-API hybrid):
 *   1. Validate OTP from otp_verifications table
 *   2. Compute deterministic internal email from phone (session fixture)
 *   3. createUser FIRST — populates auth.users.phone natively via
 *      phone_confirm. On 422 "already registered" error, the row exists.
 *   4. generateLink SECOND — session mint only. Safe at this point because
 *      the row provably exists; no auto-create can occur. Never use
 *      generateLink as a dedupe probe — it auto-creates email-only rows
 *      when no match is found, which would skip phone population entirely.
 *   5. Client navigates to /model/auth/callback?token_hash=...&type=magiclink,
 *      which runs verifyOtp server-side so session cookies are written to the
 *      response with the SSR adapter's flags (sameSite:'lax', secure, path:'/').
 *      Client-side verifyOtp via the browser client does not persist cookies
 *      reliably for SSR consumers — do not revert to it.
 *
 * The synthetic wa_*@auth.internal email is a session-mint fixture only —
 * it is never surfaced in UI (see isInternalEmail filter on settings page).
 * Identity is the phone; email is infrastructure.
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

    // Fetch OTP record (maybeSingle — missing is the not-yet-sent state)
    const { data: otpRecord } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRecord) {
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

    // createUser FIRST — populates auth.users.phone natively. If the row
    // already exists, Supabase returns a 422 "already registered" error,
    // which is the existing-user signal. Never probe with generateLink:
    // it auto-creates email-only rows when no match is found.
    let hashedToken: string | null = null
    let userId: string | null = null

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      phone: phoneNumber,
      phone_confirm: true,
      email: internalEmail,
      email_confirm: true,
      user_metadata: {
        phone_number: phoneNumber,
        auth_method: 'whatsapp_otp',
        phone_verified: true,
      },
    })

    const isAlreadyRegistered =
      !!createError &&
      (createError.status === 422 ||
        /already been registered|already registered|already exists/i.test(createError.message))

    if (createError && !isAlreadyRegistered) {
      console.error('[Ambassador OTP-Verify] createUser failed:', createError)
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      )
    }

    if (!createError && newUser?.user) {
      userId = newUser.user.id
      console.log('[Ambassador OTP-Verify] Created new auth user with phone populated:', userId)

      // Shadow row in public.users — required because model_profiles.user_id
      // FKs to public.users(id), which has no auto-populate trigger from
      // auth.users in this schema (app code owns it; see create-profile route).
      // signup_method must be 'whatsapp' (CHECK constraint, not 'whatsapp_otp').
      // Wrapped in try/catch: a missing shadow row will surface at /model/setup,
      // but a successful OTP verify shouldn't 500 here.
      try {
        const { error: shadowError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: internalEmail,
            phone_number: phoneNumber,
            user_name: `model_${userId.slice(0, 8)}`,
            role: 'Model',
            signup_method: 'whatsapp',
            email_verified: false,
            approval_status: 'approved',
          })
        if (shadowError) {
          console.error('[Ambassador OTP-Verify] public.users shadow insert failed:', shadowError)
        } else {
          console.log('[Ambassador OTP-Verify] public.users shadow row created for:', userId)
        }
      } catch (shadowErr) {
        console.error('[Ambassador OTP-Verify] public.users shadow insert threw:', shadowErr)
      }
    } else {
      console.log('[Ambassador OTP-Verify] Existing auth user (createUser 422) — skipping shadow insert')
    }

    // Mint the magic link (session fixture). Safe now: row provably exists.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: internalEmail,
    })

    if (linkError || !linkData) {
      console.error('[Ambassador OTP-Verify] generateLink failed:', linkError)
      return NextResponse.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      )
    }

    hashedToken = linkData.properties.hashed_token
    userId = userId ?? linkData.user.id

    const { data: profile } = await supabase
      .from('model_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const hasProfile = !!profile

    console.log('[Ambassador OTP-Verify] Token minted for user:', userId, 'hasProfile:', hasProfile, '— client will hand off to /model/auth/callback')

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
