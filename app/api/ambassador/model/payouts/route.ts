import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  formatPayoutAmount,
  formatPrettyDate,
  formatScheduledForPretty,
  nextPayoutDate,
  statusBadge,
  type PayoutStatus,
} from '@/lib/ambassador/payout-format'

/**
 * GET /api/ambassador/model/payouts
 *
 * Returns the ambassador's payouts list: a computed `next_payout`
 * aggregate (sum of unbatched completed payments + next-Wednesday
 * date — no row exists in model_payouts until admin batches) plus a
 * `history` array of model_payouts rows.
 *
 * Auth-gated. Service-role read scoped by model_id = profile.id.
 * Path matches Slice 5A `/api/ambassador/model/wishes/` precedent
 * + Slice 6A `/api/ambassador/model/analytics`.
 *
 * Per Slice 6B-1 locked decisions:
 *   - α: status badges include pending/processing/failed in addition
 *     to mockup-only paid (failed=#ef4444 red per override)
 *   - δ: payout_reference uses P-XXX-XXXX 9-char format (matches
 *     existing L/W shape, deviates from mockup's P + 7 digits)
 *   - ζ: empty state when both history=0 AND unbatched_total=0
 *   - η: bank info NOT included on next_payout summary (only on
 *     statement detail)
 *   - θ: next_payout shows even if ambassador has no primary bank
 *     (operational concern, not a UI gate)
 *
 * Slice 6B-2 (separate, follow-up) will ship the admin POST endpoint
 * + create_payout_batch() RPC that populates model_payouts rows.
 */

interface PayoutRow {
  id: string
  payout_reference: string
  net_total: number | string
  currency: string
  status: PayoutStatus
  paid_at: string | null
  created_at: string
}

interface UnbatchedPayment {
  net_amount: number | string
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
    .select('id, currency, is_suspended')
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

  const [payoutsRes, listingPaymentsRes, wishPaymentsRes] = await Promise.all([
    admin.from('model_payouts')
      .select('id, payout_reference, net_total, currency, status, paid_at, created_at')
      .eq('model_id', profileId)
      .order('created_at', { ascending: false })
      .returns<PayoutRow[]>(),
    admin.from('model_listing_payments')
      .select('net_amount')
      .eq('model_id', profileId)
      .eq('status', 'completed')
      .is('payout_id', null)
      .returns<UnbatchedPayment[]>(),
    admin.from('model_wish_payments')
      .select('net_amount')
      .eq('model_id', profileId)
      .eq('status', 'completed')
      .is('payout_id', null)
      .returns<UnbatchedPayment[]>(),
  ])

  const payouts = payoutsRes.data ?? []
  const unbatchedTotal =
    sumNet(listingPaymentsRes.data ?? []) +
    sumNet(wishPaymentsRes.data ?? [])

  const history = payouts.map((p) => {
    const badge = statusBadge(p.status)
    // For non-paid rows the date_pretty falls back to created_at — the
    // mockup only draws Paid rows, so "8 April 2026" was paid_at; for
    // pending/processing we surface the batch-creation date instead so
    // the row is still informative.
    const isoForDate = p.paid_at ?? p.created_at
    return {
      id: p.id,
      payout_reference: p.payout_reference,
      date_pretty: formatPrettyDate(isoForDate),
      amount_formatted: formatPayoutAmount(toNumber(p.net_total), p.currency),
      status: p.status,
      status_label: badge.label,
      status_color: badge.color,
    }
  })

  const historyTotal = payouts.reduce((s, p) => s + toNumber(p.net_total), 0)

  // ζ: empty state when both rows = 0 AND unbatched = 0
  const isEmpty = payouts.length === 0 && unbatchedTotal === 0

  // Next-payout summary: present whenever there's anything unbatched
  // (or even when zero, so the SCHEDULED card frames the user's
  // upcoming payout cycle). When isEmpty, return null so the client
  // hides the next-payout card entirely.
  const scheduled = nextPayoutDate()
  const nextPayout = isEmpty
    ? null
    : {
        amount: unbatchedTotal,
        amount_formatted: formatPayoutAmount(unbatchedTotal, currency),
        currency: currency.toUpperCase(),
        scheduled_for: scheduled.toISOString().slice(0, 10),
        scheduled_for_pretty: formatScheduledForPretty(scheduled.toISOString()),
      }

  return NextResponse.json({
    next_payout: nextPayout,
    history,
    history_count: history.length,
    history_total_formatted: formatPayoutAmount(historyTotal, currency),
    is_empty: isEmpty,
  })
}

function toNumber(n: number | string): number {
  return typeof n === 'string' ? Number(n) : n
}

function sumNet(rows: UnbatchedPayment[]): number {
  return rows.reduce((s, r) => s + toNumber(r.net_amount), 0)
}
