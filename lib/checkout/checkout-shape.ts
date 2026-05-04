/**
 * Typed projection + dispatch helpers for the /pay/[token] route and the
 * checkout UI tree (CheckoutClient, PackagePicker, PaymentModal).
 *
 * Single source of truth for the shape that flows server → client in
 * Slice 4B+4C, mirroring the Slice 4A pattern in lib/public/slug-page-shape.ts.
 */

export type ListingStatus = 'free_trial' | 'pending_payment' | 'active' | 'expired'
export type PackageDays = 30 | 60 | 90

export interface CheckoutPackage {
  days: PackageDays
  total: number
  per_day: number
  savings_pct: number | null
  is_default: boolean
}

export interface CheckoutProfessional {
  name: string
  instagram_handle: string
  city: string | null
  country: string | null
}

export interface CheckoutAmbassador {
  id: string
  slug: string
  first_name: string
  last_name: string | null
  tagline: string | null
  cover_photo_url: string | null
  cover_photo_position_y: number | null
  // Sourced from public.users.instagram_handle via a separate fetch
  // in app/pay/[token]/page.tsx — model_profiles has no FK to users
  // so PostgREST can't embedded-join, hence the second-query path.
  instagram_handle: string | null
}

export interface CheckoutData {
  listing_id: string
  payment_link_token: string
  currency: string
  category_label: string | null
  // True only when the listing is terminal (effective_status='expired').
  // active / pending_payment / free_trial are all payable: pending → first
  // payment, free_trial → upgrade, active → renewal (Phase 4 stacking).
  is_unpayable: boolean
  ambassador: CheckoutAmbassador
  professional: CheckoutProfessional
  packages: CheckoutPackage[]
}

// PostgREST shape returned by the /pay/[token] server-component fetch.
// Read from model_listings_live so effective_status reflects date
// rollover (free_trial_ends_at / paid_until past now) without relying
// on raw status alone. Join hints use FK constraint names — PostgREST
// resolves them via the view's underlying table metadata (same pattern
// as the send-link page query).
export interface CheckoutListingRow {
  id: string
  model_id: string
  price_30: number | null
  price_60: number | null
  price_90: number | null
  currency: string
  payment_link_token: string
  effective_status: ListingStatus
  category_custom: string | null
  model_professionals: {
    name: string
    instagram_handle: string
    city: string | null
    country: string | null
  } | null
  model_categories: { label: string } | null
  profile: {
    id: string
    user_id: string
    slug: string
    first_name: string
    last_name: string | null
    tagline: string | null
    cover_photo_url: string | null
    cover_photo_position_y: number | null
  } | null
}

export const CHECKOUT_LISTING_SELECT = `
  id, model_id, price_30, price_60, price_90, currency,
  payment_link_token, effective_status, category_custom,
  model_professionals!model_listings_professional_id_fkey (
    name, instagram_handle, city, country
  ),
  model_categories!model_listings_category_id_fkey ( label ),
  profile:model_profiles!model_listings_model_id_fkey (
    id, user_id, slug, first_name, last_name, tagline,
    cover_photo_url, cover_photo_position_y
  )
`

// Dispatch classification — 8 base64url chars is the listings-token
// shape produced by app/api/ambassador/model/listings/route.ts
// (randomBytes(6).toString('base64url'), so the alphabet is
// [A-Za-z0-9_-]). The canonical UUID regex matches the legacy
// payment_links.id shape. Length differs (8 vs 36) so the two
// patterns cannot collide. Anything else routes to notFound()
// (→ /expired once Slice 4B+4C commit 5 ships).
export const LISTINGS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8}$/
export const LEGACY_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DispatchKind = 'listing' | 'legacy' | 'invalid'

export function classifyToken(token: string): DispatchKind {
  if (LISTINGS_TOKEN_PATTERN.test(token)) return 'listing'
  if (LEGACY_UUID_PATTERN.test(token)) return 'legacy'
  return 'invalid'
}

// Package derivation — "Save N%" baseline is the 30-day per-day rate
// per checkout spec §3.1 ("computed server-side from the cheapest
// per-day rate to prevent drift"). Returns [] if any price is unset,
// which the server component treats as a not-yet-ready listing and
// routes to the expired fallback.
export function computePackages(row: CheckoutListingRow): CheckoutPackage[] {
  if (row.price_30 == null || row.price_60 == null || row.price_90 == null) {
    return []
  }
  const total30 = Number(row.price_30)
  const total60 = Number(row.price_60)
  const total90 = Number(row.price_90)
  const baseline = total30 / 30

  const mk = (days: PackageDays, total: number, isDefault: boolean): CheckoutPackage => {
    const perDay = total / days
    const savings = days === 30
      ? null
      : Math.max(0, Math.round((1 - perDay / baseline) * 100))
    return {
      days,
      total: Math.round(total * 100) / 100,
      per_day: Math.round(perDay * 100) / 100,
      savings_pct: savings,
      is_default: isDefault,
    }
  }

  return [
    mk(30, total30, false),
    mk(60, total60, false),
    mk(90, total90, true),
  ]
}

export function toCheckoutData(
  row: CheckoutListingRow,
  ambassadorInstagramHandle: string | null = null,
): CheckoutData | null {
  const professional = row.model_professionals
  const profile = row.profile
  if (!professional || !profile) return null

  const packages = computePackages(row)
  if (packages.length === 0) return null

  const is_unpayable = row.effective_status === 'expired'

  const category_label = row.model_categories?.label ?? row.category_custom ?? null

  return {
    listing_id: row.id,
    payment_link_token: row.payment_link_token,
    currency: row.currency,
    category_label,
    is_unpayable,
    ambassador: {
      id: profile.id,
      slug: profile.slug,
      first_name: profile.first_name,
      last_name: profile.last_name,
      tagline: profile.tagline,
      cover_photo_url: profile.cover_photo_url,
      cover_photo_position_y: profile.cover_photo_position_y,
      instagram_handle: ambassadorInstagramHandle,
    },
    professional: {
      name: professional.name,
      instagram_handle: professional.instagram_handle,
      city: professional.city,
      country: professional.country,
    },
    packages,
  }
}

export function ambassadorDisplayName(a: CheckoutAmbassador): string {
  return `${a.first_name}${a.last_name ? ' ' + a.last_name : ''}`
}
