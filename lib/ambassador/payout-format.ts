/**
 * Shared formatting helpers for the Slice 6B Payouts read surface.
 * Server-side formatting (Pattern: "Server formats, client renders" —
 * mockup §10 design philosophy). Two-decimal amounts for Payouts +
 * Statement, en-US thousand separators, currency-prefixed.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
}

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed'

export interface StatusBadge {
  label: string
  color: string
}

// Per Slice 6B-1 locked decision α (with override): failed = #ef4444 red
// (fintech convention; Stripe / Wise / Revolut pattern), NOT pink. Pending +
// processing share the amber state. Mockup only draws PAID; the other three
// are spec-driven additions.
export function statusBadge(status: PayoutStatus): StatusBadge {
  switch (status) {
    case 'paid':       return { label: 'Paid',       color: '#34d399' }
    case 'pending':    return { label: 'Pending',    color: '#f59e0b' }
    case 'processing': return { label: 'Processing', color: '#f59e0b' }
    case 'failed':     return { label: 'Failed',     color: '#ef4444' }
  }
}

// Hero badge variant — solid bg pill on the Statement detail page.
// Background color carries the status; text is white for non-paid
// states, black for paid (per mockup line 62 PAID badge bg #34d399 +
// color #000).
export function statusHeroBadge(status: PayoutStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'paid':       return { label: 'PAID',       bg: '#34d399', fg: '#000' }
    case 'pending':    return { label: 'PENDING',    bg: '#f59e0b', fg: '#000' }
    case 'processing': return { label: 'PROCESSING', bg: '#f59e0b', fg: '#000' }
    case 'failed':     return { label: 'FAILED',     bg: '#ef4444', fg: '#fff' }
  }
}

// "8 April 2026" — matches mockup line 68. en-GB locale gives day-month-
// year ordering without a leading zero on the day; same shape as
// formatDateForEmail in utils.ts (kept separate so payout-side date
// changes don't drift the email templates).
export function formatPrettyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// "Wednesday, 15 April 2026" — matches mockup line 45. Used on the
// Next-payout card when the actual payout hasn't been batched yet.
export function formatScheduledForPretty(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// 2-decimal money with thousand separators, currency prefix. Used for
// every dollar amount on the Payouts list + Statement (mockup uses 2-
// decimal Payouts/Statement throughout — different from Analytics's
// whole-number rounding per spec §6).
export function formatPayoutAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const upper = currency.toUpperCase()
  const symbol = CURRENCY_SYMBOLS[upper]
  return symbol ? `${symbol}${formatted}` : `${formatted} ${upper}`
}

// Compute the next payout date — the next Wednesday after `from` in UTC.
// HANDOFF §3.5 says payouts roll forward weekly. Wednesday = UTC day-of-
// week 3. If today IS Wednesday, the next payout is the *following*
// Wednesday (the current week's batch already locked in admin's view).
export function nextPayoutDate(from: Date = new Date()): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const dow = d.getUTCDay() // 0=Sun … 3=Wed
  const daysUntil = ((3 - dow + 7) % 7) || 7
  d.setUTCDate(d.getUTCDate() + daysUntil)
  return d
}

// Bank last4 display: "•••• 4821" (mockup line 90). Caller supplies the
// last4 string (already trimmed at admin-batch time).
export function formatBankLast4(last4: string): string {
  return `•••• ${last4}`
}
