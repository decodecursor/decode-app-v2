import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { maskEmail } from '@/lib/ambassador/log-utils'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * POST /api/ambassador/auth/add-email
 *
 * Sends a branded email-change confirmation link for an already-signed-in
 * ambassador (typically WhatsApp-primary users adding their first email).
 * Uses admin.generateLink({ type: 'email_change_new' }) to mint the token,
 * then delivers via Resend — matching the send-magic-link pattern so all
 * outbound email flows through one sender/template pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionSupabase = await createClient()
    const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser()

    if (!sessionUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    if (!sessionUser.email) {
      return NextResponse.json({ error: 'Account has no current email' }, { status: 400 })
    }

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    const normalizedEmail = email.toLowerCase().trim()

    console.log('[Ambassador Add Email] Request for user:', sessionUser.id, '→', maskEmail(normalizedEmail))

    const admin = createServiceRoleClient()

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'email_change_new',
      email: sessionUser.email,
      newEmail: normalizedEmail,
    })

    if (linkError || !linkData) {
      const msg = (linkError?.message || '').toLowerCase()
      if (/already|exists|registered|taken/.test(msg)) {
        return NextResponse.json({ error: 'This email is already in use.' }, { status: 409 })
      }
      console.error('[Ambassador Add Email] Link generation failed:', linkError)
      return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.welovedecode.com'
    const hashedToken = linkData.properties.hashed_token
    const callbackUrl = `${origin}/model/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=email_change`

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
    <div style="max-width:480px;margin:0 auto;background:#1c1c1c;border:1px solid #262626;border-radius:16px;padding:32px 24px;">
      <div style="font-size:18px;font-weight:700;margin-bottom:12px;">Add this email to your WeLoveDecode account</div>
      <div style="font-size:14px;color:#aaa;line-height:1.6;margin-bottom:24px;">Click the button below to confirm this email address. The link expires in 10 minutes.</div>
      <a href="${callbackUrl}" style="display:inline-block;background:#e91e8c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;">Confirm your email</a>
      <div style="font-size:11px;color:#666;margin-top:24px;line-height:1.6;">If you didn't request this, you can safely ignore this email.</div>
    </div>
  </body>
</html>`

    const { error: sendError } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: normalizedEmail,
      subject: 'Add this email to your WeLoveDecode account',
      html,
      text: `Confirm your email for WeLoveDecode: ${callbackUrl}`,
    })

    if (sendError) {
      console.error('[Ambassador Add Email] Resend failed:', sendError)
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
    }

    console.log('[Ambassador Add Email] Sent to:', maskEmail(normalizedEmail))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Ambassador Add Email] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
