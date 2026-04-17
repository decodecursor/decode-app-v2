import {
  ZERO_DECIMAL_CURRENCIES,
  PLATFORM_FEE_RATE,
  TOKEN_LENGTH,
  TOKEN_CHARSET,
} from './constants'

// ============================================================================
// Reference number generation
// ============================================================================

/**
 * Generate a human-readable reference: L-847-3921, W-291-8473, P-563-9204
 */
export function generateReference(prefix: 'L' | 'W' | 'P'): string {
  const part1 = Math.floor(100 + Math.random() * 900)    // 3 digits (100-999)
  const part2 = Math.floor(1000 + Math.random() * 9000)  // 4 digits (1000-9999)
  return `${prefix}-${part1}-${part2}`
}

/**
 * Generate an 8-char alphanumeric payment link token.
 * Uses crypto.getRandomValues for security.
 */
export function generatePaymentLinkToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  let token = ''
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_CHARSET[bytes[i] % TOKEN_CHARSET.length]
  }
  return token
}

// ============================================================================
// Stripe amount conversion (zero-decimal aware)
// ============================================================================

/**
 * Convert a decimal amount to Stripe's integer format.
 * Zero-decimal currencies (JPY, KRW, etc.) pass as-is.
 * All others multiply by 100 (dollars → cents).
 */
export function toStripeAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase() as any)) {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

/**
 * Convert Stripe's integer amount back to decimal.
 * Zero-decimal currencies return as-is.
 * All others divide by 100 (cents → dollars).
 */
export function fromStripeAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase() as any)) {
    return amount
  }
  return amount / 100
}

// ============================================================================
// Fee calculation
// ============================================================================

/**
 * Calculate platform fee split. Called ONCE at payment time, stored immutably.
 * Never recalculate at display time.
 */
export function calculateFeeSplit(grossAmount: number): {
  gross_amount: number
  platform_fee: number
  net_amount: number
} {
  const platformFee = Math.round(grossAmount * PLATFORM_FEE_RATE * 100) / 100
  const netAmount = Math.round((grossAmount - platformFee) * 100) / 100
  return {
    gross_amount: grossAmount,
    platform_fee: platformFee,
    net_amount: netAmount,
  }
}

// ============================================================================
// Currency formatting
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: '$',
  eur: '\u20AC',
  gbp: '\u00A3',
}

/**
 * Format a currency amount for display.
 * e.g. formatCurrency(1234.5, 'aed') → "1,235 AED"
 *      formatCurrency(99.99, 'usd') → "$100 USD"
 */
export function formatCurrency(amount: number, currency: string): string {
  const upper = currency.toUpperCase()
  const symbol = CURRENCY_SYMBOLS[currency.toLowerCase()]
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  if (symbol) {
    return `${symbol}${formatted} ${upper}`
  }
  return `${formatted} ${upper}`
}

// ============================================================================
// Slug validation
// ============================================================================

const SLUG_REGEX = /^[a-z0-9_]{3,30}$/

/**
 * Validate a slug format (does NOT check availability or reserved list).
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug)
}

// ============================================================================
// Date formatting for emails
// ============================================================================

/**
 * Format date as "16 April 2026" (day + full month name + year, no comma).
 */
export function formatDateForEmail(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
