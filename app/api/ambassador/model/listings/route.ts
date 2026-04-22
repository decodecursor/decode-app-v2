import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { toCardRow, LIVE_VIEW_SELECT, type LiveViewRow } from '@/lib/ambassador/listing-shape'

/**
 * GET /api/ambassador/model/listings
 *
 * Returns the caller's listings from the model_listings_live view,
 * joined with professional + category, ordered by created_at DESC.
 * Projected into the card shape the Listings page expects (see
 * lib/ambassador/listing-shape.ts). PATCH will live in this file later
 * (Slice 3C edit flow).
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
    .from('model_listings_live')
    .select(LIVE_VIEW_SELECT)
    .eq('model_id', profile.id)
    .order('created_at', { ascending: false })
    .returns<LiveViewRow[]>()

  if (error) {
    console.error('[Ambassador Listings] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load listings' }, { status: 500 })
  }

  const listings = (data ?? []).map(toCardRow)
  return NextResponse.json({ listings })
}
