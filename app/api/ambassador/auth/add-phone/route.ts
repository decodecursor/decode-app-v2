import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * POST /api/ambassador/auth/add-phone
 *
 * Verifies a WhatsApp OTP and attaches the phone to the currently
 * authenticated user. Differs from /verify-otp in that this is an "add"
 * flow for a user already signed in (via email magic link, typically):
 * no new user is created, and signup_method stays frozen at its original
 * value.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionSupabase = await createClient()
    const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const body = await request.json()
    const { phoneNumber, otpCode } = body

    console.log('[Ambassador Add-Phone] Step 0: Attempt for', sessionUser.id, 'phone:', phoneNumber?.substring(0, 7) + '****')

    if (!phoneNumber || typeof phoneNumber !== 'string' || !/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    if (!otpCode || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode)) {
      return NextResponse.json({ error: 'Invalid code. Must be 6 digits.' }, { status: 400 })
    }

    const admin = createServiceRoleClient()

    const { data: otpRecord } = await admin
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

    if (otpRecord.locked_until) {
      const lockExpiry = new Date(otpRecord.locked_until)
      if (lockExpiry > new Date()) {
        const mins = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Too many failed attempts. Try again in ${mins} minutes.` },
          { status: 429 }
        )
      }
      await admin
        .from('otp_verifications')
        .update({ attempts: 0, locked_until: null })
        .eq('id', otpRecord.id)
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 410 })
    }

    if (otpRecord.used) {
      return NextResponse.json({ error: 'Code already used. Please request a new one.' }, { status: 410 })
    }

    if (otpRecord.otp_code !== otpCode) {
      const newAttempts = (otpRecord.attempts || 0) + 1
      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        await admin
          .from('otp_verifications')
          .update({ attempts: newAttempts, locked_until: lockUntil })
          .eq('id', otpRecord.id)
        return NextResponse.json(
          { error: 'Too many failed attempts. Locked for 1 hour.' },
          { status: 429 }
        )
      }
      await admin
        .from('otp_verifications')
        .update({ attempts: newAttempts })
        .eq('id', otpRecord.id)
      return NextResponse.json(
        { error: `Wrong code. ${5 - newAttempts} attempts remaining.`, attemptsRemaining: 5 - newAttempts },
        { status: 401 }
      )
    }

    await admin
      .from('otp_verifications')
      .update({ used: true })
      .eq('id', otpRecord.id)

    console.log('[Ambassador Add-Phone] Step 1: OTP verified, attaching phone to', sessionUser.id)

    const { error: updateError } = await admin.auth.admin.updateUserById(sessionUser.id, {
      phone: phoneNumber,
      phone_confirm: true,
    })

    if (updateError) {
      const msg = updateError.message || ''
      const isConflict =
        /already been registered|already registered|already exists|phone.*taken/i.test(msg)
      if (isConflict) {
        console.warn('[Ambassador Add-Phone] Conflict — phone already on another account:', msg)
        return NextResponse.json(
          { error: 'This number is already in use.' },
          { status: 409 }
        )
      }
      console.error('[Ambassador Add-Phone] updateUserById failed:', updateError)
      return NextResponse.json(
        { error: 'Failed to add phone. Please try again.' },
        { status: 500 }
      )
    }

    const { error: shadowError } = await admin
      .from('users')
      .update({ phone_number: phoneNumber })
      .eq('id', sessionUser.id)

    if (shadowError) {
      console.error('[Ambassador Add-Phone] public.users phone update failed:', shadowError)
    }

    console.log('[Ambassador Add-Phone] Step 2: DONE for', sessionUser.id)

    return NextResponse.json({ success: true, phone: phoneNumber })
  } catch (error) {
    console.error('[Ambassador Add-Phone] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
