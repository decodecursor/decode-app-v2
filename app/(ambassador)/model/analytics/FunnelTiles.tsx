'use client'

import type { FunnelMetric, RangeData } from './types'

/**
 * 3-tile funnel: Page visits → Clicks → Gifts. Mirrors mockup lines
 * 137-177. Section padding 18px 0 + border-bottom 1px #1f1f1f, flex
 * align-items stretch. Each tile flex:1 text-align center: label
 * (11px #666) + count (22px/700 -0.2px letter-spacing) + trend
 * (9px/600). Down trend uses #e91e8c (NOT red) per mockup line 173.
 * Between tiles: explicit chevron containers (24px wide) holding a
 * 14×14 SVG polyline (#666 stroke, width 2.5).
 */
export default function FunnelTiles({ funnel }: { funnel: RangeData['funnel'] }) {
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
          {metric.value.toLocaleString('en-US')}
        </div>
        <TrendChip metric={metric} />
      </div>
    </div>
  )
}

function TrendChip({ metric }: { metric: FunnelMetric }) {
  if (metric.direction === 'flat') {
    return <div style={{ fontSize: '9px', color: '#777', fontWeight: 600 }}>· 0%</div>
  }
  // Mockup line 173: down trend uses #e91e8c (pink), NOT red.
  const color = metric.direction === 'up' ? '#34d399' : '#e91e8c'
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
