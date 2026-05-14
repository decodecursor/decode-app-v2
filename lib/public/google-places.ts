/**
 * Google Places (New) — salon detail fetcher + 24h JSONB cache
 *
 * API: Places API (New). Endpoint:
 *   GET https://places.googleapis.com/v1/places/{placeId}
 * Required headers:
 *   X-Goog-Api-Key   — process.env.GOOGLE_PLACES_API_KEY
 *   X-Goog-FieldMask — field-masking is mandatory in Places API (New);
 *                      a wildcard request is billed for every field.
 * Field mask (verbatim):
 *   id,displayName,rating,userRatingCount,reviews,websiteUri,googleMapsUri,
 *   internationalPhoneNumber,editorialSummary
 *
 * Cache: the full Place Details response is stored on
 *   model_professionals.google_places_cache (JSONB), with
 *   model_professionals.google_places_cached_at driving a 24h TTL.
 *
 * Stale policy: serve the cached response immediately even when stale, then
 * trigger a fire-and-forget background refresh that writes the fresh response
 * back to the JSONB column. The caller's response is never blocked on the
 * refresh. Only the cold path (no cache row at all) fetches synchronously.
 *
 * Env: GOOGLE_PLACES_API_KEY is registered optional in env-validation.ts —
 * this module imports fine without it and throws only at first fetch.
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { logger } from '@/lib/logger'

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places'
const PLACES_FIELD_MASK =
  'id,displayName,rating,userRatingCount,reviews,websiteUri,googleMapsUri,internationalPhoneNumber,editorialSummary'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface LocalizedText {
  text?: string
  languageCode?: string
}

export interface PlaceReview {
  rating?: number
  text?: LocalizedText
  originalText?: LocalizedText
  relativePublishTimeDescription?: string
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string }
}

// Loosely typed off the field mask — every property is optional because
// Google omits fields when the underlying data is missing.
export interface PlaceDetailsResponse {
  id?: string
  displayName?: LocalizedText
  rating?: number
  userRatingCount?: number
  reviews?: PlaceReview[]
  websiteUri?: string
  googleMapsUri?: string
  internationalPhoneNumber?: string
  editorialSummary?: LocalizedText
}

/**
 * Fresh GET to Google Places. Throws on missing API key, network failure,
 * non-2xx response, or an unparseable body.
 */
export async function fetchPlaceDetailsFromGoogle(
  placeId: string,
): Promise<PlaceDetailsResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set')
  }

  const res = await fetch(`${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Google Places request failed (${res.status} ${res.statusText}): ${body.slice(0, 300)}`,
    )
  }

  const data = (await res.json().catch(() => null)) as PlaceDetailsResponse | null
  if (!data || typeof data !== 'object') {
    throw new Error('Google Places returned an invalid response body')
  }
  return data
}

async function writePlaceCache(
  supabase: ServiceRoleClient,
  professionalId: string,
  data: PlaceDetailsResponse,
): Promise<void> {
  const { error } = await supabase
    .from('model_professionals')
    .update({
      google_places_cache: data,
      google_places_cached_at: new Date().toISOString(),
    })
    .eq('id', professionalId)
  if (error) {
    logger.error('[google-places] cache write failed', professionalId, error.message)
  }
}

/**
 * Top-level entry point. Reads the cached Place Details + its age:
 *   - fresh cache  → returned as-is
 *   - stale cache  → returned immediately; a background refresh is fired
 *                    (not awaited) to rewrite the JSONB column
 *   - no cache     → cold path: fetch synchronously, write back, return it
 *
 * Returns null only on the cold path when the Google fetch itself fails —
 * the caller degrades gracefully (renders without Places data).
 */
export async function getPlaceDataForProfessional(
  supabase: ServiceRoleClient,
  professionalId: string,
  placeId: string,
): Promise<PlaceDetailsResponse | null> {
  const { data: row, error } = await supabase
    .from('model_professionals')
    .select('google_places_cache, google_places_cached_at')
    .eq('id', professionalId)
    .maybeSingle<{
      google_places_cache: PlaceDetailsResponse | null
      google_places_cached_at: string | null
    }>()

  if (error) {
    logger.error('[google-places] cache read failed', professionalId, error.message)
  }

  const cache = row?.google_places_cache ?? null
  const cachedAt = row?.google_places_cached_at
    ? new Date(row.google_places_cached_at).getTime()
    : null

  if (cache && cachedAt != null) {
    const isStale = Date.now() - cachedAt > CACHE_TTL_MS
    if (isStale) {
      // Fire-and-forget background refresh — caller is not blocked. A request
      // context could opt into `after()` from next/server for guaranteed
      // completion; the helper stays caller-agnostic and simply does not await.
      void fetchPlaceDetailsFromGoogle(placeId)
        .then((fresh) => writePlaceCache(supabase, professionalId, fresh))
        .catch((err) => {
          logger.warn('[google-places] background refresh failed', professionalId, err)
        })
    }
    return cache
  }

  // Cold path — no cache row yet. Fetch synchronously so the first render has
  // data; on failure return null and let the caller degrade.
  try {
    const fresh = await fetchPlaceDetailsFromGoogle(placeId)
    await writePlaceCache(supabase, professionalId, fresh)
    return fresh
  } catch (err) {
    logger.warn('[google-places] cold-path fetch failed', professionalId, err)
    return null
  }
}
