'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PublicPageData } from '@/lib/public/slug-page-shape'
import { PublicHeader } from './PublicHeader'
import { SquadRow } from './SquadRow'
import { MediaLightbox } from './MediaLightbox'
import { PublicFooter } from './PublicFooter'

/**
 * Public page orchestrator. Renders cover + My Beauty Squad (listings)
 * + footer. Tapping a squad-row play button opens the MediaLightbox for
 * that listing.
 *
 * V1 scope (Slice 4A locked decision #4): Wishlist + Wall of Love
 * deliberately not rendered. When no listings exist, shows a neutral
 * empty-state message — the ambassador's self-view sees this too, no
 * special owner UI (matches ambassador dashboard conventions).
 *
 * Slice 4D: fires public_page_view analytics on mount + click events
 * on child interactions. Server dedupes via analyticsLimiter so
 * Strict-Mode double-mount in dev doesn't inflate counts.
 */
export default function PublicPageClient({
  data,
  shareUrl,
}: {
  data: PublicPageData
  shareUrl: string
}) {
  const [openListingId, setOpenListingId] = useState<string | null>(null)

  const openListing = useMemo(
    () => data.listings.find((l) => l.id === openListingId) ?? null,
    [data.listings, openListingId],
  )

  useEffect(() => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'public_page_view',
        slug: data.profile.slug,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
  }, [data.profile.slug])

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
        background: '#000',
        color: '#fff',
        minHeight: '100vh',
      }}
    >
      <PublicHeader profile={data.profile} shareUrl={shareUrl} />

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>My Beauty Squad</div>

        {data.listings.length === 0 ? (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              fontSize: 13,
              color: '#666',
            }}
          >
            No listings yet
          </div>
        ) : (
          data.listings.map((l, i) => (
            <SquadRow
              key={l.id}
              listing={l}
              slug={data.profile.slug}
              isLast={i === data.listings.length - 1}
              onOpenMedia={setOpenListingId}
            />
          ))
        )}
      </div>

      <PublicFooter />

      {openListing && (
        <MediaLightbox
          listing={openListing}
          onClose={() => setOpenListingId(null)}
        />
      )}
    </div>
  )
}
