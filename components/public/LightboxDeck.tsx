'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { DeckVideoPage } from './DeckVideoPage'
import { DeckPhotoPage } from './DeckPhotoPage'

/**
 * Vertical scroll-snap deck of listing pages. One page per listing.
 * Native CSS scroll-snap drives the swipe — no JS gesture handlers.
 * IntersectionObserver tracks which page is centered to drive the
 * single-active video play/pause rule (only the focused page's video
 * plays).
 *
 * Single shared <video> rendered at the deck wrapper level — its `src`
 * swaps via effect when currentIndex changes. Element identity is
 * preserved across slides so the iOS user-gesture for unmuted playback
 * (the user's tap-to-unmute) remains valid for the whole session: every
 * subsequent src swap inherits v.muted=false without iOS asking for a
 * fresh per-element gesture. This is what fix attempt 1 (lifted state +
 * per-slide <video>) couldn't deliver — iOS treats each freshly-mounted
 * <video> as needing its own gesture even with muted=false from props.
 *
 * The shared element also caps decoder usage at exactly one slot
 * regardless of deck length — Yanni's 6-video deck on iPhone Safari
 * can't approach the 4-6 simultaneous-decoder ceiling.
 *
 * Slide pages render only their thumbnail <img> + LightboxChrome.
 * Z-stacking inside the deck wrapper:
 *   - Slide thumbnail <img>     z:auto (paints first)
 *   - Shared <video>            z:0    (covers thumbnails on video slides)
 *   - LightboxChrome scrims     z:1    (translucent gradient overlays)
 *   - Info bar / photo dots     z:2
 *   - Mute / close buttons      z:4
 *   - MuteIndicator (slide)     z:4
 *   - Right-edge dot column     z:5    (deck-wide page indicator)
 *
 * Photo slides hide the shared <video> via visibility:hidden +
 * pointer-events:none so the photo's own content stays visible and its
 * tap targets reachable.
 */
export function LightboxDeck({
  listings,
  initialListingId,
  slug,
  onClose,
}: {
  listings: PublicListingRow[]
  initialListingId: string | null
  slug: string
  onClose: () => void
}) {
  const initialIndex = useMemo(() => {
    if (!initialListingId) return 0
    const idx = listings.findIndex((l) => l.id === initialListingId)
    return idx >= 0 ? idx : 0
  }, [listings, initialListingId])

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  // Deck-wide mute. Starts true so the very first src+autoplay always
  // satisfies iOS's muted-autoplay-only policy. After the user's first
  // tap to unmute, v.muted=false sticks for every subsequent src swap
  // because the underlying <video> element is the same instance.
  const [muted, setMuted] = useState(true)
  const onToggleMute = useCallback(() => setMuted((m) => !m), [])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Skip the initial-mount currentIndex fire — the orb that opened the
  // deck is the one whose squad_media_swipe_view event already counted
  // on the public page. Only deck-internal swipes count here.
  const swipeViewSkipFirstRef = useRef(true)

  const currentListing = listings[currentIndex]
  const videoSrc =
    currentListing?.media_type === 'video' ? (currentListing.video_url ?? null) : null

  // Land on the tapped listing's page on mount. 'instant' avoids a
  // visible scroll animation. Without this, the deck always starts at
  // page 0 regardless of which orb opened it.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.clientHeight * initialIndex, behavior: 'instant' as ScrollBehavior })
  }, [initialIndex])

  const registerPageRef = useCallback((idx: number, el: HTMLElement | null) => {
    if (el) pageRefs.current.set(idx, el)
    else pageRefs.current.delete(idx)
  }, [])

  // IntersectionObserver picks the page with greatest visible overlap
  // ratio. At scroll-snap settle exactly one page has ratio ~1; during
  // swipe animation the picker tracks which page is becoming dominant.
  // Mirrors the public-page MediaOrb orchestrator pattern (live DOM
  // measurement on every fire, not stale entries — see 7015fa4).
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      () => {
        let bestIdx = 0
        let bestRatio = -1
        const rootRect = root.getBoundingClientRect()
        pageRefs.current.forEach((el, idx) => {
          const rect = el.getBoundingClientRect()
          const overlap = Math.max(
            0,
            Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top),
          )
          const ratio = overlap / rootRect.height
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestIdx = idx
          }
        })
        setCurrentIndex(bestIdx)
      },
      {
        root,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    pageRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [listings])

  // Drive the shared <video>'s src + playback. Same element across
  // slides → audio gesture (the user's tap-to-unmute) persists; setting
  // a new src just continues playback on the persisted element. canplay
  // retry covers the case where readyState is too low at the first
  // play() attempt (videos without moov-at-start / faststart encoding).
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    if (!videoSrc) {
      v.pause()
      if (v.getAttribute('src')) {
        v.removeAttribute('src')
        v.load()
      }
      return
    }

    // src setter accepts relative URLs but reading v.src returns the
    // resolved absolute URL — compare the attribute, not the property.
    if (v.getAttribute('src') !== videoSrc) {
      v.src = videoSrc
      v.load()
    }

    let cancelled = false
    let canplayHandler: (() => void) | null = null

    v.play().catch(() => {
      if (cancelled) return
      if (v.readyState < 3) {
        canplayHandler = () => {
          if (cancelled) return
          v.play().catch(() => { /* unmuted autoplay may reject — see comment in DeckVideoPage */ })
        }
        v.addEventListener('canplay', canplayHandler, { once: true })
      }
    })

    return () => {
      cancelled = true
      if (canplayHandler) v.removeEventListener('canplay', canplayHandler)
    }
  }, [videoSrc])

  // squad_media_swipe_view — fires on deck-internal swipe to a new
  // page. Initial mount lands on the orb that opened the deck (already
  // counted on the public page) and is skipped via the ref above.
  useEffect(() => {
    if (swipeViewSkipFirstRef.current) {
      swipeViewSkipFirstRef.current = false
      return
    }
    const listing = listings[currentIndex]
    if (!listing) return
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'squad_media_swipe_view',
        slug,
        target_id: listing.id,
      }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
  }, [currentIndex, listings, slug])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={containerRef}
        className="lb-deck"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {listings.map((listing, idx) => (
          <div
            key={listing.id}
            ref={(el) => registerPageRef(idx, el)}
            style={{
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              flexShrink: 0,
              position: 'relative',
              background: '#000',
            }}
          >
            {listing.media_type === 'video' ? (
              <DeckVideoPage
                listing={listing}
                isCurrent={idx === currentIndex}
                muted={muted}
                onToggleMute={onToggleMute}
                onClose={onClose}
              />
            ) : (
              <DeckPhotoPage listing={listing} onClose={onClose} />
            )}
          </div>
        ))}

        {/* Right-edge dot column (hidden if only 1 listing). Fixed-position
            so it stays put as the deck scrolls. Pointer-events none — purely
            informational, no tap-to-jump. */}
        {listings.length > 1 && (
          <div
            style={{
              position: 'fixed',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 5,
              pointerEvents: 'none',
            }}
          >
            {listings.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: i === currentIndex ? '#e91e8c' : '#444',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        )}

        <style>{`.lb-deck::-webkit-scrollbar{display:none}`}</style>
      </div>

      {/* Shared <video> — single persistent element across slide swipes
          so the user's audio-unmute gesture remains valid for the
          session. src is set imperatively in the effect above; React's
          controlled `muted` prop syncs v.muted on every toggle. */}
      <video
        ref={videoRef}
        muted={muted}
        autoPlay
        loop
        playsInline
        poster={currentListing?.video_thumbnail_url ?? undefined}
        onClick={onToggleMute}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          background: '#000',
          visibility: videoSrc ? 'visible' : 'hidden',
          pointerEvents: videoSrc ? 'auto' : 'none',
        }}
      />
    </div>
  )
}
