import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { extractCoverObjectPath } from '@/lib/ambassador/storage'
import { toCardRow, LIVE_VIEW_SELECT, type LiveViewRow } from '@/lib/ambassador/listing-shape'

/**
 * DELETE /api/ambassador/model/listings/[id]
 *
 * Hard delete, owner-only (via model_profiles.user_id = auth.uid()).
 *
 * Per listings_final_UI_Spec §7.8, the backend re-validates — it does
 * NOT trust the client's earlier decision: if the listing's
 * effective_status is 'active' (paid, not yet expired), return 409
 * with a fresh listing payload so the client can update the row in
 * place without a second fetch.
 *
 * Trial / pending / expired → DELETE returns 200.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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

  const { data: liveRow, error: readError } = await admin
    .from('model_listings_live')
    .select(LIVE_VIEW_SELECT)
    .eq('id', id)
    .eq('model_id', profile.id)
    .maybeSingle<LiveViewRow>()

  if (readError) {
    console.error('[Ambassador Listings] DELETE read failed:', readError)
    return NextResponse.json({ error: 'Failed to load listing' }, { status: 500 })
  }

  if (!liveRow) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const fresh = toCardRow(liveRow)

  if (!fresh.removable) {
    return NextResponse.json(
      { error: 'listing_now_active', listing: fresh },
      { status: 409 },
    )
  }

  const { error: deleteError } = await admin
    .from('model_listings')
    .delete()
    .eq('id', id)
    .eq('model_id', profile.id)

  if (deleteError) {
    console.error('[Ambassador Listings] DELETE failed:', deleteError)
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// PATCH /api/ambassador/model/listings/[id] — Slice 3C Phase 1
//
// Edit an existing listing. Owner-only (model_profiles.user_id = auth.uid()).
//
// Editable (per Slice 3C locked decision #2 + live-pricing lock):
//   - category_id / category_custom (XOR — exactly one)
//   - media_type + media URLs (XOR — 'photos' or 'video', consistent urls)
//   - price_30 / price_60 / price_90 — only on non-live rows. Live paid
//     listings (status='active' && !is_free_trial) lock pricing; the
//     unknown-key gate rejects price_* in body. Trial pricing stays
//     writable per Slice 4D `aaf9977`.
//
// Rejected (non-editable fields; 400 if present in body):
//   - professional_id (Principle A — IG handle is authoritative identity)
//   - is_free_trial (locked — conversions go via Stripe webhook in Slice 4)
//   - status (system-controlled via webhook + view auto-flip + delete)
//   - currency (Phase 2 lock)
//   - payment_link_token, id, model_id, created_at, updated_at,
//     free_trial_ends_at, paid_until, expiry_notification_sent_at
//
// Pricing rules come from the existing row's is_free_trial (authoritative).
// If the row is a trial, all three prices must be null in the body. If paid,
// all three required + currency floor + price_30 < price_60 < price_90.
// ---------------------------------------------------------------------------

// Editable-set is row-state-aware. Live paid listings (status='active'
// + !is_free_trial) lock pricing — only category + media may change.
// Trial listings keep pricing writable per Slice 4D `aaf9977`
// relaxation (Send Payment Link page persists ambassador-entered
// prices). Other states (pending_payment, expired) keep the full set.
const FULL_EDITABLE_KEYS = new Set([
  'category_id', 'category_custom',
  'media_type', 'photo_url_1', 'photo_url_2', 'photo_url_3', 'video_url', 'video_thumbnail_url',
  'price_30', 'price_60', 'price_90',
])
const LIVE_EDITABLE_KEYS = new Set([
  'category_id', 'category_custom',
  'media_type', 'photo_url_1', 'photo_url_2', 'photo_url_3', 'video_url', 'video_thumbnail_url',
])
function getEditableKeys(row: { is_free_trial: boolean; status: string }): Set<string> {
  if (row.status === 'active' && !row.is_free_trial) return LIVE_EDITABLE_KEYS
  return FULL_EDITABLE_KEYS
}

const PRICE_FLOORS: Record<string, number> = { usd: 10, eur: 10, gbp: 10, aed: 50 }
const DEFAULT_PRICE_FLOOR = 10
const VALID_MEDIA_TYPES = ['video', 'photos'] as const
type MediaType = typeof VALID_MEDIA_TYPES[number]

function priceFloorForCurrency(currency: string): number {
  return PRICE_FLOORS[currency.toLowerCase()] ?? DEFAULT_PRICE_FLOOR
}

function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

function ownsModelMediaUrl(url: string, userId: string): boolean {
  const path = extractCoverObjectPath(url)
  return !!path && path.split('/')[0] === userId
}

function coercePrice(v: unknown): number | null {
  if (v === null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : NaN as unknown as number
  }
  return NaN as unknown as number
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createServiceRoleClient()

    // Owner profile lookup (match Principle E pattern from DELETE above + Phase 4 POST).
    const { data: profile } = await admin
      .from('model_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ---- Owner + existence check; also pulls is_free_trial + currency ----
    // is_free_trial drives the pricing-rule branch; currency drives the floor.
    const { data: existing, error: existingError } = await admin
      .from('model_listings')
      .select('id, is_free_trial, currency, status')
      .eq('id', id)
      .eq('model_id', profile.id)
      .maybeSingle<{ id: string; is_free_trial: boolean; currency: string; status: string }>()

    if (existingError) {
      console.error('[Ambassador Listings] PATCH owner/existence lookup failed:', existingError)
      return NextResponse.json({ error: 'Failed to load listing' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // ---- Parse + whitelist body ----
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const editableKeys = getEditableKeys(existing)
    for (const k of Object.keys(body)) {
      if (!editableKeys.has(k)) {
        return NextResponse.json({ error: `Field not editable: ${k}` }, { status: 400 })
      }
    }

    // ---- Category XOR ----
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

    // ---- Media type + URL consistency ----
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
      // fail silently. When present, validate ownership the same way
      // as video_url.
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
      // photo_url_* must be null on the video path (matches CHECK constraint).
      if (body.photo_url_1 != null || body.photo_url_2 != null || body.photo_url_3 != null) {
        return NextResponse.json(
          { error: 'photo_url_* must be null when media_type=video' },
          { status: 400 },
        )
      }
    } else {
      // photos path — photo_url_1 required, 2/3 optional. All provided URLs
      // must be caller-owned.
      if (typeof body.photo_url_1 !== 'string' || !body.photo_url_1.trim()) {
        return NextResponse.json({ error: 'photo_url_1 required when media_type=photos' }, { status: 400 })
      }
      const urls: (string | null)[] = [
        body.photo_url_1 as string,
        typeof body.photo_url_2 === 'string' && body.photo_url_2.trim() ? body.photo_url_2 : null,
        typeof body.photo_url_3 === 'string' && body.photo_url_3.trim() ? body.photo_url_3 : null,
      ]
      for (const url of urls) {
        if (url && !ownsModelMediaUrl(url.trim(), user.id)) {
          return NextResponse.json(
            { error: 'every photo_url must point to caller-owned model-media storage' },
            { status: 400 },
          )
        }
      }
      photo_url_1 = urls[0]!.trim()
      photo_url_2 = urls[1]?.trim() ?? null
      photo_url_3 = urls[2]?.trim() ?? null
      if (body.video_url != null) {
        return NextResponse.json(
          { error: 'video_url must be null when media_type=photos' },
          { status: 400 },
        )
      }
      if (body.video_thumbnail_url != null) {
        return NextResponse.json(
          { error: 'video_thumbnail_url must be null when media_type=photos' },
          { status: 400 },
        )
      }
    }

    // ---- Pricing — rules driven by EXISTING row's is_free_trial ----
    //
    // Slice 4D commit 3 relaxation: trial listings now accept price
    // writes so the Send Payment Link page (S2 state) can persist
    // ambassador-entered prices before the professional pays. The
    // is_free_trial flag itself remains immutable via this route
    // (EDITABLE_KEYS gates the body; flag flip is webhook-owned per
    // Slice 4 locked decision #5). Two valid trial shapes:
    //   (a) all three prices null — pre-conversion "media-only" edit
    //   (b) all three prices set + valid — ambassador has set pricing
    //       on the send-link page, ready to share with professional
    // Mixed/partial prices on a trial listing fall into the paid
    // validation branch below and reject with the same "all three
    // required" error a paid listing would.
    // Pricing branch only runs when pricing is in the editable set
    // (i.e. NOT a live paid listing — those lock pricing per the
    // getEditableKeys gate above). On live listings price_* keys never
    // reach the body (rejected at the unknown-key gate) and the
    // existing prices are preserved by omitting them from UPDATE.
    let price_30: number | null = null
    let price_60: number | null = null
    let price_90: number | null = null
    const pricingEditable = editableKeys.has('price_30')

    if (pricingEditable) {
      const trialKeepsPricesNull = existing.is_free_trial
        && body.price_30 == null
        && body.price_60 == null
        && body.price_90 == null

      if (trialKeepsPricesNull) {
        // Leave prices null. Ambassador editing other fields (media,
        // category) on an unpriced trial listing.
      } else {
        // Paid listing OR trial-with-prices — same validation:
        // all three required + currency floor + strict ordering.
        const p30 = coercePrice(body.price_30)
        const p60 = coercePrice(body.price_60)
        const p90 = coercePrice(body.price_90)
        if (!Number.isFinite(p30) || !Number.isFinite(p60) || !Number.isFinite(p90)
            || p30 === null || p60 === null || p90 === null) {
          return NextResponse.json(
            { error: 'price_30, price_60, price_90 required when prices are provided' },
            { status: 400 },
          )
        }
        const floor = priceFloorForCurrency(existing.currency)
        if (p30 < floor || p60 < floor || p90 < floor) {
          return NextResponse.json(
            { error: `Each price must be at least ${floor} ${existing.currency.toUpperCase()}` },
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
      }
    }

    // ---- UPDATE with double-check owner in WHERE ----
    // Pricing fields are conditionally included — omitted on live
    // paid listings so the existing values stay intact.
    const updatePayload: Record<string, unknown> = {
      category_id,
      category_custom,
      media_type,
      video_url,
      video_thumbnail_url,
      photo_url_1,
      photo_url_2,
      photo_url_3,
    }
    if (pricingEditable) {
      updatePayload.price_30 = price_30
      updatePayload.price_60 = price_60
      updatePayload.price_90 = price_90
    }

    const { data: updated, error: updateError } = await admin
      .from('model_listings')
      .update(updatePayload)
      .eq('id', id)
      .eq('model_id', profile.id)
      .select('id, status, is_free_trial')
      .single<{ id: string; status: string; is_free_trial: boolean }>()

    if (updateError || !updated) {
      console.error('[Ambassador Listings] PATCH UPDATE failed:', updateError)
      return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
    }

    return NextResponse.json({ listing: updated }, { status: 200 })
  } catch (err) {
    console.error('[Ambassador Listings] PATCH threw:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
