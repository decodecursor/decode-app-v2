import { buildChartPaths } from './chart-path'
import { formatCurrencyText } from './currency-format'

/**
 * Aggregation helpers for /api/ambassador/model/analytics. Extracted
 * here per Slice 6 locked decision E (decompose-upfront for new
 * Analytics surfaces) — the route file keeps fetching + auth, this
 * module owns the maths.
 *
 * Strategy: fetch full event + payment history once per model
 * (small per-tenant data through V1), then bucket + reduce in-process
 * across the 4 ranges. Cheaper than 50+ parameterized SQL queries.
 */

const FUNNEL_CLICK_TYPES = new Set([
  'listing_instagram_click',
  'listing_media_click',
  'wish_giftit_click',
  'wish_instagram_click',
])

export interface AnalyticsEvent {
  event_type: string
  target_id: string | null
  created_at: string
}

export interface ListingPayment {
  net_amount: number | string
  status: string
  refunded_at: string | null
  refund_amount: number | string | null
  created_at: string
  listing_id: string
}

export interface WishPayment {
  net_amount: number | string
  status: string
  refunded_at: string | null
  refund_amount: number | string | null
  created_at: string
  wish_id: string
  gifter_name: string | null
  gifter_is_anonymous: boolean
}

export interface RangeBounds { start: Date; end: Date }
export interface RangePair { current: RangeBounds; previous: RangeBounds | null; sparkBuckets: number }

export type RangeKey = 'today' | 'week' | 'month' | 'all'

export type Direction = 'up' | 'down' | 'flat'

export interface TrendValue {
  trend: number
  direction: Direction
}

export interface RangePayload {
  total: number
  total_formatted: string
  total_trend: TrendValue
  chart: { line: string | null; fill: string | null; buckets: number[]; xLabels: string[] }
  breakdown: { listings: number; wishes: number; listings_pct: number; wishes_pct: number; listings_formatted: string; wishes_formatted: string }
  funnel: {
    visits: { value: number; trend: number; direction: Direction }
    clicks: { value: number; trend: number; direction: Direction }
    gifts: { value: number; trend: number; direction: Direction }
  }
  topListings: { name: string; count: number; pct: number }[]
  topWishes: { name: string; count: number; pct: number }[]
  topListing: { name: string; meta: string; amount_formatted: string } | null
  topGifter: { name: string; meta: string; amount_formatted: string } | null
}

// X-axis labels per range — matches mockup hardcoded values verbatim
// (analytics_final.html lines 576, 601, 626, 651). Labels are
// cosmetic axis markers, not bucket-aligned.
const X_LABELS: Record<RangeKey, string[]> = {
  today: ['9am', '12pm', '3pm', '6pm', '9pm'],
  week:  ['Mon', 'Wed', 'Fri', 'Sun'],
  month: ['1', '8', '15', '22', '30'],
  all:   ['Jan', 'Apr', 'Jul', 'Oct', 'Now'],
}

export function computeRanges(
  now: Date,
  profileCreatedAt: Date,
  dataFloor: Date | null = null,
): Record<RangeKey, RangePair> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

  const startOfYesterday = new Date(startOfDay.getTime() - 86_400_000)

  const week = new Date(startOfDay.getTime() - 6 * 86_400_000)
  const prevWeekStart = new Date(week.getTime() - 7 * 86_400_000)
  const prevWeekEnd = new Date(week.getTime())

  const month = new Date(startOfDay.getTime() - 29 * 86_400_000)
  const prevMonthStart = new Date(month.getTime() - 30 * 86_400_000)
  const prevMonthEnd = new Date(month.getTime())

  // "All" lower bound: defensively the EARLIER of profile.created_at
  // and the oldest payment/event row in scope. In prod the FK
  // invariant means no row predates profile.created_at, so dataFloor
  // collapses to profileCreatedAt and behavior is unchanged. Defends
  // against back-dated rows from migrations / admin tools / test
  // populators silently dropping data from the All tab.
  const allStart = dataFloor && dataFloor.getTime() < profileCreatedAt.getTime()
    ? dataFloor
    : profileCreatedAt

  return {
    today: { current: { start: startOfDay, end: endOfDay }, previous: { start: startOfYesterday, end: startOfDay }, sparkBuckets: 24 },
    week:  { current: { start: week,       end: endOfDay }, previous: { start: prevWeekStart,   end: prevWeekEnd }, sparkBuckets: 7 },
    month: { current: { start: month,      end: endOfDay }, previous: { start: prevMonthStart,  end: prevMonthEnd }, sparkBuckets: 30 },
    all:   { current: { start: allStart,   end: endOfDay }, previous: null, sparkBuckets: 12 },
  }
}

function inRange(iso: string, b: RangeBounds): boolean {
  const t = Date.parse(iso)
  return t >= b.start.getTime() && t < b.end.getTime()
}

function netAmount(p: { net_amount: number | string; status: string }): number {
  if (p.status === 'refunded' || p.status === 'partial_refund') return 0
  const net = typeof p.net_amount === 'string' ? Number(p.net_amount) : p.net_amount
  return Number.isFinite(net) ? net : 0
}

function bucketize(values: { iso: string; amount: number }[], range: RangeBounds, buckets: number): number[] {
  const slot = (range.end.getTime() - range.start.getTime()) / buckets
  const out = new Array<number>(buckets).fill(0)
  for (const v of values) {
    const t = Date.parse(v.iso)
    if (t < range.start.getTime() || t >= range.end.getTime()) continue
    const idx = Math.min(buckets - 1, Math.floor((t - range.start.getTime()) / slot))
    out[idx] += v.amount
  }
  return out
}

function trendDirection(curr: number, prev: number | null): { trend: number; direction: Direction } {
  if (prev === null) return { trend: 0, direction: 'flat' }
  if (prev === 0) return curr > 0 ? { trend: 100, direction: 'up' } : { trend: 0, direction: 'flat' }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct > 0) return { trend: pct, direction: 'up' }
  if (pct < 0) return { trend: Math.abs(pct), direction: 'down' }
  return { trend: 0, direction: 'flat' }
}

function fmtMoney(n: number, currency: string): string {
  return formatCurrencyText('amount-with-code', currency, n)
}

// Format a created_at timestamp into compact lifetime: "12d" / "3m 12d" / "1y 2m" / "1y 2m 5d".
// < 1 month → "Nd"
// < 1 year → "Nm Nd" (or "Nm" if days portion is 0)
// ≥ 1 year → "Ny Nm Nd" (omit zero parts; if both months and days are 0, just "Ny")
function formatLiveTime(createdAtIso: string | undefined): string {
  if (!createdAtIso) return ''
  const start = Date.parse(createdAtIso)
  if (!Number.isFinite(start)) return ''
  const now = Date.now()
  const diffMs = Math.max(0, now - start)
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (totalDays < 30) {
    return `${totalDays}d`
  }
  // Approximate: 30 days per month, 365 days per year. Good enough for display.
  const years = Math.floor(totalDays / 365)
  const remAfterYears = totalDays - years * 365
  const months = Math.floor(remAfterYears / 30)
  const days = remAfterYears - months * 30
  if (years === 0) {
    return days === 0 ? `${months}m` : `${months}m ${days}d`
  }
  const parts: string[] = [`${years}y`]
  if (months > 0) parts.push(`${months}m`)
  if (days > 0) parts.push(`${days}d`)
  return parts.join(' ')
}

function topN<T>(counts: Map<string, number>, n: number, project: (id: string, count: number, max: number) => T): T[] {
  if (counts.size === 0) return []
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
  const max = sorted[0]?.[1] ?? 0
  return sorted.map(([id, count]) => project(id, count, max))
}

function bestEntry(map: Map<string, number>): [string, number] | null {
  if (map.size === 0) return null
  let best: [string, number] | null = null
  for (const entry of map.entries()) {
    if (!best || entry[1] > best[1]) best = entry
  }
  return best
}

export function buildRange(
  key: RangeKey,
  pair: RangePair,
  events: AnalyticsEvent[],
  listingPayments: ListingPayment[],
  wishPayments: WishPayment[],
  listings: Map<string, { name: string; created_at: string }>,
  wishNames: Map<string, string>,
  currency: string,
): RangePayload {
  const r = pair.current
  const prev = pair.previous

  const listingsInRange = listingPayments.filter((p) => inRange(p.created_at, r))
  const wishesInRange = wishPayments.filter((p) => inRange(p.created_at, r))
  const listingsTotal = listingsInRange.reduce((s, p) => s + netAmount(p), 0)
  const wishesTotal = wishesInRange.reduce((s, p) => s + netAmount(p), 0)
  const total = listingsTotal + wishesTotal

  let totalTrend: TrendValue = { trend: 0, direction: 'flat' }
  if (prev) {
    const listingsPrev = listingPayments.filter((p) => inRange(p.created_at, prev)).reduce((s, p) => s + netAmount(p), 0)
    const wishesPrev   = wishPayments.filter((p) => inRange(p.created_at, prev)).reduce((s, p) => s + netAmount(p), 0)
    totalTrend = trendDirection(total, listingsPrev + wishesPrev)
  }

  const earningSeries = [
    ...listingsInRange.map((p) => ({ iso: p.created_at, amount: netAmount(p) })),
    ...wishesInRange.map((p) => ({ iso: p.created_at, amount: netAmount(p) })),
  ]
  const buckets = bucketize(earningSeries, r, pair.sparkBuckets)
  const paths = buildChartPaths(buckets)

  const visitsCurr = events.filter((e) => e.event_type === 'public_page_view' && inRange(e.created_at, r)).length
  const clicksCurr = events.filter((e) => FUNNEL_CLICK_TYPES.has(e.event_type) && inRange(e.created_at, r)).length
  const giftsCurr = wishesInRange.filter((p) => p.status === 'completed').length

  let visitsTrend = { trend: 0, direction: 'flat' as Direction }
  let clicksTrend = { trend: 0, direction: 'flat' as Direction }
  let giftsTrend  = { trend: 0, direction: 'flat' as Direction }
  if (prev) {
    const visitsPrev = events.filter((e) => e.event_type === 'public_page_view' && inRange(e.created_at, prev)).length
    const clicksPrev = events.filter((e) => FUNNEL_CLICK_TYPES.has(e.event_type) && inRange(e.created_at, prev)).length
    const giftsPrev  = wishPayments.filter((p) => p.status === 'completed' && inRange(p.created_at, prev)).length
    visitsTrend = trendDirection(visitsCurr, visitsPrev)
    clicksTrend = trendDirection(clicksCurr, clicksPrev)
    giftsTrend  = trendDirection(giftsCurr, giftsPrev)
  }

  const listingClickCounts = new Map<string, number>()
  for (const e of events) {
    if ((e.event_type === 'listing_instagram_click' || e.event_type === 'listing_media_click') && e.target_id && inRange(e.created_at, r)) {
      listingClickCounts.set(e.target_id, (listingClickCounts.get(e.target_id) ?? 0) + 1)
    }
  }
  const topListings = topN(listingClickCounts, 3, (id, count, max) => ({
    name: listings.get(id)?.name ?? 'Unknown',
    count,
    pct: max > 0 ? Math.round((count / max) * 100) : 0,
  }))

  const wishClickCounts = new Map<string, number>()
  for (const e of events) {
    if ((e.event_type === 'wish_giftit_click' || e.event_type === 'wish_instagram_click') && e.target_id && inRange(e.created_at, r)) {
      wishClickCounts.set(e.target_id, (wishClickCounts.get(e.target_id) ?? 0) + 1)
    }
  }
  const topWishes = topN(wishClickCounts, 3, (id, count, max) => ({
    name: wishNames.get(id) ?? 'Unknown',
    count,
    pct: max > 0 ? Math.round((count / max) * 100) : 0,
  }))

  // All-time #1 listing — walks the FULL listingPayments array, not the in-range slice.
  // Range-independent on purpose: this is "your top earner ever," not "this period's leader."
  const listingEarnAllTime = new Map<string, number>()
  for (const p of listingPayments) listingEarnAllTime.set(p.listing_id, (listingEarnAllTime.get(p.listing_id) ?? 0) + netAmount(p))
  const topListingEntry = bestEntry(listingEarnAllTime)
  const topListing = topListingEntry
    ? {
        name: listings.get(topListingEntry[0])?.name ?? 'Unknown',
        meta: formatLiveTime(listings.get(topListingEntry[0])?.created_at),
        amount_formatted: fmtMoney(topListingEntry[1], currency),
      }
    : null

  // All-time #1 gifter — walks the FULL wishPayments array, not the in-range slice.
  // count increments only for non-refunded payments (matches the amount, which excludes refunds via netAmount).
  const gifterEarnAllTime = new Map<string, { total: number; count: number }>()
  for (const p of wishPayments) {
    if (p.gifter_is_anonymous) continue
    if (!p.gifter_name) continue
    const isRefunded = p.status === 'refunded' || p.status === 'partial_refund'
    const prevAcc = gifterEarnAllTime.get(p.gifter_name) ?? { total: 0, count: 0 }
    gifterEarnAllTime.set(p.gifter_name, {
      total: prevAcc.total + netAmount(p),
      count: prevAcc.count + (isRefunded ? 0 : 1),
    })
  }
  const topGifterEntry = [...gifterEarnAllTime.entries()].sort((a, b) => b[1].total - a[1].total)[0]
  const topGifter = topGifterEntry
    ? {
        name: topGifterEntry[0],
        meta: `${topGifterEntry[1].count} ${topGifterEntry[1].count === 1 ? 'gift' : 'gifts'}`,
        amount_formatted: fmtMoney(topGifterEntry[1].total, currency),
      }
    : null

  return {
    total,
    total_formatted: fmtMoney(total, currency),
    total_trend: totalTrend,
    chart: { line: paths?.line ?? null, fill: paths?.fill ?? null, buckets, xLabels: X_LABELS[key] },
    breakdown: {
      listings: listingsTotal,
      wishes: wishesTotal,
      listings_pct: total > 0 ? Math.round((listingsTotal / total) * 100) : 0,
      wishes_pct:   total > 0 ? Math.round((wishesTotal   / total) * 100) : 0,
      listings_formatted: fmtMoney(listingsTotal, currency),
      wishes_formatted:   fmtMoney(wishesTotal, currency),
    },
    funnel: {
      visits: { value: visitsCurr, ...visitsTrend },
      clicks: { value: clicksCurr, ...clicksTrend },
      gifts:  { value: giftsCurr,  ...giftsTrend  },
    },
    topListings,
    topWishes,
    topListing,
    topGifter,
  }
}
