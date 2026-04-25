'use client'

import type { RangeData } from './types'

/**
 * Top section of the Analytics page: total + sparkline + breakdown +
 * next-payout. SVG chart paths are pre-computed server-side per Slice
 * 6 locked decision #7 (raw SVG, no charting library) — client just
 * renders the strings.
 */
export default function EarningsChart({ data }: { data: RangeData }) {
  const { total_formatted, chart, breakdown } = data
  const hasChart = chart.line !== null && chart.fill !== null

  return (
    <div style={{ padding: '18px 0', borderBottom: '1px solid #1f1f1f' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
        <div style={{ fontSize: '11px', color: '#666' }}>Total earnings</div>
      </div>
      <div style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-0.4px', color: '#fff', marginBottom: '12px' }}>
        {total_formatted}
      </div>

      {hasChart ? (
        <svg width="100%" viewBox="0 0 280 48" preserveAspectRatio="none" style={{ display: 'block', height: '48px' }}>
          <defs>
            <linearGradient id="anGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e91e8c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#e91e8c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={chart.fill ?? ''} fill="url(#anGradient)" />
          <path d={chart.line ?? ''} stroke="#e91e8c" strokeWidth="1.5" fill="none" />
        </svg>
      ) : (
        <div style={{ height: '48px', display: 'flex', alignItems: 'center', color: '#444', fontSize: '11px' }}>
          No earnings yet in this range
        </div>
      )}

      <BreakdownBar
        listingsPct={breakdown.listings_pct}
        wishesPct={breakdown.wishes_pct}
        listingsFmt={breakdown.listings_formatted}
        wishesFmt={breakdown.wishes_formatted}
      />
    </div>
  )
}

function BreakdownBar({ listingsPct, wishesPct, listingsFmt, wishesFmt }: {
  listingsPct: number
  wishesPct: number
  listingsFmt: string
  wishesFmt: string
}) {
  const isEmpty = listingsPct === 0 && wishesPct === 0
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>Breakdown</div>
      <div style={{
        display: 'flex',
        gap: '4px',
        height: '6px',
        marginBottom: '10px',
        opacity: isEmpty ? 0.3 : 1,
      }}>
        <div style={{
          width: isEmpty ? '50%' : `${listingsPct}%`,
          background: '#e91e8c',
          borderRadius: '3px',
          transition: 'width 600ms cubic-bezier(.2,.7,.2,1)',
        }} />
        <div style={{
          width: isEmpty ? '50%' : `${wishesPct}%`,
          background: '#34d399',
          borderRadius: '3px',
          transition: 'width 600ms cubic-bezier(.2,.7,.2,1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#e91e8c', marginRight: '6px', verticalAlign: 'middle' }} />
          <span style={{ fontSize: '11px', color: '#777' }}>Listings</span>{' '}
          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{listingsFmt}</span>
        </div>
        <div>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', marginRight: '6px', verticalAlign: 'middle' }} />
          <span style={{ fontSize: '11px', color: '#777' }}>Gifts</span>{' '}
          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{wishesFmt}</span>
        </div>
      </div>
    </div>
  )
}
