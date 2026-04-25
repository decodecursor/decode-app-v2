import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * GET /api/wishes/by-payment-intent/[pi_id]
 *
 * Receipt hydration for /wish/confirmation/[pi_id]. Sibling of the
 * listings receipt endpoint at /api/listings/by-payment-intent/[pi_id]
 * — same security model, same pending-webhook retry shape, different
 * row projection (no package_days / period_end; gifter identity
 * surfaced for the receipt body and Wall of Love attribution).
 *
 * Auth model: no auth. `pi_xxx` is 27+ chars of base62 (~161 bits of
 * entropy), effectively unguessable.
 *
 * Pending-webhook retry: Stripe's post-payment redirect can land
 * before payment_intent.succeeded arrives at our webhook. When the
 * model_wish_payments row is not yet written we return
 * `{ status: 'pending_payment' }` with HTTP 200 so the client can
 * retry every 1s up to 5 times. After retries exhaust the client
 * renders optimistically — Stripe already confirmed success at its
 * end, so the worst case is a brief perceived-but-temporary lag.
 */

const PI_PATTERN = /^pi_[A-Za-z0-9]{20,}$/

type Row = {
  payment_reference: string
  gross_amount: number
  currency: string
  status: string
  presentment_amount: number | null
  presentment_currency: string | null
  refunded_at: string | null
  refund_amount: number | null
  created_at: string
  wish: {
    id: string
    service_name: string
    professional_name: string | null
    professional_city: string | null
    professional_country: string | null
    gifter_name: string | null
    gifter_instagram: string | null
    gifter_is_anonymous: boolean
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
  wish: {
    id: string
    service_name: string
    professional_name: string | null
    professional_city: string | null
    professional_country: string | null
  } | null
  // Gifter identity for the receipt + (downstream) Wall of Love. When
  // gifter_is_anonymous=true, name and instagram are null regardless
  // of what's on the wish row (defense-in-depth — the API enforced this
  // at write time too, but a future writer that bypasses /api/checkout/wish
  // can't leak identity through the receipt this way).
  gifter: {
    name: string | null
    instagram: string | null
    is_anonymous: boolean
  }
  amount: number
  currency: string
  presentment_amount: number | null
  presentment_currency: string | null
  paid_at: string
  status: string
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
    .from('model_wish_payments')
    .select(`
      payment_reference, gross_amount, currency, status,
      presentment_amount, presentment_currency,
      refunded_at, refund_amount, created_at,
      wish:model_wishes!model_wish_payments_wish_id_fkey (
        id, service_name, professional_name, professional_city, professional_country,
        gifter_name, gifter_instagram, gifter_is_anonymous
      ),
      profile:model_profiles!model_wish_payments_model_id_fkey (
        id, slug, first_name, last_name
      )
    `)
    .eq('stripe_payment_intent_id', pi_id)
    .maybeSingle<Row>()

  if (error) {
    console.error('[Wish Receipt] Lookup failed:', error)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }

  if (!payment) {
    return NextResponse.json({ status: 'pending_payment' })
  }

  const wish = payment.wish
  const profile = payment.profile
  const ambassadorName = profile
    ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    : null

  const isAnon = wish?.gifter_is_anonymous ?? false
  const is_refunded = payment.status === 'refunded' || payment.status === 'partial_refund'

  const response: ReceiptResponse = {
    reference: payment.payment_reference,
    ambassador: profile && ambassadorName
      ? { id: profile.id, name: ambassadorName, slug: profile.slug }
      : null,
    wish: wish
      ? {
          id: wish.id,
          service_name: wish.service_name,
          professional_name: wish.professional_name,
          professional_city: wish.professional_city,
          professional_country: wish.professional_country,
        }
      : null,
    gifter: {
      name: isAnon ? null : wish?.gifter_name ?? null,
      instagram: isAnon ? null : wish?.gifter_instagram ?? null,
      is_anonymous: isAnon,
    },
    amount: Number(payment.gross_amount),
    currency: payment.currency,
    presentment_amount: payment.presentment_amount != null ? Number(payment.presentment_amount) : null,
    presentment_currency: payment.presentment_currency,
    paid_at: payment.created_at,
    status: payment.status,
    is_refunded,
    refunded_at: payment.refunded_at,
    refund_amount: payment.refund_amount != null ? Number(payment.refund_amount) : null,
  }

  return NextResponse.json(response)
}
