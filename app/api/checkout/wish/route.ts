import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isSupportedCurrency } from '@/lib/ambassador/currencies'
import { toStripeAmount } from '@/lib/ambassador/utils'
import { checkoutLimiter } from '@/lib/ambassador/rate-limit'
import { verifyTurnstile } from '@/lib/ambassador/turnstile'
import { getClientIp } from '@/lib/server/ip'

/**
 * POST /api/checkout/wish
 *
 * Creates a Stripe PaymentIntent for gifting a wish. Race-to-claim
 * model: the first gifter to call this endpoint locks the wish for
 * 10 minutes (atomic UPDATE via the `claim_wish_for_payment` RPC),
 * concurrent gifters get 409 → `/wish/taken`. Failed payments leave
 * the lock in place; the `revert_expired_wish_locks` cron releases
 * stale locks after 10 min so the wish becomes claimable again.
 *
 * Body: {
 *   token: string(8)            — wish.payment_link_token (base64url)
 *   gifter_name: string         — required unless gifter_is_anonymous
 *   gifter_instagram?: string   — optional handle (no leading @)
 *   gifter_is_anonymous: boolean
 *   turnstileToken: string
 * }
 *
 * Gating order (cheap → expensive) — matches /api/checkout/listing:
 *   1. Body shape — synchronous, no I/O
 *   2. Upstash rate-limit by IP (checkoutLimiter: 3/10min)
 *   3. Turnstile verify (Cloudflare siteverify)
 *   4. DB wish lookup by payment_link_token — service-role
 *   5. Atomic claim via claim_wish_for_payment RPC
 *   6. Write gifter_* identity onto the (now claimed) wish row
 *   7. Stripe PaymentIntent create
 *
 * Race semantics: the RPC's `WHERE id=$1 AND status='available'` is
 * race-free at the DB level. Two concurrent claims for the same wish:
 * one gets `claimed: true`, the other gets `claimed: false`. The
 * losing client receives 409 + a redirect target so the UI can
 * navigate to /wish/taken.
 *
 * Why two-step (RPC then UPDATE)? The RPC predates this slice and is
 * intentionally narrow (just the lock). Writing gifter identity in a
 * separate UPDATE is safe because:
 *  (a) by the time we reach the UPDATE, we hold the 10-min lock
 *  (b) no other writer can clobber gifter_* during the lock window
 *  (c) keeping the RPC narrow avoids re-deploying it for every
 *      schema-touching change.
 *
 * Idempotency: Stripe idempotency key is `wish_${wish.id}_${expires_ms}`.
 * The expires timestamp is unique per claim (NOW + 10 min), so a
 * post-refund re-claim by a future gifter gets a fresh PI rather than
 * reusing a stale one from Stripe's 24h idempotency window.
 *
 * Money math: amount derived server-side from model_wishes.price —
 * NEVER from anything the client sends (defense-in-depth even though
 * the wish row is the same one the client just resolved by token).
 *
 * Direct Stripe client construction per Slice 4 locked decision #3.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8}$/
const LOCK_MINUTES = 10

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-06-30.basil',
  })
}

type WishCheckoutRequest = {
  token?: unknown
  gifter_name?: unknown
  gifter_instagram?: unknown
  gifter_is_anonymous?: unknown
  turnstileToken?: unknown
}

type WishRow = {
  id: string
  model_id: string
  price: number | string
  currency: string
  status: 'available' | 'taken'
  // Profile join is consumed only to enrich the 409 race-loser response
  // with ambassador { slug, first_name } per spec §2.1, so the client
  // can build the /wish/taken redirect URL even if it didn't have the
  // ambassador in props. WishCheckoutClient currently has it in props
  // (loaded server-side at /pay/[token] dispatch time), so this is
  // defense-in-depth for future callers that POST directly.
  profile: {
    slug: string
    first_name: string
  } | null
}

type ClaimResult =
  | { claimed: false }
  | { claimed: true; wish: WishRow & { payment_attempt_expires_at: string } }

export async function POST(request: NextRequest) {
  let body: WishCheckoutRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { token, gifter_name, gifter_instagram, gifter_is_anonymous, turnstileToken } = body

  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }
  if (typeof gifter_is_anonymous !== 'boolean') {
    return NextResponse.json({ error: 'invalid_anonymous_flag' }, { status: 400 })
  }
  // Normalize gifter identity. Anonymous flow: name/IG dropped server-
  // side regardless of what the client sent (defense-in-depth — UI
  // grays the inputs when anonymous toggled, but the API enforces).
  const normalizedName = gifter_is_anonymous
    ? null
    : (typeof gifter_name === 'string' ? gifter_name.trim() : '')
  const normalizedIg = gifter_is_anonymous
    ? null
    : (typeof gifter_instagram === 'string'
        ? gifter_instagram.trim().replace(/^@/, '') || null
        : null)
  if (!gifter_is_anonymous && (!normalizedName || normalizedName.length < 1)) {
    return NextResponse.json({ error: 'gifter_name_required' }, { status: 400 })
  }

  // Rate-limit BEFORE Turnstile verify — same precedence as listings.
  const ip = getClientIp(request)
  const { success: rlOk, reset } = await checkoutLimiter.limit(ip)
  if (!rlOk) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts. Please wait a few minutes before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  const turnstileStr = typeof turnstileToken === 'string' ? turnstileToken : ''
  const isHuman = await verifyTurnstile(turnstileStr)
  if (!isHuman) {
    return NextResponse.json(
      { error: 'turnstile_failed', message: 'Verification failed. Please reload the page and try again.' },
      { status: 403 },
    )
  }

  const admin = createServiceRoleClient()

  const { data: wish, error: lookupErr } = await admin
    .from('model_wishes')
    .select(`
      id, model_id, price, currency, status,
      profile:model_profiles!model_wishes_model_id_fkey ( slug, first_name )
    `)
    .eq('payment_link_token', token)
    .maybeSingle<WishRow>()

  if (lookupErr) {
    console.error('[Wish Checkout] Wish lookup failed:', lookupErr)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!wish) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Atomic claim via the schema-side RPC (claim_wish_for_payment).
  // The RPC's WHERE id=$1 AND status='available' is race-free; if
  // someone else already locked the wish, claimed=false and we 409.
  // Note: the RPC checks status='available' on the BASE table, not
  // the view — so a stale 'taken' lock that hasn't been swept by
  // revert_expired_wish_locks() will still 409 even if its expires
  // has passed. That's the intended safety: a new gifter doesn't
  // claim a wish whose original gifter might still complete payment.
  const { data: claim, error: claimErr } = await admin.rpc('claim_wish_for_payment', {
    p_wish_id: wish.id,
    p_lock_minutes: LOCK_MINUTES,
  })

  if (claimErr) {
    console.error('[Wish Checkout] claim RPC failed:', claimErr)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
  const result = claim as ClaimResult | null
  if (!result || !result.claimed) {
    // Race lost — include ambassador { slug, first_name } per spec §2.1
    // so the client can build the /wish/taken redirect URL even when
    // it didn't preload the ambassador info via dispatch props.
    return NextResponse.json(
      {
        error: 'wish_already_taken',
        redirect: '/wish/taken',
        ambassador: wish.profile
          ? { slug: wish.profile.slug, first_name: wish.profile.first_name }
          : null,
      },
      { status: 409 },
    )
  }

  const claimedWish = result.wish
  const expiresMs = new Date(claimedWish.payment_attempt_expires_at).getTime()

  // Write gifter identity. Safe because we hold the 10-min lock — no
  // other writer can land on this row until the lock expires (or until
  // the webhook completes and writes the payment row).
  const { error: gifterUpdateErr } = await admin
    .from('model_wishes')
    .update({
      gifter_name: normalizedName,
      gifter_instagram: normalizedIg,
      gifter_is_anonymous,
    })
    .eq('id', wish.id)
  if (gifterUpdateErr) {
    console.error('[Wish Checkout] Gifter identity write failed:', gifterUpdateErr)
    return NextResponse.json({ error: 'gifter_write_failed' }, { status: 500 })
  }

  // Server-side amount derivation — never trust the client.
  const gross = typeof claimedWish.price === 'string' ? Number(claimedWish.price) : claimedWish.price
  if (!Number.isFinite(gross) || gross <= 0) {
    console.error('[Wish Checkout] Invalid wish price', { wish_id: wish.id, price: claimedWish.price })
    return NextResponse.json({ error: 'price_invalid' }, { status: 500 })
  }
  const currencyLower = claimedWish.currency.toLowerCase()
  if (!isSupportedCurrency(currencyLower)) {
    console.error('[Wish Checkout] Unsupported currency on wish', { wish_id: wish.id, currency: claimedWish.currency })
    return NextResponse.json({ error: 'currency_unsupported' }, { status: 500 })
  }
  const amountMinorUnits = toStripeAmount(gross, currencyLower)

  const stripe = getStripe()
  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountMinorUnits,
        currency: currencyLower,
        automatic_payment_methods: { enabled: true },
        description: `DECODE wish — gift`,
        metadata: {
          feature: 'ambassador',
          kind: 'wish',
          wish_id: wish.id,
          model_id: wish.model_id,
        },
      },
      {
        // Lock-timestamp suffix ensures a post-refund re-claim by a
        // future gifter gets a fresh PI rather than reusing a stale
        // one from Stripe's 24h idempotency window.
        idempotencyKey: `wish_${wish.id}_${expiresMs}`,
      },
    )

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    })
  } catch (err) {
    const stripeErr = err as { type?: string; code?: string; message?: string; raw?: { message?: string } } | undefined
    const safeMessage = stripeErr?.raw?.message ?? stripeErr?.message ?? 'Unknown error'
    console.error('[Wish Checkout] PaymentIntent create failed:', safeMessage, {
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
