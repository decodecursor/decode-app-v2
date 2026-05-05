'use client'

import { useEffect, useRef } from 'react'
import { useCountUp } from '@/components/ambassador/useCountUp'
import type { RangeData, RangeKey, TrendValue } from './types'

/**
 * Total earnings + sparkline + x-axis labels. Mirrors mockup lines
 * 97-110 — section padding-bottom 18px with bottom border, total
 * 28px/700/-0.3px with inline trend chip (gap 5px, baseline-aligned),
 * then a 280×48 SVG with stroke-dasharray draw-in (1800ms) + opacity
 * fade-in (1000ms with 800ms delay) per CSS lines 19-23, then
 * x-axis labels (10px #777, justify space-between) line 109.
 *
 * Chart line + fill animations re-trigger on filter swap by toggling
 * the `show` class via the `range` key prop.
 */
export default function EarningsChart({ data, range }: { data: RangeData; range: RangeKey }) {
  const lineRef = useRef<SVGPathElement | null>(null)
  const fillRef = useRef<SVGPathElement | null>(null)
  const animatedTotal = useCountUp(data.total_formatted)
  const trendChip = formatTrend(data.total_trend)

  // Class-toggle to re-trigger CSS transitions: remove .show on the
  // range change → next frame add .show back. Matches mockup
  // applyDataset() pattern (lines 750-754).
  useEffect(() => {
    const line = lineRef.current
    const fill = fillRef.current
    if (line) line.classList.remove('an-show')
    if (fill) fill.classList.remove('an-show')
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (line) line.classList.add('an-show')
        if (fill) fill.classList.add('an-show')
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [range])

  const hasChart = data.chart.line !== null && data.chart.fill !== null

  return (
    <div style={{ paddingBottom: '18px', borderBottom: '1px solid #1f1f1f' }}>
      <div style={{ fontSize: '11px', color: '#666', textAlign: 'left' }}>Total earnings</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.3px', color: '#fff' }}>
          {animatedTotal}
        </div>
        <div style={{ fontSize: '11px', color: trendChip.color, fontWeight: 600 }}>
          {trendChip.text}
        </div>
      </div>

      {hasChart ? (
        <svg viewBox="0 0 280 48" style={{ width: '100%', height: '48px', marginTop: '14px', display: 'block' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="anGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e91e8c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#e91e8c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path ref={fillRef} className="an-chart-fill" d={data.chart.fill ?? ''} fill="url(#anGradient)" />
          <path ref={lineRef} className="an-chart-line" d={data.chart.line ?? ''} stroke="#e91e8c" strokeWidth="1.5" fill="none" />
        </svg>
      ) : (
        <div style={{ height: '48px', marginTop: '14px', display: 'flex', alignItems: 'center', color: '#444', fontSize: '11px' }}>
          No earnings yet
        </div>
      )}

      {hasChart && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#777', marginTop: '6px' }}>
          {data.chart.xLabels.map((l, i) => <span key={`${i}-${l}`}>{l}</span>)}
        </div>
      )}
    </div>
  )
}

function formatTrend(t: TrendValue): { text: string; color: string } {
  if (t.direction === 'up')   return { text: `↑ ${t.trend}%`, color: '#34d399' }
  if (t.direction === 'down') return { text: `↓ ${t.trend}%`, color: '#e91e8c' }
  return { text: '· 0%', color: '#777' }
}
