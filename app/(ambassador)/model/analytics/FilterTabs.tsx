'use client'

import type { RangeKey } from './types'

const LABELS: Record<RangeKey, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  all: 'All',
}

/**
 * Filter tabs row. Mirrors mockup lines 87-93. Wrapper padding
 * 0 20px 20px (top/right + bottom/left), flex gap 15px. Inactive
 * tabs are 13px/600 #777 with padding 6px 0 4px. Active tab is
 * 13px/700 #fff with a 1.5px #e91e8c bottom border (mockup CSS
 * line 26 + active style on line 90).
 *
 * Element type swapped from mockup `<div onclick>` to `<button>`
 * for accessibility — deliberate Slice 6A polish deviation,
 * functionally identical.
 */
export default function FilterTabs({ active, onChange }: {
  active: RangeKey
  onChange: (k: RangeKey) => void
}) {
  return (
    <div style={{
      padding: '0 20px 20px',
      display: 'flex',
      gap: '15px',
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
              padding: '6px 0 4px',
              color: isActive ? '#fff' : '#777',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 600,
              borderBottom: isActive ? '1.5px solid #e91e8c' : '1.5px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {LABELS[k]}
          </button>
        )
      })}
    </div>
  )
}
