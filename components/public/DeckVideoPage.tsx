'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxChrome } from './LightboxChrome'

/**
 * Video page within the lightbox deck. TikTok-style interaction model:
 *  - <video> always mounts muted. iOS Safari never blocks or rate-limits
 *    muted autoplay, so the play() promise effectively can't reject and
 *    there's no "autoplay-blocked" affordance to surface.
 *  - Tap toggles mute on the current video (no play/pause button). The
 *    only way to stop playback is to close the lightbox.
 *  - A small bottom-right indicator shows current mute state so tap is
 *    visibly acknowledged (status feedback, not a control).
 *
 * Mount-on-active is preserved for the <video> element — exactly one
 * decoder slot in use across the deck regardless of length. Persistent
 * <img> base layer below the <video> kills any black flash on swipe.
 *
 * Mute is local to each slide (not deck-wide) — by spec, every <video>
 * mount is muted=true. State resets on each isCurrent flip so the
 * indicator stays in sync with the freshly-mounted video element.
 */
export function DeckVideoPage({
  listing,
  isCurrent,
  onClose,
}: {
  listing: PublicListingRow
  isCurrent: boolean
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Tracks the live <video>.muted property for the indicator. Initial
  // value matches the hardcoded `muted` JSX attr below; reset whenever
  // isCurrent flips so a freshly-mounted <video> (which is always muted)
  // doesn't visually disagree with stale state from the prior visit.
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    if (isCurrent) setMuted(true)
  }, [isCurrent])

  // Drive play when the <video> mounts (isCurrent flips true). Mount-
  // on-active means the element only exists in the DOM while focused;
  // unmount on swipe-away frees the iOS decoder slot automatically.
  // Muted autoplay always succeeds on iOS, so no autoplay-blocked
  // fallback. We still retry on canplay for the case where readyState
  // is too low at the first play() attempt (videos without
  // moov-at-start / faststart encoding).
  useEffect(() => {
    const v = videoRef.current
    if (!v || !isCurrent) return

    let cancelled = false
    let canplayHandler: (() => void) | null = null

    v.play().catch(() => {
      if (cancelled) return
      if (v.readyState < 3) {
        canplayHandler = () => {
          if (cancelled) return
          v.play().catch(() => { /* muted autoplay shouldn't reject */ })
        }
        v.addEventListener('canplay', canplayHandler, { once: true })
      }
    })

    return () => {
      cancelled = true
      if (canplayHandler) v.removeEventListener('canplay', canplayHandler)
    }
  }, [isCurrent])

  // Tap → toggle mute on the current video. Updates state so the
  // indicator (and LightboxChrome's mute control) re-renders.
  const onVideoTap = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {/* Persistent base layer — <img> stays mounted whether this slide
          is current or not. The active <video> overlays it on isCurrent,
          so swiping to a slide can't reveal an empty/black moment
          between <img> unmount and <video> mount. */}
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

      {isCurrent && listing.video_url && (
        <video
          ref={videoRef}
          src={listing.video_url}
          loop
          playsInline
          muted
          preload="auto"
          poster={listing.video_thumbnail_url ?? undefined}
          onClick={onVideoTap}
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
        onToggleMute={onVideoTap}
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
