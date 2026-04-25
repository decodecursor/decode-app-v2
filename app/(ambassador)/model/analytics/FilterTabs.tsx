'use client'

import type { RangeKey } from './types'

const LABELS: Record<RangeKey, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  all: 'All',
}

export default function FilterTabs({ active, onChange }: {
  active: RangeKey
  onChange: (k: RangeKey) => void
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '24px',
      padding: '14px 0',
      borderBottom: '1px solid #1f1f1f',
    }}>
      {(['today', 'week', 'month', 'all'] as RangeKey[]).map((k) => {
        const isActive = active === k
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 0',
              color: isActive ? '#fff' : '#777',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 400,
              borderBottom: isActive ? '1.5px solid #e91e8c' : '1.5px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {LABELS[k]}
          </button>
        )
      })}
    </div>
  )
}
