'use client'

import { useEffect, useState } from 'react'
import type { RangeData, RangeKey } from './types'

type TopRow = { name: string; meta: string; amount_formatted: string }

/**
 * Two stacked bands of side-by-side columns:
 *   Band 1 — "Top listings by clicks" + "Top wishes by clicks": up
 *     to 3 click rows each rendered in the dashboard's exact cat·pro
 *     format (12px/600/#fff primary · 9px/#666 dot · 9px/#888
 *     secondary, 11px/600/#fff count, 2px pink bar with #3a3a3a
 *     track, animated via CSS background-size transition).
 *   Band 2 — "#1 listing" + "#1 gifter": single highest-earner row
 *     per side (12px/600 name, 10px/777 meta, 12px/600 amount).
 *
 * Hoisted #1 band lives in a sibling row (not inside each column) so
 * the #1 sub-headers stay y-aligned across columns regardless of
 * click-row count variance — earlier per-column structure jumped
 * vertically when listings had 3 rows and wishes had 2.
 *
 * Row shape is unified `{ category, name?, count, pct }` across both
 * columns. Field semantics: listings put real category + professional
 * name; wishes put service_name + professional_name (nullable — when
 * absent, the secondary span and dot are omitted, leaving just the
 * primary label). Earlier Slice 6A "uniform single-label both
 * columns" judgment call superseded by the dashboard cat·pro lock;
 * earlier Slice 6B-1 listings-cat·pro / wishes-name-only asymmetry
 * superseded by partner explicit "wishes match listings".
 */
export default function ClicksColumns({ data, range }: { data: RangeData; range: RangeKey }) {
  return (
    <div style={{ borderBottom: '1px solid #1f1f1f' }}>
      <div style={{ padding: '18px 0', display: 'flex', gap: '20px' }}>
        <Column title="Top listings by clicks" rows={data.topListings} range={range} />
        <Column title="Top wishes by clicks" rows={data.topWishes} range={range} />
      </div>
      <div style={{ padding: '18px 0', display: 'flex', gap: '20px', borderTop: '1px solid #1f1f1f' }}>
        <TopBlock label="#1 listing" topRow={data.topListing} emptyText="No listings yet" />
        <TopBlock label="#1 gifter" topRow={data.topGifter} emptyText="No gifts yet" />
      </div>
    </div>
  )
}

function Column({ title, rows, range }: {
  title: string
  rows: { category: string; name: string | null; count: number; pct: number }[]
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
        rows.map((r, i) => <Row key={`${range}-${i}-${r.category}-${r.name ?? ''}`} row={r} />)
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

function Row({ row }: {
  row: { category: string; name: string | null; count: number; pct: number }
}) {
  // `name` is nullable for wishes that have no professional attached;
  // when absent we render just the primary label (no dot, no
  // secondary span). Listings always have a name (professional name).
  const hasName = row.name != null && row.name !== ''

  // Bar grows from 0% → pct% on mount via the rAF-flip pattern from
  // DashboardClient.tsx:58-67 + 268-280. Initial render uses 0%; the
  // effect flips `loaded` to true on the next frame, swapping the
  // backgroundSize value, which the CSS `transition` then animates
  // over 1500ms. Re-mount on range change re-runs the animation
  // because the Column keys each Row by `${range}-…`.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const barSize = loaded ? `${row.pct}% 100%, 100% 100%` : '0% 100%, 100% 100%'

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '12px',
        marginBottom: '3px',
      }}>
        <span style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
            {row.category}
          </span>
          {hasName && (
            <>
              <span style={{ fontSize: '9px', color: '#666', margin: '0 5px' }}>
                ·
              </span>
              <span style={{ fontSize: '9px', color: '#888' }}>
                {row.name}
              </span>
            </>
          )}
        </span>
        <span style={{
          fontSize: '11px',
          color: '#fff',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {row.count.toLocaleString('en-US')}
        </span>
      </div>
      {/* Dashboard-style 2px bar (DashboardClient.tsx:305-311): solid
          pink fill on a #3a3a3a track, animated via background-size.
          Layered backgroundImage gives the track + fill effect without
          an extra DOM node. Re-animates on range change because the
          parent Column key includes range, forcing a fresh mount. */}
      <div style={{
        height: '2px',
        backgroundImage: 'linear-gradient(#e91e8c,#e91e8c),linear-gradient(#3a3a3a,#3a3a3a)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: barSize,
        transition: 'background-size 1500ms cubic-bezier(.2,.7,.2,1)',
        marginBottom: '10px',
      }} />
    </>
  )
}
