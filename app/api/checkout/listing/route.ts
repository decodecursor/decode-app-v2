import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isSupportedCurrency } from '@/lib/ambassador/currencies'
import { toStripeAmount } from '@/lib/ambassador/utils'
import { checkoutLimiter } from '@/lib/ambassador/rate-limit'
import { verifyTurnstile } from '@/lib/ambassador/turnstile'
import { getClientIp } from '@/lib/server/ip'

/**
 * POST /api/checkout/listing
 *
 * Creates a Stripe PaymentIntent for a listing payment. Called from the
 * client-side checkout modal once the professional picks a package.
 *
 * Body: { token: string(8), package_days: 30 | 60 | 90, turnstileToken: string }
 *
 * Gating order (cheap → expensive):
 *   1. Body shape (token + package_days format) — synchronous, no I/O
 *   2. Upstash rate-limit by IP (checkoutLimiter: 3/10min) — single Redis call
 *   3. Turnstile verification — network call to Cloudflare siteverify
 *   4. DB listing lookup — service-role Supabase
 *   5. Stripe PaymentIntent create
 *
 * Rate-limit before Turnstile so a flooder can't burn through our
 * Cloudflare siteverify budget. Turnstile verify is fail-open on empty
 * token by design (widget didn't load — real users shouldn't be
 * blocked by Cloudflare script failures) per lib/ambassador/turnstile.
 *
 * The token + package_days are the only client inputs we trust. Amount
 * is derived server-side from model_listings.price_{days} — NEVER from
 * anything the client sends (spec-locked).
 *
 * Idempotency: the Stripe idempotency key is
 * `listing_${listing.id}_${package_days}` (24h retention at Stripe).
 * Double-taps + retries return the same PI; the webhook's own dedup
 * via model_listing_payments.stripe_event_id covers the DB side.
 *
 * RLS note: we read model_listings via service-role because the public
 * RLS policy on that table only exposes rows with
 * status IN ('active', 'free_trial'). pending_payment rows (first-time
 * checkout) and expired rows (renewal) would be invisible to anon.
 *
 * Direct Stripe client construction (not the lib/stripe.ts singleton)
 * per Slice 4 locked decision #3 — keeps the legacy tiered-fee +
 * legacy webhook-secret paths out of the ambassador surface entirely.
 */

const VALID_PACKAGE_DAYS = new Set([30, 60, 90])

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-06-30.basil',
  })
}

type CheckoutRequest = {
  token?: unknown
  package_days?: unknown
  turnstileToken?: unknown
}

type ListingRow = {
  id: string
  model_id: string
  price_30: number | null
  price_60: number | null
  price_90: number | null
  currency: string
  status: 'free_trial' | 'pending_payment' | 'active' | 'expired'
  paid_until: string | null
}

export async function POST(request: NextRequest) {
  let body: CheckoutRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { token, package_days, turnstileToken } = body
  if (typeof token !== 'string' || token.length !== 8) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }
  if (typeof package_days !== 'number' || !VALID_PACKAGE_DAYS.has(package_days)) {
    return NextResponse.json({ error: 'invalid_package' }, { status: 400 })
  }

  // Rate-limit BEFORE Turnstile verify so flooders can't drain the
  // Cloudflare siteverify budget. 3 attempts per IP per 10 minutes —
  // covers retry-after-decline but blocks bot enumeration.
  const ip = getClientIp(request)
  const { success: rlOk, reset } = await checkoutLimiter.limit(ip)
  if (!rlOk) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts. Please wait a few minutes before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  // Turnstile — fail-open on empty token per helper (widget didn't load).
  // On genuine failure (Cloudflare says "not a human"), reject with 403.
  const turnstileStr = typeof turnstileToken === 'string' ? turnstileToken : ''
  const isHuman = await verifyTurnstile(turnstileStr)
  if (!isHuman) {
    return NextResponse.json(
      { error: 'turnstile_failed', message: 'Verification failed. Please reload the page and try again.' },
      { status: 403 },
    )
  }

  const admin = createServiceRoleClient()

  const { data: listing, error: lookupErr } = await admin
    .from('model_listings')
    .select('id, model_id, price_30, price_60, price_90, currency, status, paid_until')
    .eq('payment_link_token', token)
    .maybeSingle<ListingRow>()

  if (lookupErr) {
    console.error('[Checkout] Listing lookup failed:', lookupErr)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!listing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Already-paid guard: active listing with a live paid_until is a
  // second-payer race. UI (/pay/[token] server component) catches this
  // before the modal opens; this is the server-side backstop.
  // Audit locked decision #2 — surface expired-link page on this signal.
  if (
    listing.status === 'active' &&
    listing.paid_until &&
    new Date(listing.paid_until).getTime() > Date.now()
  ) {
    return NextResponse.json({ error: 'already_paid' }, { status: 409 })
  }

  // Derive amount server-side from the per-listing price the ambassador set.
  const priceField: keyof Pick<ListingRow, 'price_30' | 'price_60' | 'price_90'> =
    package_days === 30 ? 'price_30' : package_days === 60 ? 'price_60' : 'price_90'
  const rawPrice = listing[priceField]
  if (rawPrice == null) {
    return NextResponse.json({ error: 'price_not_set' }, { status: 409 })
  }
  const amount = Number(rawPrice)
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('[Checkout] Invalid price on listing row', { listing_id: listing.id, package_days, rawPrice })
    return NextResponse.json({ error: 'price_invalid' }, { status: 500 })
  }

  const currencyLower = listing.currency.toLowerCase()
  if (!isSupportedCurrency(currencyLower)) {
    console.error('[Checkout] Unsupported currency on listing row', { listing_id: listing.id, currency: listing.currency })
    return NextResponse.json({ error: 'currency_unsupported' }, { status: 500 })
  }
  const amountMinorUnits = toStripeAmount(amount, currencyLower)

  const stripe = getStripe()
  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountMinorUnits,
        currency: currencyLower,
        automatic_payment_methods: { enabled: true },
        description: `DECODE listing — ${package_days}-day package`,
        metadata: {
          feature: 'ambassador',
          kind: 'listing',
          listing_id: listing.id,
          model_id: listing.model_id,
          package_days: String(package_days),
        },
      },
      {
        idempotencyKey: `listing_${listing.id}_${package_days}`,
      },
    )

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    })
  } catch (err) {
    // Widen the error response with Stripe's structured fields so the
    // client modal can surface the real cause (e.g. "No valid payment
    // method types for this Payment Intent") instead of a generic code.
    // Stripe's `raw.message` is the user-safe API error string; `type`
    // and `code` are non-secret diagnostic slugs. Stack traces + env
    // values never leave the server.
    const stripeErr = err as { type?: string; code?: string; message?: string; raw?: { message?: string } } | undefined
    const safeMessage = stripeErr?.raw?.message ?? stripeErr?.message ?? 'Unknown error'
    console.error('[Checkout] PaymentIntent create failed:', safeMessage, {
      type: stripeErr?.type,
      code: stripeErr?.code,
    })
    return NextResponse.json(
      {
        error: 'pi_create_failed',
        stripe_type: stripeErr?.type ?? null,
        stripe_code: stripeErr?.code ?? null,
        message: safeMessage,
      },
      { status: 500 },
    )
  }
}
