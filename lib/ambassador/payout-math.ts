/**
 * Money math for ambassador listing payments.
 *
 * Phase 1 locked decision #1: flat 20% platform fee. DO NOT reuse the
 * legacy tiered fee structure in lib/stripe.ts — that's salon-specific
 * and does not apply to ambassador flows.
 *
 * Numeric invariant: gross_amount = platform_fee + net_amount must hold
 * after rounding. The DB enforces this via CHECK constraint on
 * model_listing_payments, so any drift here rejects the INSERT.
 * We round fee first, then derive net as (gross − fee) also rounded, to
 * eliminate floating-point tail and keep the equality exact at 2 decimals.
 *
 * Currency: 2-decimal currencies only in V1 (model_profiles setup page's
 * CURRS list). Zero-decimal currencies (JPY, KRW) would require rework
 * of toStripeAmount and these helpers — out of 4B+4C scope.
 */

const PLATFORM_FEE_RATE = 0.20
const MS_PER_DAY = 86_400_000

export interface FeeSplit {
  gross: number
  fee: number
  net: number
}

export function splitFee(gross: number): FeeSplit {
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error(`splitFee: invalid gross amount ${gross}`)
  }
  const fee = Math.round(gross * PLATFORM_FEE_RATE * 100) / 100
  const net = Math.round((gross - fee) * 100) / 100
  // Defensive post-check — if FP rounding ever breaks the invariant,
  // fail fast here instead of letting the DB CHECK reject the INSERT.
  const sum = Math.round((fee + net) * 100) / 100
  if (sum !== Math.round(gross * 100) / 100) {
    throw new Error(`splitFee: invariant violation gross=${gross} fee=${fee} net=${net}`)
  }
  return { gross, fee, net }
}

/**
 * Stack a payment period onto the existing paid_until. Matches the
 * renewal semantics in locked decision #5: MAX(paid_until, NOW())
 * + package_days. Returns the period's start and end dates.
 *
 * For a first-time payment (current === null), start = now.
 * For a renewal after expiry (current < now), start = now.
 * For a renewal before expiry, start = current paid_until — the new
 * window begins where the old one ends (additive, not replacing).
 */
export function computePaymentPeriod(
  current: Date | null,
  packageDays: number,
): { periodStart: Date; periodEnd: Date } {
  if (!Number.isInteger(packageDays) || packageDays <= 0) {
    throw new Error(`computePaymentPeriod: invalid packageDays ${packageDays}`)
  }
  const nowMs = Date.now()
  const currentMs = current ? current.getTime() : 0
  const startMs = currentMs > nowMs ? currentMs : nowMs
  const endMs = startMs + packageDays * MS_PER_DAY
  return {
    periodStart: new Date(startMs),
    periodEnd: new Date(endMs),
  }
}
