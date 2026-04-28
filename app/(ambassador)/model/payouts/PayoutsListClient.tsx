'use client'

import { useEffect, useState } from 'react'
import NextPayoutCard from './NextPayoutCard'
import HistoryCard from './HistoryCard'
import type { PayoutsListResponse } from './types'
import BackArrow from '@/components/ambassador/BackArrow'

/**
 * Client-side orchestrator for the Payouts list page. Mirrors mockup
 * payouts_list_final.html top-level structure.
 *
 * Phone-frame chrome (line 10 #poPage): 375px width, #000 bg, 2px
 * #1a1a1a border, 24px radius, overflow:hidden — same chrome
 * pattern as the Slice 6A Analytics page.
 *
 * Header (lines 28-32): padding 16px 20px 20px, gap 12px. Back-arrow
 * 22×22 #fff stroke 2 with `transform:scale(0.9)` on :active (CSS
 * lines 12-13). Title "Payouts" 20px/700.
 *
 * Back behavior (script lines 152-157): history.back() with
 * fallback to /model/analytics — same chain as the in-page "View
 * payouts →" link landing here.
 *
 * Empty state (decision ζ): when API returns is_empty=true, hide
 * both the next-payout card and the history card and show "No
 * payouts yet" + 11px subtitle "Your first payout appears here once
 * you earn your first commission".
 */
export default function PayoutsListClient() {
  const [data, setData] = useState<PayoutsListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/ambassador/model/payouts', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Payouts fetch failed (${res.status})`)
        return res.json() as Promise<PayoutsListResponse>
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
    }}>
      <style>{`
        .po-row:hover { background-color: #262626 }
      `}</style>

      <Header />

      {error && (
        <div style={{ padding: '32px 20px', color: '#ef4444', fontSize: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!data && !error && <Skeleton />}

      {data && data.is_empty && <EmptyState />}

      {data && !data.is_empty && (
        <>
          {data.next_payout && <NextPayoutCard next={data.next_payout} />}
          {data.history.length > 0 && (
            <HistoryCard rows={data.history} totalFormatted={data.history_total_formatted} />
          )}
        </>
      )}

      <div style={{ padding: '20px' }} />
    </div>
  )
}

function Header() {
  return (
    <div className="amb-internal-header" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <BackArrow fallbackHref="/model/analytics" />
      <span style={{ fontSize: '20px', fontWeight: 700 }}>Payouts</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '24px 20px 48px', textAlign: 'center' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
        No payouts yet
      </div>
      <div style={{ fontSize: '11px', color: '#777', lineHeight: 1.6, maxWidth: '260px', margin: '0 auto' }}>
        Your first payout appears here once you earn your first commission
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <>
      <style>{`@keyframes po-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      <div style={{ padding: '0 20px 20px' }}>
        {[120, 220].map((h, i) => (
          <div
            key={i}
            style={{
              height: `${h}px`,
              background: '#1c1c1c',
              borderRadius: '14px',
              marginBottom: '16px',
              animation: 'po-pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    </>
  )
}
