import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  formatBankLast4,
  formatPayoutAmount,
  formatPrettyDate,
  statusBadge,
  statusHeroBadge,
  type PayoutStatus,
} from '@/lib/ambassador/payout-format'

/**
 * GET /api/ambassador/model/payouts/[id]
 *
 * Returns the statement detail for a single payout: hero (amount,
 * status, date, reference, listings/wishes counts, bank snapshot) +
 * listings line rows + wishes line rows. Each line row carries BOTH
 * NET (ambassador share, top-right 14px/600) and GROSS (charged
 * amount, bottom-right 10px/666) per dedicated mockup
 * payout_statement_final.html lines 104-146 — different from the
 * analytics overlay version which only shows net.
 *
 * Renewal-vs-package detection (decision ε): for each listing in the
 * payout, sort all that listing's payments by created_at and mark
 * the first as "package" + subsequent as "renewal". Computed via a
 * single batched query for all listings in the payout, then filtered
 * in-process.
 *
 * Auth-gated: the RLS policy "Owner read own payouts" already scopes
 * the model_payouts SELECT to the caller's profile; the ID-by-ID
 * lookup here returns 404 (not 403) if the row exists but belongs to
 * another model — matches the listings/wishes precedent.
 */

interface PayoutRow {
  id: string
  payout_reference: string
  net_total: number | string
  currency: string
  status: PayoutStatus
  paid_at: string | null
  created_at: string
  bank_name: string
  bank_last4: string
  listings_count: number
  wishes_count: number
}

interface ListingPaymentRow {
  id: string
  listing_id: string
  gross_amount: number | string
  net_amount: number | string
  package_days: number
  created_at: string
  listing: {
    professional: { name: string } | null
  } | null
}

interface WishPaymentRow {
  id: string
  wish_id: string
  gross_amount: number | string
  net_amount: number | string
  gifter_name: string | null
  gifter_is_anonymous: boolean
  created_at: string
  wish: { service_name: string } | null
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, is_suspended')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (profile.is_suspended) {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  }

  const profileId = profile.id as string

  const { data: payout, error: payoutErr } = await admin
    .from('model_payouts')
    .select('id, payout_reference, net_total, currency, status, paid_at, created_at, bank_name, bank_last4, listings_count, wishes_count')
    .eq('id', id)
    .eq('model_id', profileId)
    .maybeSingle<PayoutRow>()

  if (payoutErr) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
  }

  const [listingsRes, wishesRes] = await Promise.all([
    admin.from('model_listing_payments')
      .select(`
        id, listing_id, gross_amount, net_amount, package_days, created_at,
        listing:model_listings!model_listing_payments_listing_id_fkey (
          professional:model_professionals!model_listings_professional_id_fkey ( name )
        )
      `)
      .eq('payout_id', id)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
      .returns<ListingPaymentRow[]>(),
    admin.from('model_wish_payments')
      .select(`
        id, wish_id, gross_amount, net_amount, gifter_name, gifter_is_anonymous, created_at,
        wish:model_wishes!model_wish_payments_wish_id_fkey ( service_name )
      `)
      .eq('payout_id', id)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
      .returns<WishPaymentRow[]>(),
  ])

  const listingPayments = listingsRes.data ?? []
  const wishPayments = wishesRes.data ?? []

  // Renewal detection — fetch every prior payment for the listings in
  // this payout, then mark this row's payment as "renewal" if the
  // listing has any earlier completed payment in the model's history.
  const listingIds = [...new Set(listingPayments.map((p) => p.listing_id))]
  const renewalFlags = new Map<string, boolean>()
  if (listingIds.length > 0) {
    const { data: priorPayments } = await admin
      .from('model_listing_payments')
      .select('id, listing_id, created_at')
      .in('listing_id', listingIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
      .returns<{ id: string; listing_id: string; created_at: string }[]>()

    // Group by listing, find the FIRST completed payment per listing.
    // Any later payment is a "renewal".
    const firstPerListing = new Map<string, string>()
    for (const p of priorPayments ?? []) {
      if (!firstPerListing.has(p.listing_id)) firstPerListing.set(p.listing_id, p.id)
    }
    for (const p of listingPayments) {
      renewalFlags.set(p.id, firstPerListing.get(p.listing_id) !== p.id)
    }
  }

  const currency = payout.currency
  const heroBadge = statusHeroBadge(payout.status)
  const listBadge = statusBadge(payout.status)
  const isoForDate = payout.paid_at ?? payout.created_at

  const listings = listingPayments.map((p) => {
    const isRenewal = renewalFlags.get(p.id) ?? false
    const datePretty = formatPrettyDate(p.created_at)
    return {
      professional_name: p.listing?.professional?.name ?? 'Unknown',
      package_days: p.package_days,
      is_renewal: isRenewal,
      paid_on_pretty: datePretty,
      net_amount_formatted: formatPayoutAmount(toNumber(p.net_amount), currency),
      gross_amount_formatted: formatPayoutAmount(toNumber(p.gross_amount), currency),
      subtitle: `${p.package_days}-day ${isRenewal ? 'renewal' : 'package'} · ${datePretty}`,
    }
  })

  const wishes = wishPayments.map((p) => {
    const datePretty = formatPrettyDate(p.created_at)
    const displayName = p.gifter_is_anonymous
      ? 'Secret Gifter'
      : (p.gifter_name ?? 'Secret Gifter')
    return {
      service_name: p.wish?.service_name ?? 'Wish',
      gifter_display_name: displayName,
      paid_on_pretty: datePretty,
      net_amount_formatted: formatPayoutAmount(toNumber(p.net_amount), currency),
      gross_amount_formatted: formatPayoutAmount(toNumber(p.gross_amount), currency),
      subtitle: `${displayName} · ${datePretty}`,
    }
  })

  return NextResponse.json({
    id: payout.id,
    payout_reference: payout.payout_reference,
    status: payout.status,
    status_label: listBadge.label,
    status_color: listBadge.color,
    hero_badge: heroBadge,
    amount_formatted: formatPayoutAmount(toNumber(payout.net_total), currency),
    currency: currency.toUpperCase(),
    date_pretty: formatPrettyDate(isoForDate),
    listings_count: payout.listings_count,
    wishes_count: payout.wishes_count,
    bank_name: payout.bank_name,
    bank_last4_formatted: formatBankLast4(payout.bank_last4),
    listings,
    wishes,
  })
}

function toNumber(n: number | string): number {
  return typeof n === 'string' ? Number(n) : n
}
