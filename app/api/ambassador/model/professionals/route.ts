import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  isValidInstagramHandle,
  isValidE164,
  isValidGooglePlaceId,
} from '@/lib/ambassador/validators'
import { extractCoverObjectPath } from '@/lib/ambassador/storage'

/**
 * POST /api/ambassador/model/professionals
 *
 * Create-or-dedupe a model_professionals row by Instagram handle.
 *
 * Per Slice 3B locked decision #3 (CLAUDE_CODE_HANDOFF.md) and
 * Principle A (IG handle is the authoritative identity for a
 * professional; name/city/country/avatar are snapshot-on-first-create):
 *
 *   - If a row with the normalized instagram_handle exists, return it
 *     as-is with 200 + `created: false`. Client auto-fills its form
 *     with the existing name/city/country (avatar comes back as the
 *     existing one; the client's just-uploaded avatar becomes orphan
 *     storage and is accepted as inert garbage for V1 — orphan cleanup
 *     is already tracked in the pre-launch checklist).
 *   - If no row exists, validate the remaining fields and INSERT with
 *     created_by = auth.uid(). Return 201 + `created: true`.
 *   - Race: two tabs may INSERT simultaneously. The unique constraint
 *     on instagram_handle surfaces as PostgrestError.code '23505'. On
 *     that error, re-SELECT and return the row that won the race with
 *     200 + `created: false`.
 *
 * Principle D note: this endpoint does NOT touch auth.users or
 * public.users. model_professionals has no shadow table. No pairing
 * required.
 */

type Professional = {
  id: string
  instagram_handle: string
  name: string
  city: string
  country: string
  avatar_photo_url: string
  created_by: string
  created_at: string
  updated_at: string
  google_place_id: string | null
  whatsapp_number: string | null
  google_places_cache: Record<string, unknown> | null
}

const PROFESSIONAL_COLS =
  'id, instagram_handle, name, city, country, avatar_photo_url, created_by, created_at, updated_at, google_place_id, whatsapp_number, google_places_cache'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    // ---- Instagram handle — required, validated, normalized ----
    if (typeof body.instagram_handle !== 'string') {
      return NextResponse.json({ error: 'instagram_handle required' }, { status: 400 })
    }
    const normalized = body.instagram_handle.trim().toLowerCase().replace(/^@/, '')
    if (!isValidInstagramHandle(normalized)) {
      return NextResponse.json({ error: 'Invalid Instagram handle' }, { status: 400 })
    }

    const admin = createServiceRoleClient()

    // ---- Dedup probe — return existing row if we find one ----
    // Principle A: IG is authoritative, everything else is snapshot.
    // Existing row's avatar is authoritative too — the client's just-
    // uploaded avatar (passed in this request) is ignored on the
    // existing-match branch.
    const { data: existing, error: selectError } = await admin
      .from('model_professionals')
      .select(PROFESSIONAL_COLS)
      .eq('instagram_handle', normalized)
      .maybeSingle<Professional>()

    if (selectError) {
      console.error('[Ambassador Professionals] Dedup SELECT failed:', selectError)
      return NextResponse.json({ error: 'Failed to look up professional' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ professional: existing, created: false }, { status: 200 })
    }

    // ---- No match — validate remaining fields for INSERT ----
    if (
      typeof body.name !== 'string' ||
      typeof body.city !== 'string' ||
      typeof body.country !== 'string' ||
      typeof body.avatar_photo_url !== 'string'
    ) {
      return NextResponse.json(
        { error: 'name, city, country, avatar_photo_url required for new professional' },
        { status: 400 },
      )
    }

    const name = body.name.trim()
    const city = body.city.trim()
    const country = body.country.trim()
    const avatar_photo_url = body.avatar_photo_url.trim()

    if (!name || !city || !country) {
      return NextResponse.json(
        { error: 'name, city, country cannot be empty' },
        { status: 400 },
      )
    }

    // ---- Avatar URL must point to caller-owned model-media path ----
    // Prevents the client from passing an arbitrary external URL. The
    // helper parses the public-object path out of a model-media URL;
    // null means the URL doesn't match the model-media bucket pattern.
    // The first path segment is the auth.uid() folder per the
    // storage RLS INSERT policy on model-media.
    const avatarPath = extractCoverObjectPath(avatar_photo_url)
    const ownerFolder = avatarPath ? avatarPath.split('/')[0] : null
    if (!avatarPath || ownerFolder !== user.id) {
      return NextResponse.json(
        { error: 'avatar_photo_url must point to caller-owned model-media storage' },
        { status: 400 },
      )
    }

    // ---- Trust Stack fields — optional, shape-validated when present ----
    // Both are nullable on model_professionals; absent/null means "not set".
    let google_place_id: string | null = null
    if (body.google_place_id != null) {
      if (typeof body.google_place_id !== 'string' || !isValidGooglePlaceId(body.google_place_id.trim())) {
        return NextResponse.json({ error: 'Invalid google_place_id' }, { status: 400 })
      }
      google_place_id = body.google_place_id.trim()
    }
    let whatsapp_number: string | null = null
    if (body.whatsapp_number != null) {
      if (typeof body.whatsapp_number !== 'string' || !isValidE164(body.whatsapp_number.trim())) {
        return NextResponse.json({ error: 'Invalid whatsapp_number' }, { status: 400 })
      }
      whatsapp_number = body.whatsapp_number.trim()
    }

    // ---- INSERT — race-safe via 23505 catch ----
    const { data: created, error: insertError } = await admin
      .from('model_professionals')
      .insert({
        instagram_handle: normalized,
        name,
        city,
        country,
        avatar_photo_url,
        created_by: user.id,
        google_place_id,
        whatsapp_number,
      })
      .select(PROFESSIONAL_COLS)
      .single<Professional>()

    if (insertError) {
      // PostgreSQL unique_violation. A concurrent request inserted first;
      // re-SELECT and return the winning row so the client sees a
      // consistent dedup response regardless of ordering.
      if (insertError.code === '23505') {
        const { data: raced, error: racedError } = await admin
          .from('model_professionals')
          .select(PROFESSIONAL_COLS)
          .eq('instagram_handle', normalized)
          .maybeSingle<Professional>()
        if (racedError || !raced) {
          console.error(
            '[Ambassador Professionals] Race-resolve SELECT failed:',
            racedError,
          )
          return NextResponse.json(
            { error: 'Failed to resolve professional' },
            { status: 500 },
          )
        }
        return NextResponse.json({ professional: raced, created: false }, { status: 200 })
      }
      console.error('[Ambassador Professionals] INSERT failed:', insertError)
      return NextResponse.json({ error: 'Failed to create professional' }, { status: 500 })
    }

    return NextResponse.json({ professional: created, created: true }, { status: 201 })
  } catch (err) {
    console.error('[Ambassador Professionals] POST threw:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
