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

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/model/auth/email-error`)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (error || !data.user) {
      console.error('[Ambassador Callback] Token verification failed:', error)
      return NextResponse.redirect(`${origin}/model/auth/email-error`)
    }

    // Check if user has a model profile
    const { data: profile } = await supabase
      .from('model_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (profile) {
      return NextResponse.redirect(`${origin}/model`)
    }
    return NextResponse.redirect(`${origin}/model/setup`)
  } catch (err) {
    console.error('[Ambassador Callback] Error:', err)
    return NextResponse.redirect(`${origin}/model/auth/email-error`)
  }
}
