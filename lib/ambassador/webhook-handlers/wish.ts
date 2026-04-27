/**
 * Wish-flow per-event handlers for /api/webhooks/ambassador-stripe.
 *
 * Sibling of listing.ts. Same contract:
 *  - Throw on unexpected errors → route marks 'failed' + 500 → Stripe retries
 *  - Return normally → route marks 'processed' → 200
 *  - Defensive metadata.kind !== 'wish' guard so listing events landing
 *    on the wish dispatcher (shouldn't happen given route.ts dispatch
 *    by metadata.kind, but defense-in-depth) silently no-op
 *  - Idempotency: dual-layer — outer webhook_events.event_id UNIQUE
 *    plus inner model_wish_payments.stripe_event_id UNIQUE so a retry
 *    that bypasses the outer dedup still no-ops at the inner check
 *
 * Lock semantics (paired with /api/checkout/wish + claim_wish_for_payment):
 *  - On succeeded: INSERT model_wish_payments (status='completed'). The
 *    wish row stays at status='taken' permanently — the payment row
 *    anchors the lock, model_wishes_live.effective_status keeps
 *    reading 'taken' (computed view ignores expires once a payment row
 *    exists). No need to clear payment_attempt_expires_at.
 *  - On failed: log only. The wish stays in its 10-min lock window,
 *    giving the original gifter a chance to retry from /pay/{token}
 *    without a competing claim. After expiry the schema's
 *    `revert_expired_wish_locks()` cron releases it back to available.
 *  - On refunded: update payment row status; wish row not auto-released
 *    (admin-tool concern, mirrors listings refund behavior).
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { splitFee } from '../payout-math'
import { generateReference } from '../utils'
import { sendWishGiftedEmail, sendWishGiftedWhatsApp } from '../notification-stubs'

type Admin = SupabaseClient

interface WishWithProfileRow {
  id: string
  model_id: string
  price: number | string
  currency: string
  service_name: string
  professional_name: string | null
  gifter_name: string | null
  gifter_instagram: string | null
  gifter_is_anonymous: boolean
  profile: { slug: string; first_name: string; last_name: string; user_id: string } | null
}

interface ExistingWishPaymentRow {
  id: string
  gross_amount: number
  currency: string
  status: string
  refund_amount: number | null
}

export async function handleWishPaymentSucceeded(
  admin: Admin,
  event: Stripe.Event,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent
  const meta = pi.metadata ?? {}
  if (meta.feature !== 'ambassador' || meta.kind !== 'wish') {
    console.log(`[ambassador-webhook] wish.succeeded: ignoring non-wish event ${event.id}`)
    return
  }

  // Inner-layer idempotency — paired with model_wish_payments
  // .stripe_event_id UNIQUE constraint. Catches the (very rare) case
  // where a prior run wrote the row but crashed before marking
  // webhook_events 'processed', so Stripe retries and we'd otherwise
  // hit the UNIQUE violation on insert.
  const { data: existing } = await admin
    .from('model_wish_payments')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()
  if (existing) {
    console.log(`[ambassador-webhook] wish.succeeded: row already exists for event ${event.id}`)
    return
  }

  const wishId = meta.wish_id
  if (!wishId) {
    throw new Error(`wish.succeeded: missing wish_id metadata on ${event.id}`)
  }

  const { data: wish, error: wishErr } = await admin
    .from('model_wishes')
    .select(`
      id, model_id, price, currency, service_name, professional_name,
      gifter_name, gifter_instagram, gifter_is_anonymous,
      profile:model_profiles!model_wishes_model_id_fkey ( slug, first_name, last_name, user_id )
    `)
    .eq('id', wishId)
    .maybeSingle<WishWithProfileRow>()

  if (wishErr) throw wishErr
  if (!wish) throw new Error(`wish.succeeded: wish ${wishId} not found`)
  if (!wish.profile) throw new Error(`wish.succeeded: wish ${wishId} has no profile join`)

  // Server-side amount re-derivation — never trust the PI amount blindly
  // (defense-in-depth, even though /api/checkout/wish already set it).
  const gross = typeof wish.price === 'string' ? Number(wish.price) : wish.price
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error(`wish.succeeded: wish ${wishId} has invalid price ${wish.price}`)
  }
  const { fee, net } = splitFee(gross)

  // Snapshot gifter identity at completion. The wish row's gifter_*
  // columns can be clobbered by a future re-claim (per Slice 5C
  // closeout: schema-designed overwrite-without-preservation), so
  // analytics + statement display read from these payment-row
  // snapshots, not from the wish row. Anonymous gifts null name + IG
  // here as defense-in-depth (DB CHECK
  // model_wish_payments_anonymous_no_identity also enforces).
  const isAnonymous = wish.gifter_is_anonymous === true
  const snapshotName = isAnonymous ? null : wish.gifter_name
  const snapshotIg   = isAnonymous ? null : wish.gifter_instagram

  // Insert with reference-collision retry. payment_reference space is
  // 9M (W-xxx-xxxx); a collision will fail the UNIQUE index and we
  // regenerate. 3 retries is overkill but cheap.
  let inserted = false
  let paymentReference = ''
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const ref = generateReference('W')
    const { error: insertErr } = await admin.from('model_wish_payments').insert({
      payment_reference: ref,
      wish_id: wish.id,
      model_id: wish.model_id,
      gross_amount: gross,
      platform_fee: fee,
      net_amount: net,
      currency: wish.currency,
      gifter_email: pi.receipt_email,
      gifter_name: snapshotName,
      gifter_instagram: snapshotIg,
      gifter_is_anonymous: isAnonymous,
      stripe_payment_intent_id: pi.id,
      stripe_event_id: event.id,
      status: 'completed',
    })
    if (!insertErr) {
      inserted = true
      paymentReference = ref
      break
    }
    const code = (insertErr as { code?: string }).code
    const msg = insertErr.message ?? ''
    if (code === '23505' && msg.includes('stripe_event_id')) {
      // Concurrent run inserted first — treat as success.
      console.log(`[ambassador-webhook] wish.succeeded: concurrent insert detected, event ${event.id}`)
      return
    }
    if (code === '23505' && msg.includes('payment_reference')) {
      continue // retry with a fresh ref
    }
    throw insertErr
  }
  if (!inserted) {
    throw new Error(`wish.succeeded: payment_reference collision after 3 retries for wish ${wish.id}`)
  }

  // Wish row left at status='taken' permanently — the new payment row
  // anchors the lock, and model_wishes_live.effective_status will keep
  // reading 'taken' (the view's NOT EXISTS subquery sees the new
  // completed payment row and stops auto-reverting). No UPDATE needed.

  // ISR revalidation so the public /{slug} page reflects the gifted
  // wish immediately on next visit (Wall of Love + wishlist surfaces).
  revalidatePath(`/${wish.profile.slug}`)

  // Fire-and-forget gifter receipt email + ambassador WhatsApp.
  // Anonymous-vs-named copy branching happens inside each sender.
  const giftLabel = wish.professional_name
    ? `${wish.service_name} @ ${wish.professional_name}`
    : wish.service_name
  void sendWishGiftedEmail({
    gifterEmail: pi.receipt_email,
    ambassadorFirstName: wish.profile.first_name,
    ambassadorFullName: `${wish.profile.first_name} ${wish.profile.last_name}`.trim(),
    isAnonymous,
    reference: paymentReference,
    giftLabel,
    purchaseDate: new Date(),
    amount: gross,
    currency: wish.currency,
    gifterName: snapshotName,
    gifterInstagram: snapshotIg,
    ambassadorSlug: wish.profile.slug,
    paymentIntentId: pi.id,
  }).catch((err) => console.error('[ambassador-webhook] wish-gifted email failed:', err))

  // Ambassador phone for WhatsApp — separate fetch to avoid coupling
  // to the wish embed shape. Mirrors listing.ts ambassador-user lookup.
  const { data: ambassadorUser } = await admin
    .from('users')
    .select('phone_number')
    .eq('id', wish.profile.user_id)
    .maybeSingle<{ phone_number: string | null }>()

  void sendWishGiftedWhatsApp({
    ambassadorPhone: ambassadorUser?.phone_number ?? null,
    ambassadorFirstName: wish.profile.first_name,
    ambassadorSlug: wish.profile.slug,
    isAnonymous,
    wishService: wish.service_name,
    gifterName: snapshotName,
    purchaseDate: new Date(),
    amount: gross,
    currency: wish.currency,
    reference: paymentReference,
  }).catch((err) => console.error('[ambassador-webhook] wish-gifted whatsapp failed:', err))
}

export async function handleWishPaymentFailed(
  admin: Admin,
  event: Stripe.Event,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent
  const meta = pi.metadata ?? {}
  if (meta.feature !== 'ambassador' || meta.kind !== 'wish') {
    return
  }

  const reason = pi.last_payment_error?.message ?? 'payment_intent.payment_failed'
  console.log(`[ambassador-webhook] wish.failed: pi=${pi.id} wish=${meta.wish_id} reason=${reason}`)

  // Intentionally NOT releasing the lock here. The original gifter
  // retains the 10-min window to retry from /pay/{token} without a
  // competing claim. The schema's `revert_expired_wish_locks()` cron
  // releases the wish back to status='available' once expires passes
  // AND no completed/pending payment row exists. UI shows the wish as
  // available immediately (model_wishes_live.effective_status computed
  // the same condition) so the visible behavior matches the schema
  // intent without us doing anything from this handler.
}

export async function handleWishChargeRefunded(
  admin: Admin,
  event: Stripe.Event,
): Promise<void> {
  const charge = event.data.object as Stripe.Charge
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!piId) {
    console.log(`[ambassador-webhook] wish.refunded: charge ${charge.id} has no payment_intent`)
    return
  }

  const { data: payment } = await admin
    .from('model_wish_payments')
    .select('id, gross_amount, currency, status, refund_amount')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle<ExistingWishPaymentRow>()

  if (!payment) {
    // Not a wish payment — could be a listing refund hitting the same
    // endpoint, or legacy. Listing refund handler already covered it.
    console.log(`[ambassador-webhook] wish.refunded: no wish payment for pi ${piId}`)
    return
  }

  const refundDecimal = charge.amount_refunded / 100
  const isFullRefund = charge.amount_refunded >= charge.amount
  const newStatus = isFullRefund ? 'refunded' : 'partial_refund'

  const { error: updateErr } = await admin
    .from('model_wish_payments')
    .update({
      status: newStatus,
      refunded_at: new Date().toISOString(),
      refund_amount: refundDecimal,
    })
    .eq('id', payment.id)
  if (updateErr) throw updateErr

  // Wish row NOT auto-released to status='available' — that's an
  // admin-tool concern (mirrors listing refund behavior). Wall of
  // Love can filter on payment.status='completed' to hide refunded
  // gifts from public display.
}
