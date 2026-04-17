import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { authkeyWhatsAppService } from '@/lib/services/AuthkeyWhatsAppService'
import { verifyTurnstile } from '@/lib/ambassador/turnstile'
import { authPhoneLimiter, authIpLimiter } from '@/lib/ambassador/rate-limit'

/**
 * POST /api/ambassador/auth/send-otp
 *
 * Sends a WhatsApp OTP for ambassador authentication.
 * Reuses the existing otp_verifications table and AUTHKey integration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, turnstileToken } = body

    console.log('[Ambassador OTP] Step 0: Request received for:', phoneNumber?.substring(0, 7) + '****')

    // Validate phone
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    // Turnstile bot protection (non-blocking: log but don't reject while widget is being validated)
    const isHuman = await verifyTurnstile(turnstileToken || '')
    if (!isHuman) {
      console.warn('[Ambassador OTP] Turnstile failed — allowing request (non-blocking mode)')
    }

    // Rate limit: per-phone and per-IP
    console.log('[Ambassador OTP] Step 1: Rate limit check')
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [phoneLimit, ipLimit] = await Promise.all([
      authPhoneLimiter.limit(phoneNumber),
      authIpLimiter.limit(ip),
    ])
    console.log('[Ambassador OTP] Step 1 result: phone=', phoneLimit.success, 'ip=', ipLimit.success)
    if (!phoneLimit.success || !ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Check WhatsApp service
    console.log('[Ambassador OTP] Step 2: AUTHKey configured=', authkeyWhatsAppService.isConfigured())
    if (!authkeyWhatsAppService.isConfigured()) {
      console.error('[Ambassador OTP] AUTHKey not configured')
      return NextResponse.json(
        { error: 'WhatsApp service unavailable. Please use email.' },
        { status: 500 }
      )
    }

    const supabase = createServiceRoleClient()

    // Check brute-force lock
    const { data: existingOTP, error: lockCheckError } = await supabase
      .from('otp_verifications')
      .select('locked_until')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    console.log('[Ambassador OTP] Step 3: Lock check — data=', JSON.stringify(existingOTP), 'error=', lockCheckError?.message || 'none')

    if (existingOTP?.locked_until) {
      const lockExpiry = new Date(existingOTP.locked_until)
      if (lockExpiry > new Date()) {
        const mins = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Account temporarily locked. Try again in ${mins} minutes.` },
          { status: 429 }
        )
      }
    }

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    console.log('[Ambassador OTP] Step 4: OTP generated:', otpCode.substring(0, 2) + '****')

    // Delete any existing OTP for this phone (one active at a time)
    const { error: deleteError } = await supabase
      .from('otp_verifications')
      .delete()
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')

    console.log('[Ambassador OTP] Step 5: Old OTP deleted, error=', deleteError?.message || 'none')

    // Store new OTP
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert({
        user_identifier: phoneNumber,
        otp_code: otpCode,
        type: 'whatsapp',
        expires_at: expiresAt,
        attempts: 0,
        used: false,
        locked_until: null,
      })

    console.log('[Ambassador OTP] Step 6: OTP stored, error=', insertError?.message || 'none')

    if (insertError) {
      console.error('[Ambassador OTP] DB insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to generate code. Please try again.' }, { status: 500 })
    }

    // Send via WhatsApp
    console.log('[Ambassador OTP] Step 7: Calling AUTHKey sendOTP for', phoneNumber)
    const result = await authkeyWhatsAppService.sendOTP(phoneNumber, otpCode)
    console.log('[Ambassador OTP] Step 8: AUTHKey response:', JSON.stringify(result))

    if (!result.success) {
      console.error('[Ambassador OTP] Send failed:', result.error)
      // Clean up stored OTP
      await supabase
        .from('otp_verifications')
        .delete()
        .eq('user_identifier', phoneNumber)
        .eq('type', 'whatsapp')

      return NextResponse.json(
        { error: result.error || 'Failed to send code. Please try again.' },
        { status: 500 }
      )
    }

    console.log('[Ambassador OTP] Step 9: DONE — sent to', phoneNumber.substring(0, 7) + '****')

    return NextResponse.json({
      success: true,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('[Ambassador OTP] CAUGHT ERROR:', error instanceof Error ? error.message : error)
    console.error('[Ambassador OTP] Stack:', error instanceof Error ? error.stack : 'no stack')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
