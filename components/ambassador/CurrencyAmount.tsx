import type { CSSProperties, ReactNode } from 'react'
import { DirhamSymbol } from './DirhamSymbol'

export type CurrencyVariant =
  | 'code-only'
  | 'symbol-only'
  | 'code-with-symbol'
  | 'amount-with-symbol'
  | 'amount-with-code'

export type CurrencyDecimals = 'rounded' | 'fixed-2' | 'flex-0-2'

interface Props {
  currency: string
  amount?: number
  variant: CurrencyVariant
  decimals?: CurrencyDecimals
  className?: string
  style?: CSSProperties
}

const TEXT_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
}

function resolveSymbol(code: string): ReactNode {
  if (code === 'AED') return <DirhamSymbol />
  return TEXT_SYMBOLS[code] ?? null
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
  // flex-0-2: integer when amount has no fractional component, else fixed-2
  if (amount % 1 === 0) {
    return Math.round(amount).toLocaleString('en-US')
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const SVG_ALIGN_WRAPPER: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
}

export function CurrencyAmount({
  currency,
  amount,
  variant,
  decimals = 'rounded',
  className,
  style,
}: Props) {
  const code = currency.toUpperCase()
  const symbol = resolveSymbol(code)
  const formatted = amount != null ? formatAmount(amount, decimals) : ''

  if (variant === 'code-only') {
    return <span className={className} style={style}>{code}</span>
  }

  if (variant === 'symbol-only') {
    if (symbol == null) {
      return <span className={className} style={style}>{code}</span>
    }
    return <span className={className} style={{ ...SVG_ALIGN_WRAPPER, ...style }}>{symbol}</span>
  }

  if (variant === 'code-with-symbol') {
    if (symbol == null) {
      return <span className={className} style={style}>{code}</span>
    }
    return (
      <span className={className} style={style}>
        {code} (<span style={SVG_ALIGN_WRAPPER}>{symbol}</span>)
      </span>
    )
  }

  if (variant === 'amount-with-symbol') {
    if (symbol == null) {
      return <span className={className} style={style}>{formatted} {code}</span>
    }
    return (
      <span className={className} style={{ ...SVG_ALIGN_WRAPPER, ...style }}>
        {symbol}{formatted}
      </span>
    )
  }

  // amount-with-code
  return <span className={className} style={style}>{formatted} {code}</span>
}
