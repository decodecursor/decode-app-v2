'use client'

/**
 * Three-row package picker for the listing checkout.
 *
 * Each row: days badge + total + per-day subtitle + optional "Save N%"
 * badge. Default-highlighted row ships per checkout spec §4. Selection
 * is controlled; parent (CheckoutClient) owns state.
 */

import type { CheckoutPackage, PackageDays } from '@/lib/checkout/checkout-shape'
import { formatCurrency } from '@/lib/ambassador/utils'

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
  const perDayLabel = formatCurrency(pkg.per_day, currency)

  return (
    <div
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onSelect() } }}
      style={{
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
          {pkg.days} days
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {perDayLabel} / day
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {pkg.savings_pct != null && pkg.savings_pct > 0 && (
          <span
            style={{
              fontSize: 10,
              letterSpacing: 0.5,
              color: '#4ade80',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            SAVE {pkg.savings_pct}%
          </span>
        )}
        <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          {formatCurrency(pkg.total, currency)}
        </span>
      </div>
    </div>
  )
}
