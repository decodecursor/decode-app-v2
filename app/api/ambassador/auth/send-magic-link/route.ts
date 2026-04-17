import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { verifyTurnstile } from '@/lib/ambassador/turnstile'
import { authEmailLimiter, authIpLimiter } from '@/lib/ambassador/rate-limit'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * POST /api/ambassador/auth/send-magic-link
 *
 * Sends a branded magic link email for ambassador authentication.
 * Uses admin.generateLink() to create the token, then sends via Resend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, turnstileToken } = body

    console.log('[Ambassador Magic Link] Send request for:', email)

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    const normalizedEmail = email.toLowerCase().trim()

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

    // Check if auth user exists; create if not
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })
    // listUsers doesn't support email filter — use getUserByEmail pattern instead
    let authUser = null
    try {
      // Try to generate link directly — works if user exists
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
      })

      if (!linkError && linkData) {
        authUser = linkData.user
      }
    } catch {
      // User doesn't exist — will create below
    }

    if (!authUser) {
      // Create new auth user (auto-confirmed for immediate magic link)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          auth_method: 'magic_link',
        },
      })

      if (createError) {
        // User might already exist — try generateLink again
        const { data: retryLink, error: retryError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
        })

        if (retryError) {
          console.error('[Ambassador Magic Link] Failed to create user or generate link:', retryError)
          return NextResponse.json({ error: 'Failed to send magic link. Please try again.' }, { status: 500 })
        }

        authUser = retryLink.user
      } else {
        // Generate link for the newly created user
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
        })

        if (linkError) {
          console.error('[Ambassador Magic Link] Link generation failed:', linkError)
          return NextResponse.json({ error: 'Failed to send magic link. Please try again.' }, { status: 500 })
        }

        authUser = linkData.user
      }
    }

    // Generate a fresh magic link with redirect to ambassador callback
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.welovedecode.com'
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${origin}/model/auth/callback`,
      },
    })

    if (linkError || !linkData) {
      console.error('[Ambassador Magic Link] Final link generation failed:', linkError)
      return NextResponse.json({ error: 'Failed to send magic link. Please try again.' }, { status: 500 })
    }

    // Build our own callback URL with hashed_token as query param.
    // admin.generateLink() returns an action_link that redirects via hash fragment (#access_token),
    // which server-side route handlers can't read. Instead, we pass the token_hash directly.
    const hashedToken = linkData.properties.hashed_token
    const callbackUrl = `${origin}/model/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`

    // Send branded email via Resend
    const { error: sendError } = await resend.emails.send({
      from: 'DECODE <noreply@welovedecode.com>',
      to: normalizedEmail,
      subject: 'Sign in to DECODE',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 24px; background: #000; color: #fff;">
          <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">Sign in to DECODE</h1>
          <p style="color: #888; font-size: 13px; line-height: 1.65; margin-bottom: 32px;">
            Click the button below to sign in to your ambassador account. This link expires in 10 minutes.
          </p>
          <a href="${callbackUrl}" style="display: inline-block; background: #e91e8c; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600;">
            Sign in
          </a>
          <p style="color: #555; font-size: 11px; margin-top: 32px; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    if (sendError) {
      console.error('[Ambassador Magic Link] Resend failed:', sendError)
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
    }

    console.log('[Ambassador Magic Link] Sent to:', normalizedEmail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Ambassador Magic Link] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
