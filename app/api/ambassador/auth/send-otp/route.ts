import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyTurnstile } from '@/lib/ambassador/turnstile'
import { authPhoneLimiter, authIpLimiter } from '@/lib/ambassador/rate-limit'

// Thin wrapper that keeps Turnstile + rate-limit chokepoints on our edge
// before handing the OTP flow to Supabase native phone auth. Supabase
// generates and stores the OTP, then POSTs to our Send SMS Hook
// (/api/model/auth/sms-hook) which forwards delivery via AUTHKey.

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, turnstileToken } = await request.json()

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    const isHuman = await verifyTurnstile(turnstileToken || '')
    if (!isHuman) {
      console.warn('[Ambassador OTP] Turnstile failed — allowing request (non-blocking mode)')
    }

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
      options: { channel: 'whatsapp' },
    })

    if (error) {
      console.error('[Ambassador OTP] signInWithOtp failed:', error.message)
      return NextResponse.json(
        { error: 'Failed to send code. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Ambassador OTP] Unexpected error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
