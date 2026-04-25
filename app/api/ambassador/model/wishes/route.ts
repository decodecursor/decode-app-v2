import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { toWishCardRow, WISH_LIVE_SELECT, type WishLiveRow } from '@/lib/ambassador/wish-shape'

const PRICE_FLOORS: Record<string, number> = { usd: 10, eur: 10, gbp: 10, aed: 50 }
const DEFAULT_PRICE_FLOOR = 10
const TOKEN_MAX_RETRIES = 5

function priceFloorForCurrency(currency: string): number {
  return PRICE_FLOORS[currency.toLowerCase()] ?? DEFAULT_PRICE_FLOOR
}

function generatePaymentLinkToken(): string {
  // 6 random bytes → 8 base64url chars (no padding). Same as listings POST
  // (app/api/ambassador/model/listings/route.ts:85). Hardening item 17
  // tracks the dead lib/ambassador/utils.ts:generatePaymentLinkToken
  // cleanup; until that lands, both routes carry their own copy.
  return randomBytes(6).toString('base64url')
}

/**
 * GET /api/ambassador/model/wishes
 *
 * Returns the caller's wishes from model_wishes_live joined with the
 * (at-most-one) completed payment row, projected into the card shape
 * the Wishlist page expects (see lib/ambassador/wish-shape.ts).
 *
 * Owner-scoped via auth.uid() → model_profiles.user_id. Service-role
 * client bypasses RLS for the join because public RLS would gate the
 * payment-row read on `status='completed' AND profile.is_published`,
 * which is fine for V1 but fragile against future RLS tightening.
 *
 * Mirrors the Slice 3A listings GET pattern.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('model_wishes_live')
    .select(WISH_LIVE_SELECT)
    .eq('model_id', profile.id)
    .order('created_at', { ascending: false })
    .returns<WishLiveRow[]>()

  if (error) {
    console.error('[Ambassador Wishes] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load wishes' }, { status: 500 })
  }

  const wishes = (data ?? []).map(toWishCardRow)
  return NextResponse.json({ wishes })
}

// ---------------------------------------------------------------------------
// POST /api/ambassador/model/wishes — Slice 5A-2
//
// Create a wish for the authed ambassador. Owner-scoped via auth.uid()
// → model_profiles.user_id. Schema fields per spec + mockup (no
// Instagram/avatar — those aren't on model_wishes; locked decision A
// of Slice 5A-2 pre-flight).
//
// Body shape:
//   service_name (string, required, free-form text — no FK)
//   professional_name (string, required)
//   professional_city (string, required)
//   professional_country (string, required)
//   price (number, required, > 0 + >= currency floor)
//
// Currency snapshotted from model_profiles.currency at creation. Wish
// price is locked even if ambassador changes their currency later
// (per spec §8.2 — different from listings which pull live).
//
// payment_link_token generated server-side as 8-char base64url (same
// pattern as listings POST). 23505-on-token retry up to 5 attempts.
//
// gifts_enabled gate: profile must have gifts_enabled=true. The
// /model/wishlist/new server component already redirects on false,
// but the API enforces independently as defense-in-depth (an
// ambassador with the toggle off shouldn't be able to POST directly).
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createServiceRoleClient()

    const { data: profile, error: profileError } = await admin
      .from('model_profiles')
      .select('id, currency, gifts_enabled')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string; currency: string; gifts_enabled: boolean }>()

    if (profileError) {
      console.error('[Ambassador Wishes] Profile lookup failed:', profileError)
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    if (!profile.gifts_enabled) {
      return NextResponse.json(
        { error: 'gifts_disabled', message: 'Enable Beauty Wishlist in Settings before adding wishes.' },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const service_name = typeof body.service_name === 'string' ? body.service_name.trim() : ''
    const professional_name = typeof body.professional_name === 'string' ? body.professional_name.trim() : ''
    const professional_city = typeof body.professional_city === 'string' ? body.professional_city.trim() : ''
    const professional_country = typeof body.professional_country === 'string' ? body.professional_country.trim() : ''

    if (!service_name) return NextResponse.json({ error: 'service_name required' }, { status: 400 })
    if (!professional_name) return NextResponse.json({ error: 'professional_name required' }, { status: 400 })
    if (!professional_city) return NextResponse.json({ error: 'professional_city required' }, { status: 400 })
    if (!professional_country) return NextResponse.json({ error: 'professional_country required' }, { status: 400 })

    const priceRaw = body.price
    const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw)
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'price must be a positive number' }, { status: 400 })
    }
    const floor = priceFloorForCurrency(profile.currency)
    if (price < floor) {
      return NextResponse.json(
        { error: `Price must be at least ${floor} ${profile.currency.toUpperCase()}` },
        { status: 400 },
      )
    }

    // INSERT with token-retry loop for the 23505-on-payment_link_token case.
    // Mirrors the listings POST pattern. model_wishes has UNIQUE only on
    // payment_link_token (and the implicit pkey id), so a 23505 here means
    // a token collision that's safe to retry with a fresh token.
    let inserted: { id: string; payment_link_token: string } | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < TOKEN_MAX_RETRIES; attempt++) {
      const payment_link_token = generatePaymentLinkToken()
      const { data, error } = await admin
        .from('model_wishes')
        .insert({
          model_id: profile.id,
          service_name,
          professional_name,
          professional_city,
          professional_country,
          price,
          currency: profile.currency,
          payment_link_token,
          status: 'available',
        })
        .select('id, payment_link_token')
        .single<{ id: string; payment_link_token: string }>()

      if (!error) {
        inserted = data
        break
      }
      lastError = error
      if (error.code !== '23505') break
    }

    if (!inserted) {
      console.error('[Ambassador Wishes] INSERT failed:', lastError)
      return NextResponse.json({ error: 'Failed to create wish' }, { status: 500 })
    }

    return NextResponse.json({ wish: inserted }, { status: 201 })
  } catch (err) {
    console.error('[Ambassador Wishes] POST threw:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
