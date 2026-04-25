'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import FilterTabs from './FilterTabs'
import EarningsChart from './EarningsChart'
import BreakdownSection from './BreakdownSection'
import TopCards from './TopCards'
import type { AnalyticsResponse, RangeKey } from './types'

/**
 * Client-side orchestrator for the Analytics page. Per spec §2.2:
 * single GET on mount, dataset swap on filter-tab tap (no network
 * call), no skeleton row taps. Decomposed children:
 * <FilterTabs>, <EarningsChart>, <BreakdownSection>, <TopCards>.
 *
 * Per Slice 6 locked decision E (item 25 partial close), this
 * orchestrator stays under 300 LOC by delegating each section to its
 * own file. The orchestrator's responsibilities: filter state, fetch,
 * loading/error rendering, and section composition.
 */
export default function AnalyticsClient() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<RangeKey>('week')

  useEffect(() => {
    let cancelled = false
    fetch('/api/ambassador/model/analytics', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Analytics fetch failed (${res.status})`)
        }
        return res.json() as Promise<AnalyticsResponse>
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{
      maxWidth: '375px',
      margin: '0 auto',
      padding: '20px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <Header onBack={() => router.push('/model')} />
      <FilterTabs active={active} onChange={setActive} />

      {error && (
        <div style={{ padding: '32px 0', color: '#ef4444', fontSize: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!data && !error && <Skeleton />}

      {data && (
        <>
          <EarningsChart data={data[active]} />
          <NextPayoutPlaceholder />
          <BreakdownSection data={data[active]} />
          <TopCards data={data[active]} />
        </>
      )}
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label="Back to dashboard"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Analytics</h1>
    </div>
  )
}

function NextPayoutPlaceholder() {
  // Slice 6A wires the route only; payout summary lives in Slice 6B.
  // This placeholder shows the section frame so the layout stays
  // consistent and lights up when 6B lands.
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '1px solid #1f1f1f',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: '#666', textAlign: 'left', marginBottom: '6px' }}>
          Next payout
        </div>
        <div style={{ fontSize: '13px', color: '#444' }}>
          Available in Slice 6B
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  const block = (h: number) => (
    <div style={{
      height: `${h}px`,
      background: '#0f0f0f',
      borderRadius: '8px',
      marginBottom: '14px',
      animation: 'analyticsPulse 1.4s ease-in-out infinite',
    }} />
  )
  return (
    <div style={{ paddingTop: '18px' }}>
      <style>{`@keyframes analyticsPulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      {block(80)}
      {block(48)}
      {block(60)}
      {block(120)}
    </div>
  )
}
