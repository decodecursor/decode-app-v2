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
 * Mount-on-active: each DeckVideoPage mounts its <video> element only
 * while it's the current slide; non-current slides render the cached
 * server-side thumbnail. Single decoder element guarantee — iOS Safari's
 * 4-6 simultaneous decoder ceiling can't be hit no matter how long the
 * deck is.
 *
 * Mute state lives here (deck-wide) so a tap on slide 1 to unmute also
 * unmutes slide 2 when the user swipes. Initial value is true so muted
 * autoplay always succeeds on lightbox open. Tap on the current slide
 * routes to onToggleMute and flips the shared state.
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
  // Deck-wide mute. Starts true so every <video> first-mounts muted
  // (iOS muted autoplay never rejects). Tap on the current slide flips
  // it for all subsequent slides — the user only has to unmute once.
  const [muted, setMuted] = useState(true)
  const onToggleMute = useCallback(() => setMuted((m) => !m), [])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map())
  // Skip the initial-mount currentIndex fire — the orb that opened the
  // deck is the one whose squad_media_swipe_view event already counted
  // on the public page. Only deck-internal swipes count here.
  const swipeViewSkipFirstRef = useRef(true)

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
  )
}
