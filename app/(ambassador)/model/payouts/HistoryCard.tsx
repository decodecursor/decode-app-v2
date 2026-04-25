'use client'

import { useRouter } from 'next/navigation'
import { useCountUp } from '@/components/ambassador/useCountUp'
import type { HistoryRow } from './types'

/**
 * Total + history rows card. Mirrors mockup payouts_list_final.html
 * lines 50-124. Outer padding 0 20px 16px, inner card #1c1c1c bg /
 * 14px radius / padding 18px 18px 8px (bottom is 8px so the last
 * row's padding-bottom completes the visual rhythm).
 *
 * Top row (lines 53-59): label "Total" 11px #666 + count "{N} payouts"
 * 10px #777 (margin-top 4px) on left; total amount 22px/700/-0.2px on
 * right. Margin-bottom 16px.
 *
 * Divider (line 61): 1px #1f1f1f, full-bleed via `margin:0 -18px 4px`.
 *
 * Rows (lines 66-119): flex justify-between center, padding 14px 0,
 * border-bottom 1px #1f1f1f (last-child none), cursor pointer,
 * transition bg 0.12s, border-radius 8px, margin 0 -8px, padding-l/r
 * 8px. Hover bg #262626. Row tap → /model/payouts/{id} real URL.
 *
 * Row content (lines 67-74): left col date 14px/700 #fff + reference
 * 10px #777 margin-top 4px; right col amount 15px/600 #fff text-align
 * right + status text 10px #34d399 (paid) / status-color (others)
 * margin-top 4px.
 *
 * useCountUp on the total per decision β (mount-only).
 */
export default function HistoryCard({ rows, totalFormatted }: {
  rows: HistoryRow[]
  totalFormatted: string
}) {
  const router = useRouter()
  const animatedTotal = useCountUp(totalFormatted)

  return (
    <div style={{ padding: '0 20px 16px' }}>
      <div style={{
        background: '#1c1c1c',
        borderRadius: '14px',
        padding: '18px 18px 8px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#666', textAlign: 'left' }}>Total</div>
            <div style={{ fontSize: '10px', color: '#777', marginTop: '4px', textAlign: 'left' }}>
              {rows.length} {rows.length === 1 ? 'payout' : 'payouts'}
            </div>
          </div>
          <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.2px', color: '#fff' }}>
            {animatedTotal}
          </span>
        </div>

        <div style={{ height: '1px', background: '#1f1f1f', margin: '0 -18px 4px' }} />

        {rows.map((r, i) => (
          <Row
            key={r.id}
            row={r}
            isLast={i === rows.length - 1}
            onTap={() => router.push(`/model/payouts/${r.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

function Row({ row, isLast, onTap }: {
  row: HistoryRow
  isLast: boolean
  onTap: () => void
}) {
  return (
    <div
      onClick={onTap}
      onKeyDown={(e) => { if (e.key === 'Enter') onTap() }}
      role="button"
      tabIndex={0}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        paddingLeft: '8px',
        paddingRight: '8px',
        margin: '0 -8px',
        borderBottom: isLast ? 'none' : '1px solid #1f1f1f',
        cursor: 'pointer',
        transition: 'background-color 0.12s',
        borderRadius: '8px',
      }}
      className="po-row"
    >
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{row.date_pretty}</div>
        <div style={{ fontSize: '10px', color: '#777', marginTop: '4px' }}>{row.payout_reference}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{row.amount_formatted}</div>
        <div style={{ fontSize: '10px', color: row.status_color, marginTop: '4px' }}>{row.status_label}</div>
      </div>
    </div>
  )
}
