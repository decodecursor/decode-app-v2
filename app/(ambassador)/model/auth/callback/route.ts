import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * GET /model/auth/callback
 *
 * Handles the redirect when a user clicks a magic link email.
 * Exchanges the auth code for a session, then redirects to
 * /model/setup (new user) or /model (existing user).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/model/auth/email-error`)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
      console.error('[Ambassador Callback] Session exchange failed:', error)
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
