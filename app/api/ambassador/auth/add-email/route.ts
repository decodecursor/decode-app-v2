import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { maskEmail } from '@/lib/ambassador/log-utils'
import { renderButtonEmail } from '@/lib/ambassador/email-templates'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TOKEN_TTL_MINUTES = 15

/**
 * POST /api/ambassador/auth/add-email
 *
 * Issues an opaque random token stored in public.email_change_requests,
 * emails a link to the new address. Consumption happens at
 * GET /model/auth/confirm-email. Replaces the previous
 * admin.generateLink('email_change_new') flow, whose GoTrue token was
 * PKCE-bound to the requesting client and broke when the user clicked
 * from a different browser (phone → laptop).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionSupabase = await createClient()
    const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser()

    if (!sessionUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
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

    // Conflict pre-check against public.users (the email-mirrored shadow).
    // Not bulletproof vs. shadow drift; residual conflicts are caught at
    // confirm time by updateUserById and routed to ?reason=conflict.
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing && existing.id !== sessionUser.id) {
      return NextResponse.json({ error: 'This email is already in use.' }, { status: 409 })
    }

    // Invalidate prior unused requests for this user so stale links stop
    // working as soon as a new one is issued.
    await admin
      .from('email_change_requests')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', sessionUser.id)
      .is('consumed_at', null)

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

    const { error: insertError } = await admin
      .from('email_change_requests')
      .insert({
        token,
        user_id: sessionUser.id,
        new_email: normalizedEmail,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('[Ambassador Add Email] Token insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.welovedecode.com'
    const callbackUrl = `${origin}/model/auth/confirm-email?token=${token}`

    const html = renderButtonEmail({ heading: 'WeLoveDecode', buttonLabel: 'Confirm your email', callbackUrl })

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

    console.log('[Ambassador Add Email] Sent to:', maskEmail(normalizedEmail), 'token prefix:', token.slice(0, 8))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Ambassador Add Email] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
