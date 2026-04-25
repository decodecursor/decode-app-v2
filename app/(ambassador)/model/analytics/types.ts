/**
 * Shared types for the Analytics page sub-components. Mirrors the
 * RangePayload shape returned by GET /api/ambassador/model/analytics.
 */

export type RangeKey = 'today' | 'week' | 'month' | 'all'

export type Direction = 'up' | 'down' | 'flat'

export interface TrendValue {
  trend: number
  direction: Direction
}

export interface FunnelMetric {
  value: number
  trend: number
  direction: Direction
}

export interface RangeData {
  total: number
  total_formatted: string
  total_trend: TrendValue
  chart: { line: string | null; fill: string | null; buckets: number[]; xLabels: string[] }
  breakdown: {
    listings: number
    wishes: number
    listings_pct: number
    wishes_pct: number
    listings_formatted: string
    wishes_formatted: string
  }
  funnel: { visits: FunnelMetric; clicks: FunnelMetric; gifts: FunnelMetric }
  topListings: { name: string; count: number; pct: number }[]
  topWishes: { name: string; count: number; pct: number }[]
  topListing: { name: string; meta: string; amount_formatted: string } | null
  topGifter: { name: string; meta: string; amount_formatted: string } | null
}

export type AnalyticsResponse = Record<RangeKey, RangeData>
