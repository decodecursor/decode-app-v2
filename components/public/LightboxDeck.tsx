'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { mediaPool } from '@/lib/public/media-pool'
import { formatLocation } from '@/lib/format-location'
import { DeckVideoPage } from './DeckVideoPage'
import { DeckPhotoPage } from './DeckPhotoPage'

/**
 * Vertical scroll-snap deck of listing pages. One page per listing.
 * Native CSS scroll-snap drives the swipe — no JS gesture handlers on
 * mobile. Mouse wheel on desktop is handled explicitly so each tick
 * advances one slide instead of accumulating native scroll deltas.
 *
 * Layout:
 *   - Outer wrapper (position:absolute, inset:0) fills the parent —
 *     which is MediaLightbox's 420px constrained frame on desktop, or
 *     the full viewport on mobile.
 *   - Pool host + lb-deck (scroll container) are SIBLINGS inside the
 *     wrapper, both position:absolute inset:0. Pool host stays put
 *     while slides scroll inside lb-deck — same effect as the prior
 *     position:fixed approach, but contained to the constrained frame
 *     instead of leaking to the full viewport on desktop.
 *   - Close + mute buttons + dot column are also wrapper children at
 *     position:absolute, so they ride with the constrained frame
 *     (left/right anchors land on the frame's edges, not the viewport's).
 *
 * Video playback is delegated to a singleton MediaPool (lib/public/
 * media-pool.ts) holding two pre-blessed <video> elements. Pool elements
 * are appended to the pool host on mount and detached on unmount so
 * blessing carries to the next lightbox open.
 *
 * Z-stacking inside MediaLightbox's stacking context:
 *   - Slide thumbnail <img>     z:auto
 *   - LightboxChrome scrims     z:1
 *   - Photo dot indicator       z:2
 *   - Pool <video> (host div)   z:3
 *   - Info bar (per slide)      z:4   ← above pool video so the avatar
 *                                       / name / IG / category remain
 *                                       visible during playback
 *   - Close + mute buttons      z:4
 *   - Right-edge deck dots      z:5
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
  // Deck-wide mute. Starts true so muted autoplay always succeeds on
  // open. Tap on the visible video flips it; pool.setMuted syncs both
  // elements so subsequent src swaps inherit the user's choice.
  const [muted, setMuted] = useState(true)
  const onToggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      mediaPool.setMuted(next)
      return next
    })
  }, [])
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const poolHostRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map())
  // Track which pool slot ('a' or 'b') currently holds the visible
  // video so we know which one to preload-next on.
  const activeSlotRef = useRef<'a' | 'b'>('a')
  // Skip the initial-mount currentIndex fire — the orb that opened the
  // deck is the one whose squad_media_swipe_view event already counted
  // on the public page. Only deck-internal swipes count here.
  const swipeViewSkipFirstRef = useRef(true)

  const currentListing = listings[currentIndex]
  const currentVideoSrc =
    currentListing?.media_type === 'video' ? (currentListing.video_url ?? null) : null

  // Append pool <video> elements to the host div on mount; detach on
  // unmount (without destroying — pool persists for the tab lifetime
  // so blessing carries to the next lightbox open).
  useEffect(() => {
    const host = poolHostRef.current
    if (!host) return
    const { a, b } = mediaPool.ensureElements()

    const baseStyle = (el: HTMLVideoElement, visible: boolean) => {
      el.style.position = 'absolute'
      el.style.inset = '0'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.objectFit = 'cover'
      el.style.background = '#000'
      el.style.visibility = visible ? 'visible' : 'hidden'
      el.style.pointerEvents = visible ? 'auto' : 'none'
    }
    baseStyle(a, true)
    baseStyle(b, false)

    a.muted = muted
    b.muted = muted

    const onTap = () => onToggleMute()
    a.addEventListener('click', onTap)
    b.addEventListener('click', onTap)

    host.appendChild(a)
    host.appendChild(b)

    return () => {
      a.removeEventListener('click', onTap)
      b.removeEventListener('click', onTap)
      a.pause()
      b.pause()
      if (a.parentElement === host) host.removeChild(a)
      if (b.parentElement === host) host.removeChild(b)
    }
    // muted/onToggleMute intentionally outside deps — element setup is
    // mount-once; later mute changes are pushed via mediaPool.setMuted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // IntersectionObserver picks the page with greatest visible overlap.
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
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    pageRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [listings])

  // Mouse wheel on desktop: advance one slide per tick. Native CSS
  // scroll-snap responds to wheel but accumulates many small ticks
  // before snapping, which feels wrong for a TikTok-style deck. We
  // attach to the wrapper (parent of pool host + lb-deck) so wheel
  // events that hit the playing pool video also bubble here. Scroll is
  // applied programmatically on lb-deck.
  useEffect(() => {
    const wrapper = wrapperRef.current
    const root = containerRef.current
    if (!wrapper || !root) return

    let lastWheelMs = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 5) return
      e.preventDefault()
      const now = Date.now()
      if (now - lastWheelMs < 350) return
      lastWheelMs = now
      const delta = e.deltaY > 0 ? 1 : -1
      const newIdx = Math.max(0, Math.min(listings.length - 1, currentIndex + delta))
      if (newIdx !== currentIndex) {
        root.scrollTo({ top: root.clientHeight * newIdx, behavior: 'smooth' })
      }
    }

    wrapper.addEventListener('wheel', onWheel, { passive: false })
    return () => wrapper.removeEventListener('wheel', onWheel)
  }, [currentIndex, listings.length])

  // Drive pool playback as currentIndex changes. setVisible routes the
  // current slide's URL to whichever slot already has it loaded
  // (rotating the active slot for instant playback) or loads it on the
  // preferred slot. The other slot then preloads the next slide's URL
  // ahead of the user's swipe.
  useEffect(() => {
    const a = mediaPool.getElement('a')
    const b = mediaPool.getElement('b')
    if (!a || !b) return

    if (!currentVideoSrc) {
      // Photo slide. Hide both pool elements; DeckPhotoPage owns the
      // visual. pauseAll frees decoder slots while user views photos.
      a.style.visibility = 'hidden'
      a.style.pointerEvents = 'none'
      b.style.visibility = 'hidden'
      b.style.pointerEvents = 'none'
      mediaPool.pauseAll()
      return
    }

    // Set visible on the slot that has currentVideoSrc loaded already
    // (preloaded from a prior swipe), or fall back to the slot opposite
    // the previously-active one.
    const preferredSlot: 'a' | 'b' = activeSlotRef.current === 'a' ? 'b' : 'a'
    const activeSlot = mediaPool.setVisible(currentVideoSrc, preferredSlot)
    activeSlotRef.current = activeSlot

    const activeEl = activeSlot === 'a' ? a : b
    const inactiveEl = activeSlot === 'a' ? b : a
    activeEl.style.visibility = 'visible'
    activeEl.style.pointerEvents = 'auto'
    inactiveEl.style.visibility = 'hidden'
    inactiveEl.style.pointerEvents = 'none'

    // Preload the next listing's video on the inactive slot so the next
    // swipe is instant. Skip if next is a photo or out of range.
    const next = listings[currentIndex + 1]
    if (next?.media_type === 'video' && next.video_url) {
      mediaPool.preload(activeSlot === 'a' ? 'b' : 'a', next.video_url)
    }
  }, [currentVideoSrc, currentIndex, listings])

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
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0 }}>
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
        {/* Pool host — first child of the scroll container so the pool
            <video> elements have lb-deck as a DOM ancestor. Touch on a
            visible pool video routes vertical scroll to lb-deck (the
            nearest scrollable ancestor) — this is what makes mobile
            swipe work. position:fixed on the host means it stays put
            visually while slides scroll inside lb-deck; its containing
            block resolves to MediaLightbox's constrained frame
            (ConstrainedFrame's `transform` makes it the containing
            block for descendant fixed elements per CSS spec), so the
            pool fills the 420px column on desktop and the full
            viewport on mobile. z:3 sits above slide thumbnails
            (z:auto) and chrome scrims (z:1); info bar + close + mute
            (all z:4) and the deck dot column (z:5) paint above. */}
        <div
          ref={poolHostRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />

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
              />
            ) : (
              <DeckPhotoPage listing={listing} />
            )}
          </div>
        ))}
      </div>

      {/* Deck-level info bar — Instagram link with avatar / name /
          category / location. Reads currentListing so it updates on
          swipe; rendered at the wrapper level (NOT inside per-slide
          chrome) because iOS Safari's overflow-scrolling compositing
          layer hides per-slide z:4 elements behind the pool video on
          mobile (visible on desktop, missing on mobile pre-fix).
          Outside the scroll container, no compositing-layer issue. */}
      {currentListing && <DeckInfoBar listing={currentListing} slug={slug} />}

      {/* Right-edge dot column (hidden if only 1 listing). Pure
          informational, no tap-to-jump. position:absolute now (was
          fixed) so it anchors to the constrained frame on desktop. */}
      {listings.length > 1 && (
        <div
          style={{
            position: 'absolute',
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

      {/* Deck-level chrome: close (always) + mute (video slides only).
          position:absolute relative to the wrapper so the buttons sit
          at the constrained-frame's top corners — not the viewport's
          edges — on desktop. Per-slide drift is impossible because
          they're outside lb-deck's scroll container. */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        role="button"
        aria-label="Close lightbox"
        style={{
          position: 'absolute',
          top: 54,
          right: 18,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 4,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      {currentVideoSrc && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
          role="button"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          style={{
            position: 'absolute',
            top: 54,
            left: 18,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 4,
          }}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </div>
      )}

      <style>{`.lb-deck::-webkit-scrollbar{display:none}`}</style>
    </div>
  )
}

function DeckInfoBar({ listing, slug }: { listing: PublicListingRow; slug: string }) {
  const igUrl = `https://instagram.com/${listing.professional_instagram}`
  const initials = listing.professional_name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')

  return (
    <a
      href={igUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.stopPropagation()
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'listing_instagram_click',
            slug,
            target_id: listing.id,
          }),
          keepalive: true,
        }).catch(() => { /* fire-and-forget */ })
      }}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0 18px 22px',
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1.5px solid #e91e8c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: '#000',
          boxSizing: 'border-box',
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
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{initials}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
          {listing.professional_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: '#e91e8c', fontWeight: 600 }}>
            {categoryText(listing)}
          </span>
          <span style={{ fontSize: 11, color: '#888' }}>·</span>
          <span style={{ fontSize: 11, color: '#888' }}>{formatLocation(listing.professional_city, listing.professional_country)}</span>
        </div>
      </div>
    </a>
  )
}
