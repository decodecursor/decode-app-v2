'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import HeroCard from './HeroCard'
import LineRow from './LineRow'
import type { StatementResponse } from '../types'

/**
 * Statement detail page orchestrator. Mirrors mockup
 * payout_statement_final.html top-level structure.
 *
 * Phone-frame chrome (line 10 #pdPage): identical to #poPage on the
 * list page (375px / #000 / 2px #1a1a1a / 24px radius / overflow
 * hidden).
 *
 * Header (lines 51-54): padding 16px 20px 20px, gap 12px, back-arrow
 * with `transform:scale(0.9)` on :active. Title "Statement" 20px/700.
 *
 * Listings section (lines 97-148) and Wishes section (lines 150-189)
 * both indent at 40px (page padding 20px + extra 20px) so rows align
 * with the hero card's inner content edge.
 *
 * Sub-components:
 *   - HeroCard: the #1c1c1c card (lines 57-95)
 *   - LineRow: 2-line listing/wish row (NET top, GROSS bottom)
 *
 * Copy-to-clipboard interaction (CSS lines 23-36, script 228-263)
 * lives here because the copied state belongs to the page, not the
 * card — ensures cleanup on unmount works on the orchestrator's
 * lifecycle.
 */
export default function StatementClient({ payoutId }: { payoutId: string }) {
  const router = useRouter()
  const [data, setData] = useState<StatementResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ambassador/model/payouts/${encodeURIComponent(payoutId)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 404) throw new Error('Payout not found')
        if (!res.ok) throw new Error(`Statement fetch failed (${res.status})`)
        return res.json() as Promise<StatementResponse>
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => {
      cancelled = true
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [payoutId])

  const onBack = () => {
    if (window.history.length > 1) router.back()
    else router.push('/model/payouts')
  }

  const onCopy = async () => {
    if (!data) return
    const ref = data.payout_reference
    try {
      await navigator.clipboard.writeText(ref)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = ref
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* swallow — optimistic UX per spec §7 */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{
      width: '375px',
      maxWidth: '100%',
      margin: '0 auto',
      background: '#000',
      border: '2px solid #1a1a1a',
      borderRadius: '24px',
      overflow: 'hidden',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        .pd-back { cursor: pointer; transition: transform 0.05s }
        .pd-back:active { transform: scale(0.9) }
        .pd-copybtn { transition: background-color 0.15s ease }
        .pd-copybtn:hover { background-color: #262626 }
      `}</style>

      <Header onBack={onBack} />

      {error && (
        <div style={{ padding: '32px 20px', color: '#ef4444', fontSize: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!data && !error && <Skeleton />}

      {data && (
        <>
          <HeroCard data={data} copied={copied} onCopy={onCopy} />
          {data.listings.length > 0 && <ListingsSection rows={data.listings} />}
          {data.wishes.length > 0 && <WishesSection rows={data.wishes} />}
          <div style={{ padding: '20px' }} />
        </>
      )}
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      padding: '16px 20px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <svg
        onClick={onBack}
        className="pd-back"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="button"
        aria-label="Back"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      <span style={{ fontSize: '20px', fontWeight: 700 }}>Statement</span>
    </div>
  )
}

function ListingsSection({ rows }: { rows: StatementResponse['listings'] }) {
  return (
    <>
      <div style={{ padding: '4px 40px 0' }}>
        <div style={{
          fontSize: '10px',
          color: '#666',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          margin: '8px 0 6px',
        }}>
          Listings
        </div>
      </div>
      <div style={{ padding: '0 40px' }}>
        {rows.map((r, i) => (
          <LineRow
            key={`${i}-${r.professional_name}`}
            topLeft={r.professional_name}
            topRight={r.net_amount_formatted}
            bottomLeft={r.subtitle}
            bottomRight={r.gross_amount_formatted}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>
    </>
  )
}

function WishesSection({ rows }: { rows: StatementResponse['wishes'] }) {
  return (
    <>
      <div style={{ padding: '4px 40px 0' }}>
        <div style={{
          fontSize: '10px',
          color: '#666',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          margin: '18px 0 6px',
        }}>
          Wishes
        </div>
      </div>
      <div style={{ padding: '0 40px 4px' }}>
        {rows.map((r, i) => (
          <LineRow
            key={`${i}-${r.service_name}`}
            topLeft={r.service_name}
            topRight={r.net_amount_formatted}
            bottomLeft={r.subtitle}
            bottomRight={r.gross_amount_formatted}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>
    </>
  )
}

function Skeleton() {
  return (
    <>
      <style>{`@keyframes pd-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      <div style={{ padding: '0 20px 20px' }}>
        {[180, 120, 120].map((h, i) => (
          <div
            key={i}
            style={{
              height: `${h}px`,
              background: '#1c1c1c',
              borderRadius: '14px',
              marginBottom: '16px',
              animation: 'pd-pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    </>
  )
}
