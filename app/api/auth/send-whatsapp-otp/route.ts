import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { whatsappService, WhatsAppService } from '@/lib/whatsapp-service'

/**
 * POST /api/auth/send-whatsapp-otp
 *
 * Sends a WhatsApp OTP code for authentication
 * Implements rate limiting and stores OTP in database
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { phoneNumber } = body

    console.log('📱 [OTP] Request to send OTP for phone:', phoneNumber?.substring(0, 7) + '****')

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +971501234567)' },
        { status: 400 }
      )
    }

    // Check WhatsApp service configuration
    if (!whatsappService.isConfigured()) {
      console.error('❌ [OTP] WhatsApp service not configured')
      return NextResponse.json(
        { error: 'WhatsApp integration with Meta is in progress.\nFor now, please use email below.' },
        { status: 500 }
      )
    }

    // Initialize Supabase admin client (service role bypasses RLS)
    const supabase = createServiceRoleClient()

    // Check rate limiting: max 3 OTP sends per 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { data: recentOTPs, error: rateLimitError } = await supabase
      .from('otp_verifications')
      .select('id, created_at')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false })

    if (rateLimitError) {
      console.error('❌ [OTP] Database error checking rate limit:', rateLimitError)
      return NextResponse.json(
        { error: 'Failed to process request. Please try again.' },
        { status: 500 }
      )
    }

    // Enforce rate limit
    if (recentOTPs && recentOTPs.length >= 3) {
      console.log('⚠️ [OTP] Rate limit exceeded for phone:', phoneNumber.substring(0, 7) + '****')
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait 15 minutes before trying again.' },
        { status: 429 }
      )
    }

    // Check if user is locked due to too many failed attempts
    const { data: existingOTP } = await supabase
      .from('otp_verifications')
      .select('locked_until, attempts')
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingOTP?.locked_until) {
      const lockExpiry = new Date(existingOTP.locked_until)
      if (lockExpiry > new Date()) {
        const minutesRemaining = Math.ceil((lockExpiry.getTime() - Date.now()) / 1000 / 60)
        console.log('🔒 [OTP] Account locked for phone:', phoneNumber.substring(0, 7) + '****')
        return NextResponse.json(
          { error: `Account temporarily locked. Please try again in ${minutesRemaining} minutes.` },
          { status: 429 }
        )
      }
    }

    // Generate 6-digit OTP code
    const otpCode = WhatsAppService.generateOTP()

    // Calculate expiration (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // Delete any existing OTP for this phone number (ensure only one active OTP)
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('user_identifier', phoneNumber)
      .eq('type', 'whatsapp')

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert({
        user_identifier: phoneNumber,
        otp_code: otpCode,
        type: 'whatsapp',
        expires_at: expiresAt,
        attempts: 0,
        used: false,
        locked_until: null
      })

    if (insertError) {
      console.error('❌ [OTP] Failed to store OTP in database:', insertError)
      return NextResponse.json(
        { error: 'Failed to generate OTP. Please try again.' },
        { status: 500 }
      )
    }

    console.log('✅ [OTP] OTP stored in database, expires at:', expiresAt)

    // Send OTP via WhatsApp
    const result = await whatsappService.sendOTP(phoneNumber, otpCode)

    if (!result.success) {
      console.error('❌ [OTP] Failed to send WhatsApp message:', result.error)

      // Delete the OTP from database since we couldn't send it
      await supabase
        .from('otp_verifications')
        .delete()
        .eq('user_identifier', phoneNumber)
        .eq('type', 'whatsapp')

      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp OTP. Please try again.' },
        { status: 500 }
      )
    }

    console.log('✅ [OTP] WhatsApp OTP sent successfully to:', phoneNumber.substring(0, 7) + '****')

    // Return success (don't include OTP code in response for security)
    return NextResponse.json({
      success: true,
      message: 'OTP sent to your WhatsApp number',
      expiresIn: 300 // 5 minutes in seconds
    })

  } catch (error: any) {
    console.error('❌ [OTP] Unexpected error:', error)
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
