/**
 * Server-side projection of a model_listings_live row into the shape the
 * Listings page card needs. Centralized here so GET /listings and DELETE
 * (409 stale-response) return identical payloads — the spec's
 * error_stale branch hinges on "fresh full listing object" matching the
 * list-GET shape.
 */

export type ListingStatus = 'free_trial' | 'pending_payment' | 'active' | 'expired'

export interface ListingCardRow {
  id: string
  status: ListingStatus
  effective_status: ListingStatus
  is_free_trial: boolean
  free_trial_ends_at: string | null
  paid_until: string | null
  created_at: string

  professional_name: string | null
  category_label: string | null
  category_custom: string | null
  city: string | null
  country: string | null

  days_left: number
  removable: boolean
  removable_from_formatted: string | null
}

export interface LiveViewRow {
  id: string
  status: ListingStatus
  effective_status: ListingStatus
  is_free_trial: boolean
  free_trial_ends_at: string | null
  paid_until: string | null
  created_at: string
  category_custom: string | null
  model_professionals: { name: string; city: string; country: string } | null
  model_categories: { label: string } | null
}

function daysBetween(fromMs: number, toMs: number): number {
  const MS_PER_DAY = 86_400_000
  return Math.max(0, Math.ceil((toMs - fromMs) / MS_PER_DAY))
}

function formatRemovableFrom(paidUntil: string): string {
  const base = new Date(paidUntil)
  base.setUTCDate(base.getUTCDate() + 1)
  return base.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function toCardRow(row: LiveViewRow): ListingCardRow {
  const now = Date.now()

  let daysLeft = 0
  if (row.effective_status === 'active' && row.paid_until) {
    daysLeft = daysBetween(now, new Date(row.paid_until).getTime())
  } else if (row.effective_status === 'free_trial' && row.free_trial_ends_at) {
    daysLeft = daysBetween(now, new Date(row.free_trial_ends_at).getTime())
  }

  const removable = row.effective_status !== 'active'
  const removable_from_formatted =
    row.effective_status === 'active' && row.paid_until
      ? formatRemovableFrom(row.paid_until)
      : null

  return {
    id: row.id,
    status: row.status,
    effective_status: row.effective_status,
    is_free_trial: row.is_free_trial,
    free_trial_ends_at: row.free_trial_ends_at,
    paid_until: row.paid_until,
    created_at: row.created_at,

    professional_name: row.model_professionals?.name ?? null,
    category_label: row.model_categories?.label ?? null,
    category_custom: row.category_custom,
    city: row.model_professionals?.city ?? null,
    country: row.model_professionals?.country ?? null,

    days_left: daysLeft,
    removable,
    removable_from_formatted,
  }
}

export const LIVE_VIEW_SELECT = `
  id, status, effective_status, is_free_trial,
  free_trial_ends_at, paid_until, created_at, category_custom,
  model_professionals!model_listings_professional_id_fkey ( name, city, country ),
  model_categories!model_listings_category_id_fkey ( label )
`
