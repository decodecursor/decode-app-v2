'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'
import { MediaOrb } from './MediaOrb'

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
  isOrbActive,
  onOrbActivate,
  onOrbDeactivate,
  registerOrbRef,
}: {
  listing: PublicListingRow
  slug: string
  isLast: boolean
  onOpenMedia: (listingId: string) => void
  isOrbActive: boolean
  onOrbActivate: () => void
  onOrbDeactivate: () => void
  registerOrbRef: (el: HTMLElement | null) => void
}) {
  // onOrbActivate is retained on the type for future re-introduction.
  // Hybrid orb mode (tap → lightbox, IO → inline play) doesn't need it.
  // Flagged for cleanup.
  void onOrbActivate
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
          width: 72,
          height: 72,
          borderRadius: '50%',
          padding: 3,
          background: 'linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 100%)',
          flexShrink: 0,
          boxSizing: 'border-box',
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'block',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: '#000',
            border: '3px solid #1c1c1c',
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
        </div>
      </a>

      {/* Category + name + location */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: 1,
            color: '#e91e8c',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 2.5,
          }}
        >
          {categoryText(listing)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, marginBottom: 1.5 }}>
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
        <div style={{ fontSize: 13, color: '#777', lineHeight: 1.2 }}>{formatLocation(listing.professional_city, listing.professional_country)}</div>
      </div>

      {/* Media orb — inline video playback for video listings, lightbox
          carousel for photo listings. data-orb-id keeps the page-level
          IntersectionObserver tied back to the listing row. */}
      <div ref={registerOrbRef} data-orb-id={listing.id} style={{ flexShrink: 0 }}>
        <MediaOrb
          videoUrl={listing.media_type === 'video' ? listing.video_url : null}
          posterUrl={
            listing.media_type === 'video'
              ? null
              : (listing.photo_url_1 ?? null)
          }
          hasPhotos={listing.media_type === 'photos' && !!listing.photo_url_1}
          isActive={isOrbActive}
          onTap={onMediaClick}
          onScrollPause={onOrbDeactivate}
          ariaLabel={`Play preview of ${listing.professional_name}`}
        />
      </div>
    </div>
  )
}
