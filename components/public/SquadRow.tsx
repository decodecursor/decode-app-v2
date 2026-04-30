'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'

/**
 * A single listing row in the "My Beauty Squad" list. Three tap targets:
 *   - professional avatar → Instagram (fires listing_instagram_click)
 *   - professional name → Instagram (fires listing_instagram_click)
 *   - play-button circle → opens the media lightbox (fires listing_media_click)
 *
 * Spec: public_page_final_UI_Spec.md §4.2.
 * Mockup: public_page_final.html lines 30-76.
 *
 * Analytics fires via /api/analytics/track with keepalive:true so the
 * request survives the target=_blank navigation (belt-and-suspenders —
 * the nav opens in a new tab anyway, so the current page stays open).
 * Server silently dedupes via analyticsLimiter (1/30s per IP+event).
 */
function fireClick(slug: string, event_type: 'listing_instagram_click' | 'listing_media_click', target_id: string) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type, slug, target_id }),
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ })
}

export function SquadRow({
  listing,
  slug,
  isLast,
  onOpenMedia,
}: {
  listing: PublicListingRow
  slug: string
  isLast: boolean
  onOpenMedia: (listingId: string) => void
}) {
  const igUrl = `https://instagram.com/${listing.professional_instagram}`
  const onIgClick = () => fireClick(slug, 'listing_instagram_click', listing.id)
  const onMediaClick = () => {
    fireClick(slug, 'listing_media_click', listing.id)
    onOpenMedia(listing.id)
  }

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
      {/* Avatar — links to Instagram. Slice 7C item 35 fix 3: aria-label
          gives screen readers a discernible name for the link, since the
          child <img> has alt="" (decorative — name is in the sibling <a>
          below, but the avatar itself was an unlabeled link). The name-
          link below already has its own text content so it's accessible
          without an aria-label. */}
      <a
        href={igUrl}
        target="_blank"
        rel="noopener"
        onClick={onIgClick}
        aria-label={`Visit ${listing.professional_name} on Instagram`}
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
            onClick={onIgClick}
            style={{ color: '#fff', textDecoration: 'none' }}
          >
            {listing.professional_name}
          </a>
        </div>
        <div style={{ fontSize: 12, color: '#777' }}>{formatLocation(listing.professional_city, listing.professional_country)}</div>
      </div>

      {/* Play button — opens lightbox */}
      <div
        onClick={onMediaClick}
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
