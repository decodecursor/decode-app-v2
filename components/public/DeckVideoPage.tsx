'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxChrome } from './LightboxChrome'

/**
 * Video page within the lightbox deck. Renders only the slide visual
 * (persistent thumbnail <img> as base layer + LightboxChrome + bottom-
 * right MuteIndicator). The actual <video> element is owned by
 * LightboxDeck via the singleton media pool — one of the two pool
 * elements is positioned over the active slide and src-swapped on
 * swipe, so element identity (and the iOS user-activation gesture)
 * persists for the entire lightbox session.
 *
 * Mute state and toggle handler are passed in from LightboxDeck so the
 * chrome mute button reflects the deck-wide state. Tapping anywhere on
 * the slide region falls through to the pool video's click listener
 * (registered in LightboxDeck), which routes to the same handler.
 */
export function DeckVideoPage({
  listing,
  isCurrent,
  muted,
  onToggleMute,
  onClose,
}: {
  listing: PublicListingRow
  isCurrent: boolean
  muted: boolean
  onToggleMute: () => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {listing.video_thumbnail_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={listing.video_thumbnail_url}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {isCurrent && <MuteIndicator muted={muted} />}

      <LightboxChrome
        listing={listing}
        isVideo={true}
        isMuted={muted}
        onToggleMute={onToggleMute}
        onClose={onClose}
        slidesCount={1}
        activeIdx={0}
        onJumpSlide={() => { /* no-op for video */ }}
      />
    </div>
  )
}

function MuteIndicator({ muted }: { muted: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
        pointerEvents: 'none',
      }}
    >
      {muted ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3l2.7-2.7-1.42-1.41L15.17 10.59 12.46 7.88l-1.41 1.41L13.76 12l-2.7 2.71 1.41 1.41 2.7-2.7 2.7 2.7 1.42-1.41L16.59 12z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      )}
    </div>
  )
}
