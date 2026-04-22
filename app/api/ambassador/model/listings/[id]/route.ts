import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { toCardRow, LIVE_VIEW_SELECT, type LiveViewRow } from '@/lib/ambassador/listing-shape'

/**
 * DELETE /api/ambassador/model/listings/[id]
 *
 * Hard delete, owner-only (via model_profiles.user_id = auth.uid()).
 *
 * Per listings_final_UI_Spec §7.8, the backend re-validates — it does
 * NOT trust the client's earlier decision: if the listing's
 * effective_status is 'active' (paid, not yet expired), return 409
 * with a fresh listing payload so the client can update the row in
 * place without a second fetch.
 *
 * Trial / pending / expired → DELETE returns 200.
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
    .from('model_listings_live')
    .select(LIVE_VIEW_SELECT)
    .eq('id', id)
    .eq('model_id', profile.id)
    .maybeSingle<LiveViewRow>()

  if (readError) {
    console.error('[Ambassador Listings] DELETE read failed:', readError)
    return NextResponse.json({ error: 'Failed to load listing' }, { status: 500 })
  }

  if (!liveRow) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const fresh = toCardRow(liveRow)

  if (!fresh.removable) {
    return NextResponse.json(
      { error: 'listing_now_active', listing: fresh },
      { status: 409 },
    )
  }

  const { error: deleteError } = await admin
    .from('model_listings')
    .delete()
    .eq('id', id)
    .eq('model_id', profile.id)

  if (deleteError) {
    console.error('[Ambassador Listings] DELETE failed:', deleteError)
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
