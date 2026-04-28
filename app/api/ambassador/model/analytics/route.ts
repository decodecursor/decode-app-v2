import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  buildRange,
  computeRanges,
  type AnalyticsEvent,
  type ListingPayment,
  type WishPayment,
  type RangeKey,
} from '@/lib/ambassador/analytics-aggregate'

/**
 * GET /api/ambassador/model/analytics
 *
 * Returns aggregated analytics for the authenticated ambassador across
 * 4 ranges (today / week / month / all). Per spec §2.2 the client
 * fetches once on mount and swaps datasets on filter-tab change — no
 * subsequent network calls.
 *
 * Path matches Slice 5A `/api/ambassador/model/wishes/` precedent;
 * HANDOFF §1053 `/api/model/analytics` superseded by Slice 6 locked
 * decision #1 (the legacy auctions analytics endpoint occupies
 * `/api/analytics/model`).
 *
 * Aggregation lives in lib/ambassador/analytics-aggregate.ts (decision E
 * decompose-upfront). This route owns auth + data fetch only.
 */

interface ListingMeta {
  id: string
  professional: { name: string } | null
}

interface WishMeta {
  id: string
  service_name: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, currency, is_suspended, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (profile.is_suspended) {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  }

  const profileId = profile.id as string
  const currency = profile.currency as string

  const [eventsRes, listingsPaymentsRes, wishPaymentsRes, listingsMetaRes, wishesMetaRes] = await Promise.all([
    admin.from('model_analytics_events')
      .select('event_type, target_id, created_at')
      .eq('model_id', profileId)
      .returns<AnalyticsEvent[]>(),
    admin.from('model_listing_payments')
      .select('net_amount, status, refunded_at, refund_amount, created_at, listing_id')
      .eq('model_id', profileId)
      .in('status', ['completed', 'refunded', 'partial_refund'])
      .returns<ListingPayment[]>(),
    admin.from('model_wish_payments')
      .select('net_amount, status, refunded_at, refund_amount, created_at, wish_id, gifter_name, gifter_is_anonymous')
      .eq('model_id', profileId)
      .in('status', ['completed', 'refunded', 'partial_refund'])
      .returns<WishPayment[]>(),
    admin.from('model_listings')
      .select('id, professional:model_professionals!model_listings_professional_id_fkey(name)')
      .eq('model_id', profileId)
      .returns<ListingMeta[]>(),
    admin.from('model_wishes')
      .select('id, service_name')
      .eq('model_id', profileId)
      .returns<WishMeta[]>(),
  ])

  const events = eventsRes.data ?? []
  const listingPayments = listingsPaymentsRes.data ?? []
  const wishPayments = wishPaymentsRes.data ?? []
  const listingNames = new Map(
    (listingsMetaRes.data ?? []).map((l) => [l.id, l.professional?.name ?? 'Unknown']),
  )
  const wishNames = new Map((wishesMetaRes.data ?? []).map((w) => [w.id, w.service_name]))

  // Compute the earliest row across the 3 in-scope tables for the
  // "All" tab lower bound. Pure in-memory MIN over the arrays already
  // fetched above — no extra round-trips. NULL when no data exists
  // for this model (computeRanges falls back to profileCreatedAt).
  const allCreatedAts: number[] = []
  for (const e of events) {
    const t = Date.parse(e.created_at)
    if (Number.isFinite(t)) allCreatedAts.push(t)
  }
  for (const p of listingPayments) {
    const t = Date.parse(p.created_at)
    if (Number.isFinite(t)) allCreatedAts.push(t)
  }
  for (const p of wishPayments) {
    const t = Date.parse(p.created_at)
    if (Number.isFinite(t)) allCreatedAts.push(t)
  }
  const dataFloor = allCreatedAts.length > 0 ? new Date(Math.min(...allCreatedAts)) : null

  const ranges = computeRanges(new Date(), new Date(profile.created_at as string), dataFloor)

  const out: Record<string, unknown> = {}
  for (const key of ['today', 'week', 'month', 'all'] as const satisfies RangeKey[]) {
    out[key] = buildRange(key, ranges[key], events, listingPayments, wishPayments, listingNames, wishNames, currency)
  }
  return NextResponse.json(out)
}
