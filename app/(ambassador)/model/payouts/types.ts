/**
 * Shared types for the Payouts list + Statement client components.
 * Mirrors the response shapes from the two GET endpoints.
 */

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed'

export interface NextPayoutSummary {
  amount: number
  amount_formatted: string
  currency: string
  scheduled_for: string
  scheduled_for_pretty: string
}

export interface HistoryRow {
  id: string
  payout_reference: string
  date_pretty: string
  amount_formatted: string
  status: PayoutStatus
  status_label: string
  status_color: string
}

export interface PayoutsListResponse {
  next_payout: NextPayoutSummary | null
  history: HistoryRow[]
  history_count: number
  history_total_formatted: string
  is_empty: boolean
}

export interface StatementListingRow {
  professional_name: string
  package_days: number
  is_renewal: boolean
  paid_on_pretty: string
  net_amount_formatted: string
  gross_amount_formatted: string
  subtitle: string
}

export interface StatementWishRow {
  service_name: string
  gifter_display_name: string
  paid_on_pretty: string
  net_amount_formatted: string
  gross_amount_formatted: string
  subtitle: string
}

export interface StatementResponse {
  id: string
  payout_reference: string
  status: PayoutStatus
  status_label: string
  status_color: string
  hero_badge: { label: string; bg: string; fg: string }
  amount_formatted: string
  currency: string
  date_pretty: string
  listings_count: number
  wishes_count: number
  bank_name: string
  bank_last4_formatted: string
  listings: StatementListingRow[]
  wishes: StatementWishRow[]
}
