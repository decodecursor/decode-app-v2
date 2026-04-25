'use client'

import type { RangeData } from './types'

/**
 * Bottom section of the Analytics page: top listing card + top gifter
 * card. Both display-only per spec §1.2 — the parent Column block
 * tap-target navigates to /listings or /wishlist; the cards
 * themselves don't have independent tap targets.
 */
export default function TopCards({ data }: { data: RangeData }) {
  return (
    <div style={{
      padding: '18px 0',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
    }}>
      <Card label="Top listing" empty="No listings yet">
        {data.topListing && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.topListing.name}
            </div>
            <div style={{ fontSize: '11px', color: '#777' }}>
              {data.topListing.amount_formatted}
            </div>
          </>
        )}
      </Card>
      <Card label="Top gifter" empty="No gifts yet">
        {data.topGifter && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.topGifter.name}
            </div>
            <div style={{ fontSize: '11px', color: '#777' }}>
              {data.topGifter.gift_count} {data.topGifter.gift_count === 1 ? 'gift' : 'gifts'} · {data.topGifter.amount_formatted}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function Card({ label, empty, children }: {
  label: string
  empty: string
  children: React.ReactNode
}) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div style={{
      background: '#1c1c1c',
      borderRadius: '14px',
      padding: '14px 16px',
      minHeight: '76px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>{label}</div>
      {hasContent ? children : (
        <div style={{ fontSize: '11px', color: '#444' }}>{empty}</div>
      )}
    </div>
  )
}
