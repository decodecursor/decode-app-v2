import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { extractCoverObjectPath } from '@/lib/ambassador/storage'
import { toCardRow, LIVE_VIEW_SELECT, type LiveViewRow } from '@/lib/ambassador/listing-shape'

/**
 * GET /api/ambassador/model/listings
 *
 * Returns the caller's listings from the model_listings_live view,
 * joined with professional + category, ordered by created_at DESC.
 * Projected into the card shape the Listings page expects (see
 * lib/ambassador/listing-shape.ts). PATCH will live in this file later
 * (Slice 3C edit flow).
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
    .from('model_listings_live')
    .select(LIVE_VIEW_SELECT)
    .eq('model_id', profile.id)
    .order('created_at', { ascending: false })
    .returns<LiveViewRow[]>()

  if (error) {
    console.error('[Ambassador Listings] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load listings' }, { status: 500 })
  }

  const listings = (data ?? []).map(toCardRow)
  return NextResponse.json({ listings })
}

// ---------------------------------------------------------------------------
// POST /api/ambassador/model/listings — Slice 3B Phase 4
//
// Create a listing for the authed ambassador. Two paths:
//   - Free trial (is_free_trial=true):
//       status='free_trial', free_trial_ends_at = now + 30 days, prices NULL.
//   - Paid (is_free_trial=false):
//       status='pending_payment', free_trial_ends_at NULL, all three prices
//       required and validated against currency floors + ordering.
//
// Currency is snapshotted from model_profiles.currency (locked at signup per
// Phase 2 #PHASE_2 / Phase 5 Table 1). Client cannot override.
//
// payment_link_token is generated server-side as 8-char base64url. The
// length=8 CHECK constraint is satisfied; the UNIQUE constraint catches the
// vanishingly-rare collision (62^8 ≈ 2e14), handled by a short retry loop.
//
// Response shape matches GET's card projection so the client sees a
// consistent shape regardless of how the listing entered its state.
// ---------------------------------------------------------------------------

const PRICE_FLOORS: Record<string, number> = { usd: 10, eur: 10, gbp: 10, aed: 50 }
const DEFAULT_PRICE_FLOOR = 10
const TRIAL_DAYS = 30
const TOKEN_MAX_RETRIES = 5
const VALID_MEDIA_TYPES = ['video', 'photos'] as const
type MediaType = typeof VALID_MEDIA_TYPES[number]

function priceFloorForCurrency(currency: string): number {
  return PRICE_FLOORS[currency.toLowerCase()] ?? DEFAULT_PRICE_FLOOR
}

function generatePaymentLinkToken(): string {
  // 6 random bytes → 8 base64url chars (no padding). Satisfies the
  // length=8 CHECK constraint on model_listings.payment_link_token.
  return randomBytes(6).toString('base64url')
}

function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

function ownsModelMediaUrl(url: string, userId: string): boolean {
  const path = extractCoverObjectPath(url)
  return !!path && path.split('/')[0] === userId
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createServiceRoleClient()

    // ---- Load caller's model_profile (model_id + currency snapshot) ----
    const { data: profile, error: profileError } = await admin
      .from('model_profiles')
      .select('id, currency')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string; currency: string }>()

    if (profileError) {
      console.error('[Ambassador Listings] Profile lookup failed:', profileError)
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ---- Parse body ----
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    // ---- Professional FK ----
    if (!isValidUuid(body.professional_id)) {
      return NextResponse.json({ error: 'professional_id required (uuid)' }, { status: 400 })
    }
    const professional_id = body.professional_id

    const { data: professional, error: profError } = await admin
      .from('model_professionals')
      .select('id')
      .eq('id', professional_id)
      .maybeSingle()
    if (profError) {
      console.error('[Ambassador Listings] Professional lookup failed:', profError)
      return NextResponse.json({ error: 'Failed to verify professional' }, { status: 500 })
    }
    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 400 })
    }

    // ---- Category XOR (spec + live CHECK constraint) ----
    const hasCategoryId = body.category_id != null && body.category_id !== ''
    const hasCategoryCustom = typeof body.category_custom === 'string' && body.category_custom.trim().length > 0
    if (hasCategoryId === hasCategoryCustom) {
      return NextResponse.json(
        { error: 'Exactly one of category_id or category_custom is required' },
        { status: 400 },
      )
    }
    let category_id: string | null = null
    let category_custom: string | null = null
    if (hasCategoryId) {
      if (!isValidUuid(body.category_id)) {
        return NextResponse.json({ error: 'category_id must be a valid uuid' }, { status: 400 })
      }
      category_id = body.category_id as string
    } else {
      category_custom = (body.category_custom as string).trim()
    }

    // ---- Media: XOR between video and photos; urls must be caller-owned ----
    if (typeof body.media_type !== 'string' || !(VALID_MEDIA_TYPES as readonly string[]).includes(body.media_type)) {
      return NextResponse.json({ error: "media_type must be 'video' or 'photos'" }, { status: 400 })
    }
    const media_type = body.media_type as MediaType

    let video_url: string | null = null
    let video_thumbnail_url: string | null = null
    let photo_url_1: string | null = null
    let photo_url_2: string | null = null
    let photo_url_3: string | null = null

    if (media_type === 'video') {
      if (typeof body.video_url !== 'string' || !body.video_url.trim()) {
        return NextResponse.json({ error: 'video_url required when media_type=video' }, { status: 400 })
      }
      const v = body.video_url.trim()
      if (!ownsModelMediaUrl(v, user.id)) {
        return NextResponse.json(
          { error: 'video_url must point to caller-owned model-media storage' },
          { status: 400 },
        )
      }
      video_url = v
      // video_thumbnail_url is optional — client-side extraction may
      // fail silently, falling back to null. The orb's null-fallback
      // render handles that case. When present, validate ownership
      // the same way as video_url (same bucket, same RLS scope).
      if (body.video_thumbnail_url != null) {
        if (typeof body.video_thumbnail_url !== 'string' || !body.video_thumbnail_url.trim()) {
          return NextResponse.json({ error: 'video_thumbnail_url must be a string when provided' }, { status: 400 })
        }
        const t = body.video_thumbnail_url.trim()
        if (!ownsModelMediaUrl(t, user.id)) {
          return NextResponse.json(
            { error: 'video_thumbnail_url must point to caller-owned model-media storage' },
            { status: 400 },
          )
        }
        video_thumbnail_url = t
      }
    } else {
      const photos = Array.isArray(body.photo_urls) ? body.photo_urls : null
      if (!photos || photos.length < 1 || photos.length > 3) {
        return NextResponse.json(
          { error: 'photo_urls must be an array of 1-3 urls when media_type=photos' },
          { status: 400 },
        )
      }
      for (const url of photos) {
        if (typeof url !== 'string' || !url.trim() || !ownsModelMediaUrl(url.trim(), user.id)) {
          return NextResponse.json(
            { error: 'every photo_url must point to caller-owned model-media storage' },
            { status: 400 },
          )
        }
      }
      photo_url_1 = photos[0]
      photo_url_2 = photos[1] ?? null
      photo_url_3 = photos[2] ?? null
    }

    // ---- Free trial vs paid path ----
    const is_free_trial = body.is_free_trial === true
    let price_30: number | null = null
    let price_60: number | null = null
    let price_90: number | null = null
    let free_trial_ends_at: string | null = null
    let status: 'free_trial' | 'pending_payment'

    if (is_free_trial) {
      if (body.price_30 != null || body.price_60 != null || body.price_90 != null) {
        return NextResponse.json(
          { error: 'Prices must be omitted when is_free_trial=true' },
          { status: 400 },
        )
      }
      status = 'free_trial'
      free_trial_ends_at = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    } else {
      const p30 = typeof body.price_30 === 'number' ? body.price_30 : parseFloat(String(body.price_30))
      const p60 = typeof body.price_60 === 'number' ? body.price_60 : parseFloat(String(body.price_60))
      const p90 = typeof body.price_90 === 'number' ? body.price_90 : parseFloat(String(body.price_90))
      if (!Number.isFinite(p30) || !Number.isFinite(p60) || !Number.isFinite(p90)) {
        return NextResponse.json(
          { error: 'price_30, price_60, price_90 required when is_free_trial=false' },
          { status: 400 },
        )
      }
      const floor = priceFloorForCurrency(profile.currency)
      if (p30 < floor || p60 < floor || p90 < floor) {
        return NextResponse.json(
          { error: `Each price must be at least ${floor} ${profile.currency.toUpperCase()}` },
          { status: 400 },
        )
      }
      if (!(p30 < p60 && p60 < p90)) {
        return NextResponse.json(
          { error: 'Prices must satisfy price_30 < price_60 < price_90' },
          { status: 400 },
        )
      }
      price_30 = p30
      price_60 = p60
      price_90 = p90
      status = 'pending_payment'
    }

    // ---- INSERT with token-retry loop for the 23505-on-token case ----
    let inserted: { id: string; status: string; is_free_trial: boolean } | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < TOKEN_MAX_RETRIES; attempt++) {
      const payment_link_token = generatePaymentLinkToken()
      const { data, error } = await admin
        .from('model_listings')
        .insert({
          model_id: profile.id,
          professional_id,
          category_id,
          category_custom,
          media_type,
          video_url,
          video_thumbnail_url,
          photo_url_1,
          photo_url_2,
          photo_url_3,
          price_30,
          price_60,
          price_90,
          currency: profile.currency,
          payment_link_token,
          status,
          is_free_trial,
          free_trial_ends_at,
        })
        .select('id, status, is_free_trial')
        .single<{ id: string; status: string; is_free_trial: boolean }>()

      if (!error) {
        inserted = data
        break
      }
      lastError = error
      // Unique-violation on payment_link_token — generate a new token and retry.
      // Any other error (including FK violations) aborts immediately.
      if (error.code !== '23505') break
      // If the conflict is on a non-token unique constraint (future-proofing),
      // retrying would never succeed. model_listings has a single UNIQUE
      // (payment_link_token) today, so the retry is safe.
    }

    if (!inserted) {
      console.error('[Ambassador Listings] INSERT failed:', lastError)
      return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
    }

    return NextResponse.json({ listing: inserted }, { status: 201 })
  } catch (err) {
    console.error('[Ambassador Listings] POST threw:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
