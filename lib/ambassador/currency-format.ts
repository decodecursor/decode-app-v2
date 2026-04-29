/**
 * String-only twin of <CurrencyAmount>. Use in HTML attribute contexts
 * (placeholders), email/notification template literals, chart axis
 * labels, and anywhere JSX cannot land.
 *
 * Dirham SVG is JSX-only; AED in string contexts always renders as the
 * literal "AED" code (per the AMBASSADOR currency unification commit —
 * single source of truth, deliberate constraint, not a regression).
 */

export type TextCurrencyVariant =
  | 'code-only'
  | 'symbol-only'
  | 'amount-with-code'
  | 'amount-with-symbol'

export type CurrencyDecimals = 'rounded' | 'fixed-2' | 'flex-0-2'

interface Options {
  decimals?: CurrencyDecimals
}

const TEXT_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
}

function formatAmount(amount: number, decimals: CurrencyDecimals): string {
  if (decimals === 'rounded') {
    return Math.round(amount).toLocaleString('en-US')
  }
  if (decimals === 'fixed-2') {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  if (amount % 1 === 0) {
    return Math.round(amount).toLocaleString('en-US')
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyText(
  variant: TextCurrencyVariant,
  currency: string,
  amount?: number,
  opts?: Options,
): string {
  const code = currency.toUpperCase()
  const decimals = opts?.decimals ?? 'rounded'
  const textSymbol = TEXT_SYMBOLS[code] ?? null

  if (variant === 'code-only') return code

  if (variant === 'symbol-only') {
    return textSymbol ?? code
  }

  if (variant === 'amount-with-code') {
    if (amount == null) return code
    return `${formatAmount(amount, decimals)} ${code}`
  }

  // amount-with-symbol: text-only — symbol prefix for symbol-bearing
  // currencies, falls back to amount-with-code shape otherwise (AED in
  // strings has no SVG fallback, so renders code-suffix shape).
  if (amount == null) return textSymbol ?? code
  if (textSymbol) return `${textSymbol}${formatAmount(amount, decimals)}`
  return `${formatAmount(amount, decimals)} ${code}`
}
