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

export interface PublicListingRow {
  id: string
  category_label: string | null
  category_custom: string | null
  media_type: PublicListingMediaType | null
  video_url: string | null
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
}

export interface PublicProfile {
  id: string
  slug: string
  first_name: string
  last_name: string
  tagline: string | null
  cover_photo_url: string | null
  cover_photo_position_y: number | null
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
 */
export const PUBLIC_LISTING_SELECT = `
  id, category_id, category_custom, media_type,
  video_url, photo_url_1, photo_url_2, photo_url_3,
  effective_status, created_at,
  model_professionals!model_listings_professional_id_fkey (
    id, name, instagram_handle, city, country, avatar_photo_url
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
  } | null
  model_categories: { label: string } | null
}

export function toPublicListing(row: LiveListingJoinRow): PublicListingRow | null {
  const prof = row.model_professionals
  if (!prof) return null
  return {
    id: row.id,
    category_label: row.model_categories?.label ?? null,
    category_custom: row.category_custom,
    media_type: row.media_type,
    video_url: row.video_url,
    photo_url_1: row.photo_url_1,
    photo_url_2: row.photo_url_2,
    photo_url_3: row.photo_url_3,
    professional_id: prof.id,
    professional_name: prof.name,
    professional_instagram: prof.instagram_handle,
    professional_city: prof.city,
    professional_country: prof.country,
    professional_avatar_url: prof.avatar_photo_url,
  }
}

// Build "Dubai, UAE" / "Dubai" / "UAE" / "" from the joined city+country.
export function locationText(row: PublicListingRow): string {
  if (row.professional_city && row.professional_country) {
    return `${row.professional_city}, ${row.professional_country}`
  }
  return row.professional_city ?? row.professional_country ?? ''
}

// Category pill text — explicit label wins, custom text is the fallback.
export function categoryText(row: PublicListingRow): string {
  return row.category_label ?? row.category_custom ?? ''
}
