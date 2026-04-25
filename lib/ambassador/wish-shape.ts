/**
 * Server-side projection of a model_wishes_live row + its (at-most-one)
 * completed payment row into the shape the Wishlist card needs.
 *
 * Mirrors lib/ambassador/listing-shape.ts (Slice 3A pattern). Centralizes
 * the GET response shape so the page server-component, the API GET route,
 * and the client card all consume identical types.
 */

export type WishStatus = 'available' | 'taken'

export interface WishCardRow {
  id: string
  status: WishStatus
  effective_status: WishStatus
  service_name: string
  professional_name: string | null
  professional_city: string | null
  professional_country: string | null
  price: number
  currency: string
  gifter_name: string | null
  gifter_instagram: string | null
  gifter_is_anonymous: boolean
  taken_at: string | null
  payment_reference: string | null
  // 8-char base64url token. Surfaced to the client so the wishlist
  // share button can construct the gifter checkout URL. The token is
  // not a secret (it's the path component of the public payment link),
  // so client exposure is safe.
  payment_link_token: string
  created_at: string
  // True when the row can be hard-deleted by the owner. False once a
  // completed payment exists — the FK ON DELETE RESTRICT on
  // model_wish_payments.wish_id would block delete anyway, but we
  // surface the intent in the card UI to hide the delete icon.
  removable: boolean
}

interface PaymentJoinRow {
  payment_reference: string
  status: string
}

export interface WishLiveRow {
  id: string
  status: WishStatus
  effective_status: WishStatus
  service_name: string
  professional_name: string | null
  professional_city: string | null
  professional_country: string | null
  price: number | string
  currency: string
  gifter_name: string | null
  gifter_instagram: string | null
  gifter_is_anonymous: boolean
  taken_at: string | null
  payment_link_token: string
  created_at: string
  // PostgREST embed: zero or one completed payment row per wish in V1.
  // (Schema enforces no UNIQUE on wish_id but the application invariant
  // is one-wish-one-gift; webhook only creates the row on PI success.)
  model_wish_payments: PaymentJoinRow[] | PaymentJoinRow | null
}

export const WISH_LIVE_SELECT = `
  id, status, effective_status, service_name,
  professional_name, professional_city, professional_country,
  price, currency,
  gifter_name, gifter_instagram, gifter_is_anonymous,
  taken_at, payment_link_token, created_at,
  model_wish_payments!model_wish_payments_wish_id_fkey ( payment_reference, status )
`

export function toWishCardRow(row: WishLiveRow): WishCardRow {
  // Defensive narrowing — PostgREST may return a single object or an
  // array depending on relationship cardinality detection. Treat
  // either as a 0-or-1-element list.
  const paymentArr = Array.isArray(row.model_wish_payments)
    ? row.model_wish_payments
    : row.model_wish_payments
      ? [row.model_wish_payments]
      : []
  const completed = paymentArr.find((p) => p.status === 'completed') ?? null
  const hasCompletedPayment = completed !== null

  return {
    id: row.id,
    status: row.status,
    effective_status: row.effective_status,
    service_name: row.service_name,
    professional_name: row.professional_name,
    professional_city: row.professional_city,
    professional_country: row.professional_country,
    price: typeof row.price === 'string' ? Number(row.price) : row.price,
    currency: row.currency,
    gifter_name: row.gifter_name,
    gifter_instagram: row.gifter_instagram,
    gifter_is_anonymous: row.gifter_is_anonymous,
    taken_at: row.taken_at,
    payment_reference: completed?.payment_reference ?? null,
    payment_link_token: row.payment_link_token,
    created_at: row.created_at,
    removable: !hasCompletedPayment,
  }
}
