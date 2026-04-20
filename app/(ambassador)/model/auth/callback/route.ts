import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * GET /model/auth/callback
 *
 * Handles the redirect when a user clicks a magic link email.
 * Verifies the token_hash to establish a session, then redirects to
 * /model/setup (new user) or /model (existing user).
 *
 * The email contains a direct link with ?token_hash=...&type=magiclink
 * (not Supabase's action_link, which uses hash fragments that server
 * routes can't read).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') || 'magiclink') as 'magiclink' | 'email' | 'email_change'
  const origin = request.nextUrl.origin
  const userAgent = request.headers.get('user-agent') || 'unknown'

  console.log('[Ambassador Callback] Request received:', {
    type,
    tokenHashLength: tokenHash?.length ?? 0,
    tokenHashPrefix: tokenHash?.slice(0, 8) ?? 'null',
    userAgent,
  })

  if (!tokenHash) {
    console.error('[Ambassador Callback] Missing token_hash — redirecting to error')
    return NextResponse.redirect(`${origin}/model/auth/email-error`)
  }

  try {
    const supabase = await createClient()

    console.log('[Ambassador Callback] Calling verifyOtp (server-side, cookies will be set on response)')
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (error || !data.user) {
      console.error('[Ambassador Callback] verifyOtp failed:', {
        type,
        tokenHashPrefix: tokenHash.slice(0, 8),
        errorMessage: error?.message,
        errorName: error?.name,
        errorStatus: (error as { status?: number } | null)?.status,
        errorCode: (error as { code?: string } | null)?.code,
        fullError: JSON.stringify(error),
        userAgent,
      })
      return NextResponse.redirect(`${origin}/model/auth/email-error`)
    }

    const isWhatsAppUser = data.user.email?.endsWith('@auth.internal') ?? false

    console.log(
      `[Ambassador Callback] user: ${data.user.id}, email: ${data.user.email ?? 'null'}, phone: ${data.user.phone ?? 'null'}, isWhatsAppUser: ${isWhatsAppUser}`,
    )

    // Email-change flow (Add Email from Settings): auth.users.email is now
    // the confirmed new address. Mirror onto public.users so Settings and
    // the dashboard hint reflect it immediately, then return to Settings.
    if (type === 'email_change') {
      try {
        const adminClient = createServiceRoleClient()
        const { error: updErr } = await adminClient
          .from('users')
          .update({ email: data.user.email ?? null })
          .eq('id', data.user.id)
        if (updErr) {
          console.error('[Ambassador Callback] email_change shadow update failed:', updErr)
        }
      } catch (updErr) {
        console.error('[Ambassador Callback] email_change shadow update threw:', updErr)
      }
      return NextResponse.redirect(`${origin}/model/settings`)
    }

    // Defense-in-depth shadow row ensure. verify-otp + send-magic-link
    // each create the row at signup time, but any orphan from an earlier
    // bug, deploy race, or future auth path is self-healed here on first
    // login. Idempotent via ignoreDuplicates — no-op when row exists.
    // Phone from Supabase auth is digit-only; re-add '+' for E.164.
    // Service-role client bypasses RLS — matches verify-otp's pattern
    // and avoids any session-state edge cases within this request.
    try {
      const adminClient = createServiceRoleClient()
      const { error: shadowError } = await adminClient
        .from('users')
        .upsert(
          {
            id: data.user.id,
            email: data.user.email ?? null,
            phone_number: data.user.phone ? `+${data.user.phone}` : null,
            user_name: `model_${data.user.id.slice(0, 8)}`,
            role: 'Model',
            signup_method: isWhatsAppUser ? 'whatsapp' : 'email',
            email_verified: !isWhatsAppUser,
            approval_status: 'approved',
          },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      if (shadowError) {
        console.error('[Ambassador Callback] public.users shadow upsert failed:', shadowError)
      } else {
        console.log('[Ambassador Callback] public.users shadow row ensured for:', data.user.id)
      }
    } catch (shadowErr) {
      console.error('[Ambassador Callback] public.users shadow upsert threw:', shadowErr)
    }

    const { data: profile } = await supabase
      .from('model_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    const hasProfile = !!profile
    const destination = hasProfile ? '/model' : '/model/setup'
    console.log('[Ambassador Callback] hasProfile:', hasProfile, '→ redirecting to', destination)

    return NextResponse.redirect(`${origin}${destination}`)
  } catch (err) {
    console.error('[Ambassador Callback] Unexpected error:', err)
    return NextResponse.redirect(`${origin}/model/auth/email-error`)
  }
}
