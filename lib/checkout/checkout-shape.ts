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
}

export interface CheckoutData {
  listing_id: string
  payment_link_token: string
  currency: string
  category_label: string | null
  already_paid: boolean
  ambassador: CheckoutAmbassador
  professional: CheckoutProfessional
  packages: CheckoutPackage[]
}

// PostgREST shape returned by the /pay/[token] server-component fetch.
// Join hint uses the FK constraint name to match the 4A pattern.
export interface CheckoutListingRow {
  id: string
  model_id: string
  price_30: number | null
  price_60: number | null
  price_90: number | null
  currency: string
  payment_link_token: string
  status: ListingStatus
  paid_until: string | null
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
  payment_link_token, status, paid_until, category_custom,
  model_professionals!model_listings_professional_id_fkey (
    name, instagram_handle, city, country
  ),
  model_categories!model_listings_category_id_fkey ( label ),
  profile:model_profiles!model_listings_model_id_fkey (
    id, slug, first_name, last_name, tagline,
    cover_photo_url, cover_photo_position_y
  )
`

// Dispatch classification — 8 alphanumerics is the listings-token
// shape (matches model_listings.payment_link_token CHECK constraint);
// the canonical UUID regex matches the legacy payment_links.id shape.
// Anything else routes to the terminal expired page.
export const LISTINGS_TOKEN_PATTERN = /^[A-Za-z0-9]{8}$/
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

export function toCheckoutData(row: CheckoutListingRow): CheckoutData | null {
  const professional = row.model_professionals
  const profile = row.profile
  if (!professional || !profile) return null

  const packages = computePackages(row)
  if (packages.length === 0) return null

  const paidUntilMs = row.paid_until ? new Date(row.paid_until).getTime() : 0
  const already_paid = row.status === 'active' && paidUntilMs > Date.now()

  const category_label = row.model_categories?.label ?? row.category_custom ?? null

  return {
    listing_id: row.id,
    payment_link_token: row.payment_link_token,
    currency: row.currency,
    category_label,
    already_paid,
    ambassador: {
      id: profile.id,
      slug: profile.slug,
      first_name: profile.first_name,
      last_name: profile.last_name,
      tagline: profile.tagline,
      cover_photo_url: profile.cover_photo_url,
      cover_photo_position_y: profile.cover_photo_position_y,
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
