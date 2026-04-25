import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  handleListingPaymentSucceeded,
  handleListingPaymentFailed,
  handleListingChargeRefunded,
} from '@/lib/ambassador/webhook-handlers'

/**
 * POST /api/webhooks/ambassador-stripe
 *
 * Stripe webhook for the ambassador feature. Isolated from the legacy
 * /api/webhooks/stripe handler — own signing secret, own handlers,
 * own DB tables. Slice 4 locked decision #3.
 *
 * Flow:
 *   1. Read raw body + stripe-signature header.
 *   2. Verify signature via Stripe.webhooks.constructEvent.
 *      Failure → 401, no DB write. We do NOT replicate the legacy
 *      route's placeholder-bypass (that was a live-payment security
 *      hole in the legacy handler; audit Surprise #7).
 *   3. Outer idempotency — INSERT webhook_events ON CONFLICT (event_id)
 *      DO NOTHING. Conflict = Stripe is retrying an event we already
 *      processed, return 200 immediately. The table's UNIQUE(event_id)
 *      makes this race-free across concurrent retries.
 *   4. Dispatch by event.type. Unknown types are marked 'unhandled'
 *      and return 200 — matches legacy pattern of not failing events
 *      that may belong to a future handler (e.g. wish payments in
 *      Slice 5 land on the same endpoint once they set feature=ambassador).
 *   5. Handler success → mark 'processed' + 200.
 *      Handler throws → mark 'failed' + 500 so Stripe retries.
 *
 * Env: STRIPE_AMBASSADOR_WEBHOOK_SECRET. Registered in lib/env-validation.ts
 * in commit 2 of this slice.
 */

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-06-30.basil' })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 })
  }

  const secret = process.env.STRIPE_AMBASSADOR_WEBHOOK_SECRET
  if (!secret) {
    // Explicit failure is better than silently accepting unsigned traffic.
    console.error('[ambassador-webhook] STRIPE_AMBASSADOR_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'signature_verification_failed'
    console.error('[ambassador-webhook] signature rejected:', msg)
    return NextResponse.json({ error: 'signature_verification_failed' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  // Outer idempotency. onConflict 'event_id' + ignoreDuplicates:true
  // makes duplicate event_ids a silent no-op on the INSERT side; we
  // then check the affected-row count by reading back.
  const { error: logErr } = await admin.from('webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    event_data: event.data.object,
    signature,
    timestamp: new Date(event.created * 1000).toISOString(),
    status: 'received',
  })
  if (logErr) {
    const code = (logErr as { code?: string }).code
    if (code === '23505') {
      // Duplicate event — Stripe is retrying. Safe idempotent return.
      console.log(`[ambassador-webhook] duplicate event ${event.id}, returning 200`)
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[ambassador-webhook] webhook_events insert failed:', logErr)
    return NextResponse.json({ error: 'log_failed' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleListingPaymentSucceeded(admin, event)
        break
      case 'payment_intent.payment_failed':
        await handleListingPaymentFailed(admin, event)
        break
      case 'charge.refunded':
        await handleListingChargeRefunded(admin, event)
        break
      default:
        await markStatus(admin, event.id, 'unhandled')
        return NextResponse.json({ received: true, unhandled: true })
    }
    await markStatus(admin, event.id, 'processed')
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error(`[ambassador-webhook] handler failed for ${event.type} (${event.id}):`, message)
    await markStatus(admin, event.id, 'failed', message)
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }
}

async function markStatus(
  admin: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  status: 'processed' | 'failed' | 'unhandled',
  errorMessage?: string,
): Promise<void> {
  const { error } = await admin
    .from('webhook_events')
    .update({
      status,
      error_message: errorMessage ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
  if (error) {
    // Don't throw — marking-status failure shouldn't mask the handler
    // outcome that's already about to be reported to Stripe.
    console.error(`[ambassador-webhook] markStatus(${status}) failed:`, error)
  }
}
