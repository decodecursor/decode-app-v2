'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxChrome } from './LightboxChrome'

/**
 * Video page within the lightbox deck. Renders only the persistent
 * thumbnail <img> (base layer) plus per-slide LightboxChrome (scrims +
 * info bar). The actual <video> playback is owned by LightboxDeck via
 * the singleton media pool — one of the two pool elements is positioned
 * over the active slide and src-swapped on swipe, so element identity
 * (and the iOS user-activation gesture) persists for the entire
 * lightbox session.
 *
 * Close + mute buttons live at the LightboxDeck wrapper level (fixed-
 * positioned to the viewport so they don't drift with slide scroll).
 * The bottom-right mute indicator was removed entirely — pure TikTok
 * feedback model where the audio change itself is the feedback.
 */
export function DeckVideoPage({
  listing,
  isCurrent,
}: {
  listing: PublicListingRow
  isCurrent: boolean
}) {
  // isCurrent retained on the type for future re-introduction (e.g.
  // pre-render-only-active behaviors). Not used today since the pool
  // owns playback orchestration via currentIndex in LightboxDeck.
  void isCurrent

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

      <LightboxChrome
        listing={listing}
        isVideo={true}
        slidesCount={1}
        activeIdx={0}
        onJumpSlide={() => { /* no-op for video */ }}
      />
    </div>
  )
}
