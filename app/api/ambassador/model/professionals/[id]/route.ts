import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isValidE164, isValidGooglePlaceId } from '@/lib/ambassador/validators'

/**
 * PATCH /api/ambassador/model/professionals/[id] — Trust Stack Chunk 3
 *
 * Edits the two Trust Stack fields on a model_professionals row:
 *   - google_place_id  (TEXT, nullable — null clears)
 *   - whatsapp_number  (TEXT E.164, nullable — null clears)
 *
 * Ownership: created_by ONLY. model_professionals rows are deduped/shared
 * across ambassadors (POST dedupes by IG handle), so a 403 is returned when
 * created_by !== auth.uid(). RLS would enforce this for an anon/auth client,
 * but this route uses the service-role client (bypasses RLS), so the check
 * is explicit here. The client mirrors this by rendering the fields LOCKED
 * for non-creators — so a 403 is a belt-and-suspenders guard, not an
 * expected path.
 *
 * Cache invalidation: when google_place_id actually changes (or is cleared),
 * the cached Google Places + Gemini data on the row is for the OLD place and
 * is therefore wiped (google_places_cache + *_cached_at + review_summary_*).
 * Chunk 4's slug-page render then cold-fetches fresh data for the new place.
 *
 * No status gate: per Q-edit-scope=A these two fields are editable on a
 * professional regardless of any listing's status — the exception to the
 * professional-field lock policy that applies to name/IG/city/country.
 */

const ALLOWED_KEYS = new Set(['google_place_id', 'whatsapp_number'])

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

    // ---- Existence + ownership (created_by only) ----
    const { data: existing, error: existingError } = await admin
      .from('model_professionals')
      .select('id, created_by, google_place_id')
      .eq('id', id)
      .maybeSingle<{ id: string; created_by: string; google_place_id: string | null }>()

    if (existingError) {
      console.error('[Ambassador Professionals] PATCH lookup failed:', existingError)
      return NextResponse.json({ error: 'Failed to load professional' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 })
    }
    if (existing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the professional’s creator can edit these fields' },
        { status: 403 },
      )
    }

    // ---- Parse + whitelist body ----
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    for (const k of Object.keys(body)) {
      if (!ALLOWED_KEYS.has(k)) {
        return NextResponse.json({ error: `Field not editable: ${k}` }, { status: 400 })
      }
    }

    const updatePayload: Record<string, unknown> = {}

    if ('google_place_id' in body) {
      if (body.google_place_id === null) {
        updatePayload.google_place_id = null
      } else if (
        typeof body.google_place_id === 'string' &&
        isValidGooglePlaceId(body.google_place_id.trim())
      ) {
        updatePayload.google_place_id = body.google_place_id.trim()
      } else {
        return NextResponse.json({ error: 'Invalid google_place_id' }, { status: 400 })
      }
    }

    if ('whatsapp_number' in body) {
      if (body.whatsapp_number === null) {
        updatePayload.whatsapp_number = null
      } else if (
        typeof body.whatsapp_number === 'string' &&
        isValidE164(body.whatsapp_number.trim())
      ) {
        updatePayload.whatsapp_number = body.whatsapp_number.trim()
      } else {
        return NextResponse.json({ error: 'Invalid whatsapp_number' }, { status: 400 })
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No editable fields in body' }, { status: 400 })
    }

    // ---- Cache invalidation when the place actually changes ----
    // The cached Places/Gemini data is keyed to the old place_id; if the
    // place_id is changing (or being cleared) that cache is now wrong.
    if (
      'google_place_id' in updatePayload &&
      updatePayload.google_place_id !== existing.google_place_id
    ) {
      updatePayload.google_places_cache = null
      updatePayload.google_places_cached_at = null
      updatePayload.review_summary_gemini = null
      updatePayload.review_summary_generated_at = null
    }

    const { data: updated, error: updateError } = await admin
      .from('model_professionals')
      .update(updatePayload)
      .eq('id', id)
      .select('id, google_place_id, whatsapp_number')
      .single<{ id: string; google_place_id: string | null; whatsapp_number: string | null }>()

    if (updateError || !updated) {
      console.error('[Ambassador Professionals] PATCH UPDATE failed:', updateError)
      return NextResponse.json({ error: 'Failed to update professional' }, { status: 500 })
    }

    return NextResponse.json({ professional: updated }, { status: 200 })
  } catch (err) {
    console.error('[Ambassador Professionals] PATCH threw:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
