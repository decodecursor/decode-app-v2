import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { toWishCardRow, WISH_LIVE_SELECT, type WishLiveRow } from '@/lib/ambassador/wish-shape'

/**
 * GET /api/ambassador/model/wishes
 *
 * Returns the caller's wishes from model_wishes_live joined with the
 * (at-most-one) completed payment row, projected into the card shape
 * the Wishlist page expects (see lib/ambassador/wish-shape.ts).
 *
 * Owner-scoped via auth.uid() → model_profiles.user_id. Service-role
 * client bypasses RLS for the join because public RLS would gate the
 * payment-row read on `status='completed' AND profile.is_published`,
 * which is fine for V1 but fragile against future RLS tightening.
 *
 * Mirrors the Slice 3A listings GET pattern.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('model_wishes_live')
    .select(WISH_LIVE_SELECT)
    .eq('model_id', profile.id)
    .order('created_at', { ascending: false })
    .returns<WishLiveRow[]>()

  if (error) {
    console.error('[Ambassador Wishes] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load wishes' }, { status: 500 })
  }

  const wishes = (data ?? []).map(toWishCardRow)
  return NextResponse.json({ wishes })
}
