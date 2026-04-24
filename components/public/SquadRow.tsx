'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText, locationText } from '@/lib/public/slug-page-shape'

/**
 * A single listing row in the "My Beauty Squad" list. Three tap targets:
 *   - professional avatar → Instagram
 *   - professional name → Instagram
 *   - play-button circle → opens the media lightbox
 *
 * Spec: public_page_final_UI_Spec.md §4.2.
 * Mockup: public_page_final.html lines 30-76.
 *
 * Analytics (listing_instagram / listing_media click events) land in
 * Slice 4D — anchors are plain <a target="_blank"> for now; play button
 * invokes the onOpenMedia callback, no fetch.
 */
export function SquadRow({
  listing,
  isLast,
  onOpenMedia,
}: {
  listing: PublicListingRow
  isLast: boolean
  onOpenMedia: (listingId: string) => void
}) {
  const igUrl = `https://instagram.com/${listing.professional_instagram}`

  return (
    <div
      style={{
        padding: '14px 0',
        borderTop: '1px solid #1a1a1a',
        borderBottom: isLast ? '1px solid #1a1a1a' : undefined,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}
    >
      {/* Avatar — links to Instagram */}
      <a
        href={igUrl}
        target="_blank"
        rel="noopener"
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#333',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          textDecoration: 'none',
          overflow: 'hidden',
        }}
      >
        {listing.professional_avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.professional_avatar_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 11, color: '#777' }}>Photo</span>
        )}
      </a>

      {/* Category + name + location */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1,
            color: '#e91e8c',
            fontWeight: 700,
            marginBottom: 3,
          }}
        >
          {categoryText(listing)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
          <a
            href={igUrl}
            target="_blank"
            rel="noopener"
            style={{ color: '#fff', textDecoration: 'none' }}
          >
            {listing.professional_name}
          </a>
        </div>
        <div style={{ fontSize: 12, color: '#777' }}>{locationText(listing)}</div>
      </div>

      {/* Play button — opens lightbox */}
      <div
        onClick={() => onOpenMedia(listing.id)}
        style={{
          background: '#000',
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1.5px solid #e91e8c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e91e8c"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="7 4 20 12 7 20 7 4" />
        </svg>
      </div>
    </div>
  )
}
