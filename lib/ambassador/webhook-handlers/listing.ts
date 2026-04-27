/**
 * Listing-flow per-event handlers for /api/webhooks/ambassador-stripe.
 *
 * Carved out of the prior single-file webhook-handlers.ts at the start
 * of Slice 5C so wish-flow handlers (Slice 5C-2) can live alongside as
 * a sibling file without growing one file past the G12 #8 alarm.
 *
 * Contracts (unchanged from pre-split):
 *  - Every handler throws on unexpected errors → the route marks the
 *    webhook_events row as 'failed' + returns 500 so Stripe retries.
 *  - Handlers returning normally mean "processed" — the row gets
 *    marked 'processed'. The route owns that state machine.
 *  - All DB access through the service-role admin client the route
 *    passes in. No handler constructs its own client.
 *  - Idempotency: succeeded handler double-checks model_listing_payments
 *    .stripe_event_id before inserting, so the "same event processed
 *    twice" case is a silent no-op even if the outer webhook_events
 *    dedup somehow fails.
 *  - Each handler defensively no-ops on metadata.kind !== 'listing' so
 *    wish events landing on the same Stripe endpoint don't false-fire.
 *    Wish handlers (Slice 5C-2) do the symmetric guard for 'wish'.
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { splitFee, computePaymentPeriod } from '../payout-math'
import { generateReference } from '../utils'
import { sendListingPaidEmail, sendListingPaidWhatsApp } from '../notification-stubs'

type Admin = SupabaseClient

// Narrow row shapes for the joins the handlers need. Matches the live
// schema as verified via Supabase MCP; declared locally so a future
// schema change surfaces as a typecheck failure here.

interface ListingWithProfileRow {
  id: string
  model_id: string
  price_30: number | null
  price_60: number | null
  price_90: number | null
  currency: string
  paid_until: string | null
  category_custom: string | null
  model_categories: { label: string } | null
  model_professionals: { name: string } | null
  profile: { slug: string; first_name: string; last_name: string | null; user_id: string } | null
}

interface ExistingPaymentRow {
  id: string
  gross_amount: number
  currency: string
  status: string
  refund_amount: number | null
}

export async function handleListingPaymentSucceeded(
  admin: Admin,
  event: Stripe.Event,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent
  const meta = pi.metadata ?? {}
  if (meta.feature !== 'ambassador' || meta.kind !== 'listing') {
    // Not ours — wish events land here from Slice 5 and route by kind.
    // Defensive no-op rather than throw so Stripe doesn't retry.
    console.log(`[ambassador-webhook] succeeded: ignoring non-listing event ${event.id}`)
    return
  }

  // Inner-layer idempotency — the outer webhook_events UNIQUE(event_id)
  // is the primary dedup, this catches the (very rare) case where a
  // prior run wrote the payment row but crashed before marking
  // webhook_events 'processed'. Stripe then retries, outer dedup
  // misses, and we'd double-INSERT without this check.
  const { data: existing } = await admin
    .from('model_listing_payments')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()
  if (existing) {
    console.log(`[ambassador-webhook] succeeded: row already exists for event ${event.id}`)
    return
  }

  const listingId = meta.listing_id
  const packageDays = Number(meta.package_days)
  if (!listingId || !Number.isInteger(packageDays) || ![30, 60, 90].includes(packageDays)) {
    throw new Error(`succeeded: bad metadata listing_id=${listingId} package_days=${meta.package_days}`)
  }

  const { data: listing, error: listingErr } = await admin
    .from('model_listings')
    .select(`
      id, model_id, price_30, price_60, price_90, currency, paid_until, category_custom,
      model_categories!model_listings_category_id_fkey ( label ),
      model_professionals!model_listings_professional_id_fkey ( name ),
      profile:model_profiles!model_listings_model_id_fkey ( slug, first_name, last_name, user_id )
    `)
    .eq('id', listingId)
    .maybeSingle<ListingWithProfileRow>()

  if (listingErr) throw listingErr
  if (!listing) throw new Error(`succeeded: listing ${listingId} not found`)
  if (!listing.profile) throw new Error(`succeeded: listing ${listingId} has no profile join`)

  // Server-side price re-derivation — never trust the PI amount blindly
  // (defense-in-depth, even though /api/checkout/listing already set it).
  const priceField = packageDays === 30 ? 'price_30' : packageDays === 60 ? 'price_60' : 'price_90'
  const storedPrice = listing[priceField]
  if (storedPrice == null) {
    throw new Error(`succeeded: listing ${listingId} has no price for package_days ${packageDays}`)
  }
  const gross = Number(storedPrice)
  const { fee, net } = splitFee(gross)

  const currentPaidUntil = listing.paid_until ? new Date(listing.paid_until) : null
  const { periodStart, periodEnd } = computePaymentPeriod(currentPaidUntil, packageDays)

  // Insert with reference-collision retry. payment_reference space is
  // 9M (L-xxx-xxxx); a collision will fail the UNIQUE index and we
  // regenerate. 3 retries is overkill but cheap.
  let inserted = false
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const ref = generateReference('L')
    const { error: insertErr } = await admin.from('model_listing_payments').insert({
      payment_reference: ref,
      listing_id: listing.id,
      model_id: listing.model_id,
      gross_amount: gross,
      platform_fee: fee,
      net_amount: net,
      currency: listing.currency,
      package_days: packageDays,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      payer_email: pi.receipt_email,
      stripe_payment_intent_id: pi.id,
      stripe_event_id: event.id,
      status: 'completed',
    })
    if (!insertErr) {
      inserted = true
      break
    }
    const code = (insertErr as { code?: string }).code
    const msg = insertErr.message ?? ''
    if (code === '23505' && msg.includes('stripe_event_id')) {
      // Another concurrent run inserted first — treat as success.
      console.log(`[ambassador-webhook] succeeded: concurrent insert detected, event ${event.id}`)
      return
    }
    if (code === '23505' && msg.includes('payment_reference')) {
      continue // retry with a fresh ref
    }
    throw insertErr
  }
  if (!inserted) throw new Error(`succeeded: payment_reference collision after 3 retries for listing ${listing.id}`)

  // Promote the listing. is_free_trial=false unconditionally — trial
  // listings paying for the first time transition through this path
  // per locked decision #5. status='active' on both first-payment and
  // renewal; paid_until becomes the period_end we just computed
  // (which already did the MAX(current, now) + days stacking).
  const { error: updateErr } = await admin
    .from('model_listings')
    .update({
      status: 'active',
      is_free_trial: false,
      paid_until: periodEnd.toISOString(),
    })
    .eq('id', listing.id)
  if (updateErr) throw updateErr

  // ISR revalidation so the public /{slug} page reflects the paid listing
  // immediately instead of waiting up to 60s for the next ISR cycle.
  revalidatePath(`/${listing.profile.slug}`)

  // Fire-and-forget notifications. Ambassador email comes from users;
  // phone comes from users.phone_number (nullable — stub handles null).
  const { data: ambassadorUser } = await admin
    .from('users')
    .select('email, phone_number')
    .eq('id', listing.profile.user_id)
    .maybeSingle<{ email: string | null; phone_number: string | null }>()

  const ambassadorFirstName = listing.profile.first_name
  const ambassadorFullName = `${listing.profile.first_name}${listing.profile.last_name ? ' ' + listing.profile.last_name : ''}`
  const professionalName = listing.model_professionals?.name ?? 'your professional'
  const reference = (await fetchReferenceByEventId(admin, event.id)) ?? 'L-???-????'
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
  const receiptUrl = `${appBase}/listing/confirmation/${encodeURIComponent(pi.id)}`

  // Don't await — spec §6.4 says notification failure MUST NOT roll
  // back the DB update, and Stripe's 30s webhook timeout makes
  // blocking calls risky.
  void sendListingPaidEmail({
    payerEmail: pi.receipt_email,
    ambassadorEmail: ambassadorUser?.email ?? '',
    ambassadorFirstName,
    ambassadorFullName,
    professionalName,
    packageDays,
    amount: gross,
    currency: listing.currency,
    reference,
    purchaseDate: new Date(),
    startDate: periodStart,
    endDate: periodEnd,
    ambassadorSlug: listing.profile.slug,
    receiptUrl,
  }).catch((err) => console.error('[ambassador-webhook] listing-paid email failed:', err))

  void sendListingPaidWhatsApp({
    ambassadorPhone: ambassadorUser?.phone_number ?? null,
    professionalName,
    packageDays,
    amount: gross,
    currency: listing.currency,
    reference,
    ambassadorSlug: listing.profile.slug,
  }).catch((err) => console.error('[ambassador-webhook] whatsapp stub failed:', err))
}

async function fetchReferenceByEventId(admin: Admin, eventId: string): Promise<string | null> {
  const { data } = await admin
    .from('model_listing_payments')
    .select('payment_reference')
    .eq('stripe_event_id', eventId)
    .maybeSingle<{ payment_reference: string }>()
  return data?.payment_reference ?? null
}

export async function handleListingPaymentFailed(
  admin: Admin,
  event: Stripe.Event,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent
  const meta = pi.metadata ?? {}
  if (meta.feature !== 'ambassador' || meta.kind !== 'listing') {
    return
  }

  const reason = pi.last_payment_error?.message ?? 'payment_intent.payment_failed'
  console.log(`[ambassador-webhook] failed: pi=${pi.id} listing=${meta.listing_id} reason=${reason}`)

  // We only INSERT on success, so there's no row to update on failure
  // in the common case. Listing stays in whatever state it was in
  // (pending_payment / free_trial / expired) — the professional can
  // retry from the same /pay/[token] URL.
}

export async function handleListingChargeRefunded(
  admin: Admin,
  event: Stripe.Event,
): Promise<void> {
  const charge = event.data.object as Stripe.Charge
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!piId) {
    console.log(`[ambassador-webhook] refunded: charge ${charge.id} has no payment_intent`)
    return
  }

  const { data: payment } = await admin
    .from('model_listing_payments')
    .select('id, gross_amount, currency, status, refund_amount')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle<ExistingPaymentRow>()

  if (!payment) {
    // Not one of ours (legacy offer, auction, or ambassador wish Slice 5).
    console.log(`[ambassador-webhook] refunded: no listing payment for pi ${piId}`)
    return
  }

  // Stripe's amount_refunded is cumulative across multiple partial
  // refunds. Determine full-vs-partial from the total refunded so
  // two partial refunds that sum to full correctly land on 'refunded'.
  const refundDecimal = charge.amount_refunded / 100
  const isFullRefund = charge.amount_refunded >= charge.amount
  const newStatus = isFullRefund ? 'refunded' : 'partial_refund'

  const { error: updateErr } = await admin
    .from('model_listing_payments')
    .update({
      status: newStatus,
      refunded_at: new Date().toISOString(),
      refund_amount: refundDecimal,
    })
    .eq('id', payment.id)
  if (updateErr) throw updateErr

  // Listing.status NOT automatically flipped to expired/refunded —
  // that's an admin-tool concern (locked decision #5 addendum).
  // Confirmation page reads the payment-row status via is_refunded
  // flag and renders the refund UI regardless of listing status.
}
