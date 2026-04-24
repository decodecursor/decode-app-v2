import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * GET /api/listings/by-payment-intent/[pi_id]
 *
 * Receipt hydration for /listing/confirmation/[pi_id].
 *
 * Returns the listing-payment row joined to listing, professional,
 * category and ambassador display fields — shape matches confirmation
 * spec §2.4.
 *
 * Auth model: no auth. `pi_xxx` is 27+ chars of base62 (~161 bits of
 * entropy), effectively unguessable. Same security pattern as
 * Stripe-hosted receipts (confirmation spec §6).
 *
 * Pending-webhook retry: Stripe's post-payment redirect can land
 * before payment_intent.succeeded arrives at our webhook. When the
 * model_listing_payments row is not yet written we return
 * `{ status: 'pending_payment' }` with HTTP 200 so the client retries
 * every 1s up to 5 times (spec §2.5). After retries exhaust the client
 * renders optimistically — Stripe already confirmed success at its end.
 *
 * Format validation on the path param prevents junk input from hitting
 * the DB and surfaces obvious bad routes as 400s.
 */

const PI_PATTERN = /^pi_[A-Za-z0-9]{20,}$/

type Row = {
  payment_reference: string
  gross_amount: number
  currency: string
  package_days: number
  period_start: string
  period_end: string
  status: string
  presentment_amount: number | null
  presentment_currency: string | null
  refunded_at: string | null
  refund_amount: number | null
  listing: {
    category_custom: string | null
    model_professionals: { name: string } | null
    model_categories: { label: string } | null
  } | null
  profile: {
    id: string
    slug: string
    first_name: string
    last_name: string | null
  } | null
}

type ReceiptResponse = {
  reference: string
  ambassador: { id: string; name: string; slug: string } | null
  professional: { name: string } | null
  category: string | null
  duration_days: number
  active_until: string
  amount: number
  currency: string
  presentment_amount: number | null
  presentment_currency: string | null
  paid_at: string
  status: string
  is_expired: boolean
  is_refunded: boolean
  refunded_at: string | null
  refund_amount: number | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pi_id: string }> },
) {
  const { pi_id } = await params

  if (!PI_PATTERN.test(pi_id)) {
    return NextResponse.json({ error: 'invalid_pi_id' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  const { data: payment, error } = await admin
    .from('model_listing_payments')
    .select(`
      payment_reference, gross_amount, currency, package_days,
      period_start, period_end, status,
      presentment_amount, presentment_currency,
      refunded_at, refund_amount,
      listing:model_listings!model_listing_payments_listing_id_fkey (
        category_custom,
        model_professionals!model_listings_professional_id_fkey ( name ),
        model_categories!model_listings_category_id_fkey ( label )
      ),
      profile:model_profiles!model_listing_payments_model_id_fkey (
        id, slug, first_name, last_name
      )
    `)
    .eq('stripe_payment_intent_id', pi_id)
    .maybeSingle<Row>()

  if (error) {
    console.error('[Receipt] Lookup failed:', error)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }

  if (!payment) {
    // Webhook hasn't processed yet (or this pi_xxx doesn't belong to us).
    // Client treats this as "retry up to 5×"; after that it renders optimistic.
    return NextResponse.json({ status: 'pending_payment' })
  }

  const periodEndMs = new Date(payment.period_end).getTime()
  const is_expired = Number.isFinite(periodEndMs) && periodEndMs < Date.now()
  const is_refunded = payment.status === 'refunded' || payment.status === 'partial_refund'

  const profile = payment.profile
  const listing = payment.listing
  const professional = listing?.model_professionals ?? null
  const category = listing?.model_categories ?? null
  const categoryLabel = category?.label ?? listing?.category_custom ?? null
  const ambassadorName = profile
    ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    : null

  const response: ReceiptResponse = {
    reference: payment.payment_reference,
    ambassador: profile && ambassadorName
      ? { id: profile.id, name: ambassadorName, slug: profile.slug }
      : null,
    professional: professional ? { name: professional.name } : null,
    category: categoryLabel,
    duration_days: payment.package_days,
    active_until: payment.period_end,
    amount: Number(payment.gross_amount),
    currency: payment.currency,
    presentment_amount: payment.presentment_amount != null ? Number(payment.presentment_amount) : null,
    presentment_currency: payment.presentment_currency,
    paid_at: payment.period_start,
    status: payment.status,
    is_expired,
    is_refunded,
    refunded_at: payment.refunded_at,
    refund_amount: payment.refund_amount != null ? Number(payment.refund_amount) : null,
  }

  return NextResponse.json(response)
}
