import { NextRequest } from 'next/server'

/**
 * POST /api/webhooks/ambassador-stripe
 *
 * Stripe webhook endpoint for DECODE ambassador feature.
 * Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
 *
 * Isolation: only processes events with metadata.feature === 'ambassador'.
 * Uses STRIPE_AMBASSADOR_WEBHOOK_SECRET (separate from legacy webhook).
 *
 * TODO: Slice 2 — wire up Stripe signature verification + event handlers
 */
export async function POST(request: NextRequest) {
  // Stub: returns 200 so Stripe doesn't retry during setup
  // Full implementation in Slice 2 (listings) and Slice 3 (wishes)
  return new Response('OK', { status: 200 })
}
