'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { RangeData, RangeKey } from './types'

/**
 * Two side-by-side columns: "Clicks by listings" + "Clicks by
 * wishes". Mirrors mockup lines 179-216. Section padding 18px 0 +
 * border-bottom 1px #1f1f1f, flex gap 20px. Each column is a
 * tappable block (cursor pointer, navigates to /model/listings or
 * /model/wishlist). Inside each column: section label, then up to
 * 3 click rows with a single-label name + count + 3px progress bar
 * that grows from 0 to data-target % over 1500ms cubic-bezier
 * (.2,.7,.2,1) (CSS lines 8-12). Below the rows, a divider + a
 * "Top listing" / "Top gifter" row (12px/600 name + 10px/777 meta +
 * 12px/600 amount) per mockup lines 187-196 / 204-213.
 *
 * Click-row two-label structure (mockup `cat · pro`) is superseded
 * to single-label uniform on both columns — per Slice 6A polish
 * judgment call 1: schema doesn't support category on wishes
 * (Slice 5A locked decision A omitted IG + category from the wish
 * form), so asymmetric two-label is worse than uniform single-label.
 * Visual parity is preserved; only the row content is single-line.
 */
export default function ClicksColumns({ data, range }: { data: RangeData; range: RangeKey }) {
  const router = useRouter()
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '1px solid #1f1f1f',
      display: 'flex',
      gap: '20px',
    }}>
      <Column
        title="Clicks by listings"
        rows={data.topListings}
        accent="pink"
        topRowLabel="Top listing"
        topRow={data.topListing}
        onTap={() => router.push('/model/listings')}
        range={range}
      />
      <Column
        title="Clicks by wishes"
        rows={data.topWishes}
        accent="mint"
        topRowLabel="Top gifter"
        topRow={data.topGifter}
        onTap={() => router.push('/model/wishlist')}
        range={range}
      />
    </div>
  )
}

function Column({ title, rows, accent, topRowLabel, topRow, onTap, range }: {
  title: string
  rows: { name: string; count: number; pct: number }[]
  accent: 'pink' | 'mint'
  topRowLabel: string
  topRow: { name: string; meta: string; amount_formatted: string } | null
  onTap: () => void
  range: RangeKey
}) {
  return (
    <div onClick={onTap} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px', textAlign: 'left' }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: '11px', color: '#444' }}>No clicks yet</div>
      ) : (
        rows.map((r, i) => <Row key={`${range}-${i}-${r.name}`} row={r} accent={accent} range={range} />)
      )}
      <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #1f1f1f' }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textAlign: 'left' }}>{topRowLabel}</div>
        {topRow ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
            <div style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{topRow.name}</div>
              <div style={{ fontSize: '10px', color: '#777', marginTop: '2px', textAlign: 'left' }}>{topRow.meta}</div>
            </div>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600, flexShrink: 0 }}>
              {topRow.amount_formatted}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#444' }}>
            {topRowLabel === 'Top listing' ? 'No listings yet' : 'No gifts yet'}
          </div>
        )}
      </div>
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
