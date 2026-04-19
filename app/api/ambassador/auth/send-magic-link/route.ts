import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { verifyTurnstile } from '@/lib/ambassador/turnstile'
import { authEmailLimiter, authIpLimiter } from '@/lib/ambassador/rate-limit'
import { maskEmail } from '@/lib/ambassador/log-utils'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * POST /api/ambassador/auth/send-magic-link
 *
 * Sends a branded magic link email for ambassador authentication.
 * Uses admin.generateLink() to create the token (which auto-creates the
 * auth user if it doesn't exist) then sends via Resend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, turnstileToken } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    const normalizedEmail = email.toLowerCase().trim()

    console.log('[Ambassador Magic Link] Send request for:', maskEmail(normalizedEmail))

    // Turnstile bot protection
    const isHuman = await verifyTurnstile(turnstileToken || '')
    if (!isHuman) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 })
    }

    // Rate limit: per-email (3/hr) and per-IP (10/hr)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [emailLimit, ipLimit] = await Promise.all([
      authEmailLimiter.limit(normalizedEmail),
      authIpLimiter.limit(ip),
    ])
    if (!emailLimit.success || !ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const supabase = createServiceRoleClient()

    // generateLink auto-creates the auth user if it doesn't exist (magiclink type).
    // We pass the token_hash directly to our callback rather than relying on the
    // built-in action_link, which uses a hash fragment unreadable server-side.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    })

    if (linkError || !linkData) {
      console.error('[Ambassador Magic Link] Link generation failed:', linkError)
      return NextResponse.json({ error: 'Failed to send magic link. Please try again.' }, { status: 500 })
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.welovedecode.com'
    const hashedToken = linkData.properties.hashed_token
    const callbackUrl = `${origin}/model/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`

    const { error: sendError } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: normalizedEmail,
      subject: 'Your Secure Login Link',
      html: `<p><a href="${callbackUrl}">Login to WeLoveDecode</a></p>`,
      text: `Login to WeLoveDecode: ${callbackUrl}`,
    })

    if (sendError) {
      console.error('[Ambassador Magic Link] Resend failed:', sendError)
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
    }

    console.log('[Ambassador Magic Link] Sent to:', maskEmail(normalizedEmail))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Ambassador Magic Link] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
