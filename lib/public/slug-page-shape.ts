/**
 * Typed projection of a public ambassador page (slug → cover + listings).
 * Centralized here so the server page, the client orchestrator, and future
 * Slice 4B+4C checkout overlay consume the same shape.
 *
 * V1 scope (Slice 4A): listings only. No Wishlist, no Wall of Love —
 * those fields land in Slice 5 once the Settings visibility toggle ships.
 * Corresponding spec sections (§4.3, §4.4) are superseded for V1 in
 * public_page_final_UI_Spec.md.
 */

export type PublicListingMediaType = 'video' | 'photos'

// JSONB shape of model_professionals.google_places_cache. Loose because
// Google omits fields when underlying data is missing. Chunk 4 reads
// rating + userRatingCount; Chunk 5 (Pro Info modal) additionally reads
// websiteUri, googleMapsUri, internationalPhoneNumber, editorialSummary
// for the quick-action row. Named here for type-safety on the modal call
// sites; remaining fields (reviews[], displayName, id) flow through the
// index signature.
export interface PublicPlacesCache {
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  googleMapsUri?: string
  internationalPhoneNumber?: string
  editorialSummary?: { text?: string; languageCode?: string }
  [key: string]: unknown
}

export interface PublicListingRow {
  id: string
  category_label: string | null
  category_custom: string | null
  media_type: PublicListingMediaType | null
  video_url: string | null
  video_thumbnail_url: string | null
  photo_url_1: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  // Joined from model_professionals — the squad-row tile displays these
  // fields and the lightbox overlay re-uses them on the info bar.
  professional_id: string
  professional_name: string
  professional_instagram: string
  professional_city: string | null
  professional_country: string | null
  professional_avatar_url: string | null
  // Trust Stack additions (Chunk 4). All nullable — graceful degradation
  // when Places hasn't been linked or messaged_30d is below the threshold.
  whatsapp_number: string | null
  rating: number | null
  review_count: number | null
  messaged_30d: number
  last_msg_at: string | null
  // Trust Stack Chunk 5 — Pro Info modal payload. The select projection
  // already queried these (PUBLIC_LISTING_SELECT below); Chunk 4 dropped
  // them at toPublicListing(). Chunk 5 surfaces them so the modal can
  // render the quick-action row + AI summary without a second fetch.
  google_places_cache: PublicPlacesCache | null
  review_summary_gemini: string | null
  review_summary_custom: string | null
}

export interface PublicProfile {
  id: string
  slug: string
  first_name: string
  last_name: string
  tagline: string | null
  cover_photo_url: string | null
  cover_photo_position_y: number | null
  // Slice 5D: gates both the WishesSection and the WallOfLoveSection on
  // the public page — PublicPageClient renders each only when this is
  // true. Within that gate the WallOfLoveSection also hides itself when
  // there are zero completed gifts.
  gifts_enabled: boolean
}

export interface PublicPageData {
  profile: PublicProfile
  listings: PublicListingRow[]
}

/**
 * PostgREST select string used by the server page. Uses the
 * model_listings_live view so effective_status filters out date-expired
 * rows even when the background expiry job hasn't run yet.
 *
 * Join hint uses the canonical FK name (matches 3A GET, 3C PATCH).
 *
 * Chunk 4 adds the Trust Stack columns on the embedded professional
 * projection: google_place_id + the cache pair drive Places refresh; the
 * Gemini summary pair + review_summary_custom are read by the Chunk 5
 * Pro Info modal but are projected here so a single fetch round-trips
 * all the data the page needs (modal mount in Chunk 5 reads from the
 * already-hydrated listing object — no second fetch).
 */
export const PUBLIC_LISTING_SELECT = `
  id, category_id, category_custom, media_type,
  video_url, video_thumbnail_url, photo_url_1, photo_url_2, photo_url_3,
  effective_status, created_at,
  model_professionals!model_listings_professional_id_fkey (
    id, name, instagram_handle, city, country, avatar_photo_url,
    google_place_id, whatsapp_number,
    google_places_cache, google_places_cached_at,
    review_summary_gemini, review_summary_generated_at, review_summary_custom
  ),
  model_categories!model_listings_category_id_fkey ( label )
`

// Shape as returned by PostgREST — narrower than PublicListingRow; the
// server page flattens it via toPublicListing().
export interface LiveListingJoinRow {
  id: string
  category_id: string | null
  category_custom: string | null
  media_type: PublicListingMediaType | null
  video_url: string | null
  video_thumbnail_url: string | null
  photo_url_1: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  effective_status: 'free_trial' | 'pending_payment' | 'active' | 'expired'
  created_at: string
  model_professionals: {
    id: string
    name: string
    instagram_handle: string
    city: string | null
    country: string | null
    avatar_photo_url: string | null
    google_place_id: string | null
    whatsapp_number: string | null
    google_places_cache: PublicPlacesCache | null
    google_places_cached_at: string | null
    review_summary_gemini: string | null
    review_summary_generated_at: string | null
    review_summary_custom: string | null
  } | null
  model_categories: { label: string } | null
}

export function toPublicListing(row: LiveListingJoinRow): PublicListingRow | null {
  const prof = row.model_professionals
  if (!prof) return null
  const placesRating =
    typeof prof.google_places_cache?.rating === 'number'
      ? prof.google_places_cache.rating
      : null
  const placesReviewCount =
    typeof prof.google_places_cache?.userRatingCount === 'number'
      ? prof.google_places_cache.userRatingCount
      : null
  return {
    id: row.id,
    category_label: row.model_categories?.label ?? null,
    category_custom: row.category_custom,
    media_type: row.media_type,
    video_url: row.video_url,
    video_thumbnail_url: row.video_thumbnail_url,
    photo_url_1: row.photo_url_1,
    photo_url_2: row.photo_url_2,
    photo_url_3: row.photo_url_3,
    professional_id: prof.id,
    professional_name: prof.name,
    professional_instagram: prof.instagram_handle,
    professional_city: prof.city,
    professional_country: prof.country,
    professional_avatar_url: prof.avatar_photo_url,
    whatsapp_number: prof.whatsapp_number,
    rating: placesRating,
    review_count: placesReviewCount,
    messaged_30d: 0,
    last_msg_at: null,
    google_places_cache: prof.google_places_cache,
    review_summary_gemini: prof.review_summary_gemini,
    review_summary_custom: prof.review_summary_custom,
  }
}

// Category pill text — explicit label wins, custom text is the fallback.
export function categoryText(row: PublicListingRow): string {
  return row.category_label ?? row.category_custom ?? ''
}
