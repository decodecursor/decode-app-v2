import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { toWishCardRow, WISH_LIVE_SELECT, type WishLiveRow } from '@/lib/ambassador/wish-shape'

/**
 * DELETE /api/ambassador/model/wishes/[id]
 *
 * Hard delete, owner-only (via model_profiles.user_id = auth.uid()).
 *
 * Mirrors Slice 3A listings DELETE pattern. Backend re-validates: if
 * the wish has a completed payment row, return 409 with a fresh wish
 * payload so the client can update the card in place. The DB also
 * enforces this via FK ON DELETE RESTRICT on
 * model_wish_payments.wish_id — the 409 surface is the user-friendly
 * version of that constraint.
 *
 * Trial vs paid distinction doesn't apply to wishes — the only delete
 * gate is "has someone paid for this wish yet?". When status='taken'
 * + completed payment row exists, deletion is blocked.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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

  const { data: liveRow, error: readError } = await admin
    .from('model_wishes_live')
    .select(WISH_LIVE_SELECT)
    .eq('id', id)
    .eq('model_id', profile.id)
    .maybeSingle<WishLiveRow>()

  if (readError) {
    console.error('[Ambassador Wishes] DELETE read failed:', readError)
    return NextResponse.json({ error: 'Failed to load wish' }, { status: 500 })
  }

  if (!liveRow) {
    return NextResponse.json({ error: 'Wish not found' }, { status: 404 })
  }

  const fresh = toWishCardRow(liveRow)

  if (!fresh.removable) {
    return NextResponse.json(
      { error: 'wish_now_gifted', wish: fresh },
      { status: 409 },
    )
  }

  const { error: deleteError } = await admin
    .from('model_wishes')
    .delete()
    .eq('id', id)
    .eq('model_id', profile.id)

  if (deleteError) {
    console.error('[Ambassador Wishes] DELETE failed:', deleteError)
    return NextResponse.json({ error: 'Failed to delete wish' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
