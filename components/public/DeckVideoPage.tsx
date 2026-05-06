'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxChrome } from './LightboxChrome'

/**
 * Video page within the lightbox deck. Mount-on-active: the <video>
 * element only exists in the DOM while this page is the current slide.
 * Non-current slides render <img src={video_thumbnail_url}> (or fall
 * back to the page's #000 background when the thumbnail URL is NULL).
 *
 * Why mount-on-active and not eager-prefetch ±1: iOS Safari has a
 * hard ceiling on simultaneous video decoder slots (4-6 depending on
 * device). Yanni's deck has 6 video listings, so the previous
 * isHydrated=±1 window kept up to 3 <video> elements alive at once
 * and the last 2-3 swipes failed to start playback. Single-element
 * guarantee → no decoder pressure.
 *
 * The trade-off is a brief load on swipe-to: poster (server-side
 * first frame) paints instantly, then metadata + first decoded frame
 * replace it once playback begins.
 *
 * Mute is controlled by parent (LightboxDeck) — shared across all
 * video pages in the same session, so unmuting one persists to the
 * next.
 *
 * Tap-anywhere on the video toggles mute (TikTok pattern). The mute
 * button in LightboxChrome's top-left also routes to onToggleMute.
 *
 * iOS hardening:
 *  - playsInline + muted=true on first play (browser autoplay policy)
 *  - .catch() on play() promise → autoplayBlocked=true → tap-to-play
 *    overlay (mirrors the previous LightboxVideo pattern — file deleted
 *    in this commit, behavior preserved here).
 *  - play() retry on canplay if readyState was too low at first
 *    attempt — common on iOS when video mounts and play() races
 *    metadata fetch on slower-encoded videos.
 *
 * Reduced-motion: skip play() entirely; force the tap-to-play overlay
 * so the user must opt-in. Deck navigation still works.
 */
export function DeckVideoPage({
  listing,
  isCurrent,
  isMuted,
  onToggleMute,
  onClose,
}: {
  listing: PublicListingRow
  isCurrent: boolean
  isMuted: boolean
  onToggleMute: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  // Drive play when the <video> mounts (isCurrent flips true). Mount-
  // on-active means the element only exists in the DOM while focused;
  // unmount on swipe-away frees the iOS decoder slot automatically.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (!isCurrent) return
    if (reducedMotion) {
      setAutoplayBlocked(true)
      return
    }

    setAutoplayBlocked(false)

    let cancelled = false
    let canplayHandler: (() => void) | null = null

    const tryPlay = () => {
      if (cancelled) return
      v.play().catch(() => {
        if (cancelled) return
        if (v.readyState < 3 && !canplayHandler) {
          canplayHandler = () => {
            if (cancelled) return
            v.play().catch(() => setAutoplayBlocked(true))
          }
          v.addEventListener('canplay', canplayHandler, { once: true })
        } else {
          setAutoplayBlocked(true)
        }
      })
    }

    tryPlay()

    return () => {
      cancelled = true
      if (canplayHandler) {
        v.removeEventListener('canplay', canplayHandler)
      }
    }
  }, [isCurrent, reducedMotion])

  // Tap on the video → toggle mute (TikTok pattern).
  // If currently autoplay-blocked, the same tap should attempt play().
  const onVideoTap = () => {
    const v = videoRef.current
    if (!v) return
    if (autoplayBlocked) {
      v.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => { /* leave overlay up */ })
      return
    }
    onToggleMute()
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
          muted={isMuted}
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

      {autoplayBlocked && isCurrent && (
        <div
          onClick={onVideoTap}
          role="button"
          aria-label="Play video"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onVideoTap()
            }
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '1.5px solid #e91e8c',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxSizing: 'border-box',
            zIndex: 3,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="#fff"
            stroke="none"
          >
            <polygon points="7 4 20 12 7 20 7 4" stroke="#1c1c1c" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <LightboxChrome
        listing={listing}
        isVideo={true}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onClose={onClose}
        slidesCount={1}
        activeIdx={0}
        onJumpSlide={() => { /* no-op for video */ }}
      />
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  const [pref, setPref] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPref(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setPref(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return pref
}
