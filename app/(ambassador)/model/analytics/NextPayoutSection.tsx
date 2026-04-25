'use client'

import { useRouter } from 'next/navigation'

/**
 * Next payout summary + "View payouts →" link. Mirrors mockup
 * lines 125-135. Section padding 18px 0 + border-bottom 1px #1f1f1f,
 * flex justify-content space-between align-items flex-end.
 *
 * Slice 6A ships the section frame + the link. Real payout amount/
 * date data wires in 6B (mockup hardcodes `$340 / Wednesday`); for
 * now the empty state reads "No upcoming payout". The link points
 * to /model/payouts (404 until 6B accepted) per Slice 5D Gift-it
 * pill precedent (route landed before /pay/[token] wish dispatch).
 */
export default function NextPayoutSection() {
  const router = useRouter()
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
        <div style={{ fontSize: '13px', color: '#777' }}>
          No upcoming payout
        </div>
      </div>
      <button
        onClick={() => router.push('/model/payouts')}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: '13px',
          color: '#e91e8c',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        View payouts →
      </button>
    </div>
  )
}
