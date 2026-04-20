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

    // Shadow row in public.users — model_profiles.user_id and ~15 other
    // domain tables FK to public.users(id). No DB trigger populates it
    // from auth.users (app code owns it; see /api/auth/create-profile).
    // Upsert with ignoreDuplicates so returning users are untouched.
    // signup_method must be 'email' (CHECK constraint).
    try {
      const { error: shadowError } = await supabase
        .from('users')
        .upsert(
          {
            id: linkData.user.id,
            email: normalizedEmail,
            user_name: `model_${linkData.user.id.slice(0, 8)}`,
            role: 'Model',
            signup_method: 'email',
            email_verified: true,
            approval_status: 'approved',
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
      if (shadowError) {
        console.error('[Ambassador Magic Link] public.users shadow upsert failed:', shadowError)
      } else {
        console.log('[Ambassador Magic Link] public.users shadow row ensured for:', linkData.user.id)
      }
    } catch (shadowErr) {
      console.error('[Ambassador Magic Link] public.users shadow upsert threw:', shadowErr)
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.welovedecode.com'
    const hashedToken = linkData.properties.hashed_token
    const callbackUrl = `${origin}/model/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <h1 style="font-size:20px;font-weight:700;margin:0 0 24px;color:#111;">WeLoveDecode</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="#e91e8c" style="border-radius:8px;">
                <a href="${callbackUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;background:#e91e8c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Login to WeLoveDecode</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

    const { error: sendError } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: normalizedEmail,
      subject: 'Your Secure Login Link',
      html,
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
