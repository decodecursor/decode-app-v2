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

    console.log('[Ambassador OTP] Send request for:', phoneNumber?.substring(0, 7) + '****')

    // Validate phone
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    // Turnstile bot protection
    const isHuman = await verifyTurnstile(turnstileToken || '')
    if (!isHuman) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 })
    }

    // Rate limit: per-phone (3/hr) and per-IP (10/hr)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [phoneLimit, ipLimit] = await Promise.all([
      authPhoneLimiter.limit(phoneNumber),
      authIpLimiter.limit(ip),
    ])
    if (!phoneLimit.success || !ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Check WhatsApp service
    if (!authkeyWhatsAppService.isConfigured()) {
      console.error('[Ambassador OTP] AUTHKey not configured')
      return NextResponse.json(
        { error: 'WhatsApp service unavailable. Please use email.' },
        { status: 500 }
      )
    }

    const supabase = createServiceRoleClient()

    // Check brute-force lock
    const { data: existingOTP } = await supabase
      .from('otp_verifications')
      .select('locked_until')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

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

    // Delete any existing OTP for this phone (one active at a time)
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')

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

    if (insertError) {
      console.error('[Ambassador OTP] DB insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to generate code. Please try again.' }, { status: 500 })
    }

    // Send via WhatsApp
    const result = await authkeyWhatsAppService.sendOTP(phoneNumber, otpCode)

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

    console.log('[Ambassador OTP] Sent successfully to:', phoneNumber.substring(0, 7) + '****')

    return NextResponse.json({
      success: true,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('[Ambassador OTP] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
