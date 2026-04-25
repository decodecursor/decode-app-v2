'use client'

import { useRouter } from 'next/navigation'
import type { Direction, FunnelMetric, RangeData } from './types'

/**
 * Middle section of the Analytics page: 3-tile funnel
 * (Visits → Clicks → Gifts) + two click-by columns (listings | wishes).
 * Two columns are tappable blocks per spec §2.10 — the entire column
 * navigates to /listings or /wishlist.
 */
export default function BreakdownSection({ data }: { data: RangeData }) {
  return (
    <>
      <FunnelTiles funnel={data.funnel} />
      <ClicksColumns topListings={data.topListings} topWishes={data.topWishes} />
    </>
  )
}

function FunnelTiles({ funnel }: { funnel: RangeData['funnel'] }) {
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '1px solid #1f1f1f',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <Tile label="Page visits" metric={funnel.visits} />
      <Chevron />
      <Tile label="Clicks" metric={funnel.clicks} />
      <Chevron />
      <Tile label="Gifts" metric={funnel.gifts} />
    </div>
  )
}

function Tile({ label, metric }: { label: string; metric: FunnelMetric }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '11px', color: '#666' }}>{label}</div>
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.2px', color: '#fff' }}>
          {metric.value}
        </div>
        <TrendBadge metric={metric} />
      </div>
    </div>
  )
}

function TrendBadge({ metric }: { metric: FunnelMetric }) {
  if (metric.direction === 'flat') {
    return <div style={{ fontSize: '9px', color: '#777' }}>·</div>
  }
  const color = metric.direction === 'up' ? '#34d399' : '#ef4444'
  const arrow = metric.direction === 'up' ? '↑' : '↓'
  return (
    <div style={{ fontSize: '9px', color, fontWeight: 600 }}>
      {arrow} {metric.trend}%
    </div>
  )
}

function Chevron() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  )
}

function ClicksColumns({ topListings, topWishes }: {
  topListings: RangeData['topListings']
  topWishes: RangeData['topWishes']
}) {
  const router = useRouter()
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '1px solid #1f1f1f',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '18px',
    }}>
      <Column title="Clicks by listings" rows={topListings} accent="#e91e8c" onTap={() => router.push('/model/listings')} />
      <Column title="Clicks by wishes" rows={topWishes} accent="#34d399" onTap={() => router.push('/model/wishlist')} />
    </div>
  )
}

function Column({ title, rows, accent, onTap }: {
  title: string
  rows: { name: string; count: number; pct: number }[]
  accent: string
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: '11px', color: '#444' }}>No clicks yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map((r, i) => (
            <div key={`${r.name}-${i}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {r.name}
                </span>
                <span style={{ fontSize: '11px', color: '#777' }}>{r.count}</span>
              </div>
              <div style={{ height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${r.pct}%`,
                  height: '100%',
                  background: accent,
                  transition: 'width 600ms cubic-bezier(.2,.7,.2,1)',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

// silence unused type imports in lints — Direction is part of the type surface
export type { Direction }
