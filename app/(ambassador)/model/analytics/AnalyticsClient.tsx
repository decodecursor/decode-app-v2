'use client'

import { useEffect, useState } from 'react'
import FilterTabs from './FilterTabs'
import BackArrow from '@/components/ambassador/BackArrow'
import EarningsChart from './EarningsChart'
import BreakdownSection from './BreakdownSection'
import NextPayoutSection from './NextPayoutSection'
import FunnelTiles from './FunnelTiles'
import ClicksColumns from './ClicksColumns'
import type { AnalyticsResponse, RangeKey } from './types'

/**
 * Client-side orchestrator for the Analytics page. Per spec §2.2:
 * single GET on mount, dataset swap on filter-tab tap (no network
 * call). Decomposed sub-components (Slice 6A polish restructure):
 * <FilterTabs>, <EarningsChart>, <BreakdownSection>, <NextPayoutSection>,
 * <FunnelTiles>, <ClicksColumns>.
 *
 * Phone-frame chrome (mockup `#anPage` line 6) wraps the sections:
 * 375px width, #000 bg, 2px #1a1a1a border, 24px radius,
 * overflow:hidden. Header padding 16px 20px 20px (line 82); tabs
 * pad 0 20px 20px (line 88); content sections live inside an inner
 * `padding:0 20px` wrapper (line 95); bottom spacer 24px 20px 20px
 * (line 220).
 *
 * Animations CSS lives in a single inline `<style>` block at the
 * page root — class names are `an-`-prefixed to avoid collision
 * with anything else in the app:
 *   .an-chart-line / .an-chart-line.an-show — stroke-dasharray draw-in
 *     1800ms cubic-bezier(.2,.7,.2,1) (mockup CSS lines 19-21)
 *   .an-chart-fill / .an-chart-fill.an-show — opacity 0→1 over 1000ms
 *     ease 800ms-delay (mockup CSS lines 22-23)
 *   .an-split-pink / .an-split-mint — width 0→target over 1500ms
 *     cubic-bezier(.2,.7,.2,1) (mockup CSS lines 14-17)
 *   .an-pbar / .an-pbar-fill — 3px height progress bar; fill grows
 *     0→target over 1500ms cubic-bezier(.2,.7,.2,1) (mockup CSS
 *     lines 8-12)
 */
export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<RangeKey>('week')

  useEffect(() => {
    let cancelled = false
    fetch('/api/ambassador/model/analytics', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Analytics fetch failed (${res.status})`)
        return res.json() as Promise<AnalyticsResponse>
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{
      width: '100%',
      margin: '0 auto',
      background: '#000',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
    }}>
      <style>{`
        .an-chart-line { stroke-dasharray: 1000; stroke-dashoffset: 1000; transition: stroke-dashoffset 1800ms cubic-bezier(.2,.7,.2,1) }
        .an-chart-line.an-show { stroke-dashoffset: 0 }
        .an-chart-fill { opacity: 0; transition: opacity 1000ms ease 800ms }
        .an-chart-fill.an-show { opacity: 1 }
        .an-split-pink { background: #e91e8c; width: 0; transition: width 1500ms cubic-bezier(.2,.7,.2,1) }
        .an-split-mint { background: #34d399; width: 0; transition: width 1500ms cubic-bezier(.2,.7,.2,1) }
        .an-pbar { height: 3px; border-radius: 2px; background: #262626; overflow: hidden; position: relative }
        .an-pbar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; width: 0; transition: width 1500ms cubic-bezier(.2,.7,.2,1) }
        .an-pbar-fill.an-pink { background: #e91e8c }
        .an-pbar-fill.an-mint { background: #34d399 }
      `}</style>

      <Header />
      <FilterTabs active={active} onChange={setActive} />

      {error && (
        <div style={{ padding: '32px 20px', color: '#ef4444', fontSize: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!data && !error && <Skeleton />}

      {data && (
        <>
          <div style={{ padding: '0 20px' }}>
            <EarningsChart data={data[active]} range={active} />
            <BreakdownSection data={data[active]} range={active} />
            <NextPayoutSection />
            <FunnelTiles funnel={data[active].funnel} />
            <ClicksColumns data={data[active]} range={active} />
          </div>
          <div style={{ padding: '24px 20px 20px' }} />
        </>
      )}
    </div>
  )
}

function Header() {
  return (
    <div style={{
      padding: '36px 20px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <BackArrow fallbackHref="/model" />
      <span style={{ fontSize: '20px', fontWeight: 700 }}>Analytics</span>
    </div>
  )
}

function Skeleton() {
  return (
    <>
      <style>{`@keyframes an-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      <div style={{ padding: '0 20px 20px' }}>
        {[80, 48, 60, 120].map((h, i) => (
          <div
            key={i}
            style={{
              height: `${h}px`,
              background: '#0f0f0f',
              borderRadius: '8px',
              marginBottom: '14px',
              animation: 'an-pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    </>
  )
}
