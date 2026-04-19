import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
  const type = (searchParams.get('type') || 'magiclink') as 'magiclink' | 'email'
  const origin = request.nextUrl.origin

  console.log('[Ambassador Callback] Request received. token_hash present:', !!tokenHash, 'type:', type)

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
      console.error('[Ambassador Callback] verifyOtp failed:', error?.message || 'no user returned')
      return NextResponse.redirect(`${origin}/model/auth/email-error`)
    }

    console.log('[Ambassador Callback] Session established for user:', data.user.id)

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
