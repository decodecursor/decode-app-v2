import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * GET /model/auth/confirm-email?token=...
 *
 * Consumes an opaque token from public.email_change_requests and applies
 * the pending email change via admin.updateUserById with email_confirm:true
 * (GoTrue admin bypass — marks email confirmed without sending its own
 * confirmation email). Session-independent: works when request and click
 * come from different browsers / devices.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')

  console.log('[Ambassador Confirm Email] Request received. token prefix:', token?.slice(0, 8) ?? 'null')

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(`${origin}/model/auth/email-error?reason=invalid`)
  }

  const admin = createServiceRoleClient()

  // Atomic consume: only returns a row when the token is unused AND unexpired.
  const { data: consumed, error: consumeError } = await admin
    .from('email_change_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token', token)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id, new_email, flow')
    .maybeSingle()

  if (consumeError) {
    console.error('[Ambassador Confirm Email] Consume query failed:', JSON.stringify(consumeError))
    return NextResponse.redirect(`${origin}/model/auth/email-error?reason=server`)
  }

  if (!consumed) {
    // Disambiguate for UX: was the token unknown, expired, or already used?
    const { data: existing } = await admin
      .from('email_change_requests')
      .select('consumed_at, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (!existing) {
      return NextResponse.redirect(`${origin}/model/auth/email-error?reason=invalid`)
    }
    if (existing.consumed_at) {
      return NextResponse.redirect(`${origin}/model/auth/email-error?reason=used`)
    }
    return NextResponse.redirect(`${origin}/model/auth/email-error?reason=expired`)
  }

  const { user_id: userId, new_email: newEmail, flow } = consumed

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  })

  if (updateError) {
    console.error('[Ambassador Confirm Email] updateUserById failed:', {
      userId,
      errorMessage: updateError.message,
      fullError: JSON.stringify(updateError),
    })
    const msg = (updateError.message || '').toLowerCase()
    const reason = /already|exists|registered|taken|duplicate/.test(msg) ? 'conflict' : 'server'
    return NextResponse.redirect(`${origin}/model/auth/email-error?reason=${reason}`)
  }

  const { error: shadowError } = await admin
    .from('users')
    .update({ email: newEmail })
    .eq('id', userId)

  if (shadowError) {
    console.error('[Ambassador Confirm Email] public.users shadow update failed:', shadowError)
    // Non-fatal: auth.users is the source of truth. Settings will refetch.
  }

  console.log('[Ambassador Confirm Email] Email updated for user:', userId, 'flow:', flow)

  if (flow === 'change') {
    return NextResponse.redirect(`${origin}/model/auth/email-changed?ref=${token}`)
  }

  const sessionSupabase = await createClient()
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser()

  if (sessionUser?.id === userId) {
    return NextResponse.redirect(`${origin}/model/settings`)
  }
  return NextResponse.redirect(`${origin}/model/auth?toast=email_added`)
}
