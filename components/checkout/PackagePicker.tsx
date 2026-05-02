'use client'

/**
 * Three-row package picker for the listing checkout.
 *
 * Each row: days badge + total + per-day subtitle + optional "Save N%"
 * badge. Default-highlighted row ships per checkout spec §4. Selection
 * is controlled; parent (CheckoutClient) owns state.
 */

import type { CheckoutPackage, PackageDays } from '@/lib/checkout/checkout-shape'
import { formatCurrencyText } from '@/lib/ambassador/currency-format'

interface Props {
  packages: CheckoutPackage[]
  selected: PackageDays
  currency: string
  onSelect: (days: PackageDays) => void
}

export function PackagePicker({ packages, selected, currency, onSelect }: Props) {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {packages.map((pkg) => (
        <PackageRow
          key={pkg.days}
          pkg={pkg}
          currency={currency}
          isSelected={pkg.days === selected}
          onSelect={() => onSelect(pkg.days)}
        />
      ))}
    </div>
  )
}

function PackageRow({
  pkg,
  currency,
  isSelected,
  onSelect,
}: {
  pkg: CheckoutPackage
  currency: string
  isSelected: boolean
  onSelect: () => void
}) {
  const borderColor = isSelected ? '#e91e8c' : '#262626'
  const bgColor = isSelected ? 'rgba(233,30,140,0.08)' : '#1c1c1c'

  // Per-day shape per mockup: "{CODE} {amount}/day" (prefix, no spaces
  // around the slash). Reuses formatCurrencyText's flex-0-2 amount
  // formatting so locale + decimal handling stays consistent with the
  // total below — just reorders code-to-front.
  const perDayCodeFirst = formatCurrencyText('amount-with-code', currency, pkg.per_day, { decimals: 'flex-0-2' })
  const [perDayAmount, perDayCode] = perDayCodeFirst.split(' ')
  const perDayText = `${perDayCode} ${perDayAmount}/day`

  const totalText = formatCurrencyText('amount-with-code', currency, pkg.total, { decimals: 'flex-0-2' })
  const showBadge = pkg.savings_pct != null && pkg.savings_pct > 0

  return (
    <div
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onSelect() } }}
      style={{
        position: 'relative',
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Save badge — pink, floating above the row, centered. pointer-
          events: none so the row's click target is unaffected. */}
      {showBadge && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
            background: '#e91e8c',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 12px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Save {pkg.savings_pct}%
        </span>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
        {pkg.days} days
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#666' }}>
          {perDayText}
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          {totalText}
        </span>
      </div>
    </div>
  )
}
