'use client'

import { useEffect, useRef } from 'react'
import type { RangeData, RangeKey } from './types'

type TopRow = { name: string; meta: string; amount_formatted: string }

/**
 * Two stacked bands of side-by-side columns:
 *   Band 1 — "Top listings by clicks" + "Top wishes by clicks": up
 *     to 3 click rows each (single-label name + count + 3px pink/mint
 *     progress bar that animates 0 → pct% over 1500ms cubic-bezier
 *     (.2,.7,.2,1) on mount + range change).
 *   Band 2 — "#1 listing" + "#1 gifter": single highest-earner row
 *     per side (12px/600 name, 10px/777 meta, 12px/600 amount).
 *
 * Hoisted #1 band lives in a sibling row (not inside each column) so
 * the #1 sub-headers stay y-aligned across columns regardless of
 * click-row count variance — earlier per-column structure jumped
 * vertically when listings had 3 rows and wishes had 2.
 *
 * Click-row two-label structure (mockup `cat · pro`) is superseded
 * to single-label uniform on both columns — per Slice 6A polish
 * judgment call 1: schema doesn't support category on wishes
 * (Slice 5A locked decision A omitted IG + category from the wish
 * form), so asymmetric two-label is worse than uniform single-label.
 */
export default function ClicksColumns({ data, range }: { data: RangeData; range: RangeKey }) {
  return (
    <div style={{ borderBottom: '1px solid #1f1f1f' }}>
      <div style={{ padding: '18px 0', display: 'flex', gap: '20px' }}>
        <Column title="Top listings by clicks" rows={data.topListings} accent="pink" range={range} />
        <Column title="Top wishes by clicks" rows={data.topWishes} accent="mint" range={range} />
      </div>
      <div style={{ padding: '18px 0', display: 'flex', gap: '20px', borderTop: '1px solid #1f1f1f' }}>
        <TopBlock label="#1 listing" topRow={data.topListing} emptyText="No listings yet" />
        <TopBlock label="#1 gifter" topRow={data.topGifter} emptyText="No gifts yet" />
      </div>
    </div>
  )
}

function Column({ title, rows, accent, range }: {
  title: string
  rows: { name: string; count: number; pct: number }[]
  accent: 'pink' | 'mint'
  range: RangeKey
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px', textAlign: 'left' }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: '11px', color: '#444' }}>No clicks yet</div>
      ) : (
        rows.map((r, i) => <Row key={`${range}-${i}-${r.name}`} row={r} accent={accent} range={range} />)
      )}
    </div>
  )
}

function TopBlock({ label, topRow, emptyText }: {
  label: string
  topRow: TopRow | null
  emptyText: string
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: 8, letterSpacing: '0.2px' }}>{label}</div>
      {topRow ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '12px' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {topRow.name}
            </div>
            <div style={{ fontSize: '10px', color: '#777', marginTop: 2 }}>{topRow.meta}</div>
          </div>
          <div style={{ color: '#fff', fontWeight: 600, flexShrink: 0 }}>{topRow.amount_formatted}</div>
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: '#444' }}>{emptyText}</div>
      )}
    </div>
  )
}

function Row({ row, accent, range }: {
  row: { name: string; count: number; pct: number }
  accent: 'pink' | 'mint'
  range: RangeKey
}) {
  const fillRef = useRef<HTMLDivElement | null>(null)

  // Re-animate from 0 → target on mount and whenever the range
  // changes (mockup applyDataset() lines 755-758: width set to 0
  // then via rAF to data-target%).
  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    el.style.width = '0'
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.width = `${row.pct}%` })
    })
    return () => cancelAnimationFrame(raf)
  }, [range, row.pct])

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: '11px',
        marginBottom: '5px',
        gap: '6px',
      }}>
        <div style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: '#fff', fontWeight: 700 }}>{row.name}</span>
        </div>
        <span style={{ color: '#fff', fontWeight: 700, flexShrink: 0 }}>{row.count.toLocaleString('en-US')}</span>
      </div>
      <div className="an-pbar" style={{ marginBottom: '12px' }}>
        <div ref={fillRef} className={`an-pbar-fill ${accent === 'pink' ? 'an-pink' : 'an-mint'}`} />
      </div>
    </>
  )
}
