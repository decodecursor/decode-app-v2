'use client'

/**
 * Statement line row — 2-line structure shared between Listings and
 * Wishes sections. Mirrors mockup payout_statement_final.html lines
 * 104-113 (listings) / 157-166 (wishes), CSS class `.pd-line` lines
 * 38-44.
 *
 * Container: `padding:14px 0; border-bottom:1px solid #1f1f1f;
 * :last-child border-bottom:none`.
 *
 * Top row (`.pd-row`): flex justify-between align-items center —
 * primary name 13px/700 LEFT + NET amount 14px/600 RIGHT (the
 * ambassador's share, the "headline" number per row).
 *
 * Bottom row (`.pd-row.pd-row-bottom`): flex justify-between, margin-
 * top 2px — subtitle 10px #777 LEFT (package descriptor + date for
 * listings, gifter + date for wishes) + GROSS amount 10px #666
 * RIGHT (what was charged before the platform fee).
 *
 * Showing both NET and GROSS per row is a deliberate spec deviation
 * from the analytics overlay version which only shows NET — the
 * dedicated mockup is the authoritative truth per Slice 6B
 * line-by-line protocol.
 */
export default function LineRow({ topLeft, topRight, bottomLeft, bottomRight, isLast }: {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
  isLast: boolean
}) {
  return (
    <div style={{
      padding: '14px 0',
      borderBottom: isLast ? 'none' : '1px solid #1f1f1f',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{topLeft}</div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{topRight}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <div style={{ fontSize: '10px', color: '#777' }}>{bottomLeft}</div>
        <div style={{ fontSize: '10px', color: '#666' }}>{bottomRight}</div>
      </div>
    </div>
  )
}
