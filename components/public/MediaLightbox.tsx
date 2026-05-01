'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxChrome } from './LightboxChrome'
import { LightboxVideo } from './LightboxVideo'
import { LightboxCarousel } from './LightboxCarousel'

/**
 * Full-screen media overlay for a single listing. Thin orchestrator —
 * owns shared state (isMuted, activeIdx) and wires together the three
 * presentational children:
 *   - LightboxVideo (video media_type)
 *   - LightboxCarousel (photos media_type, 1-3 images)
 *   - LightboxChrome (scrims, close, mute, dots, info bar — always)
 *
 * Keyboard: Esc closes, ←/→ nav slides (photos), M toggles mute (video).
 * Body scroll is locked for the lifetime of the overlay.
 *
 * Spec: public_media_lightbox_final_UI_Spec.md.
 * Analytics (lightbox_opened, instagram_click) deferred to Slice 4D.
 */
export function MediaLightbox({
  listing,
  onClose,
}: {
  listing: PublicListingRow
  onClose: () => void
}) {
  const slides = useMemo(() => {
    if (listing.media_type === 'video' && listing.video_url) return [listing.video_url]
    return [listing.photo_url_1, listing.photo_url_2, listing.photo_url_3].filter(Boolean) as string[]
  }, [listing.media_type, listing.video_url, listing.photo_url_1, listing.photo_url_2, listing.photo_url_3])

  const isVideo = listing.media_type === 'video'
  const [isMuted, setIsMuted] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const carouselRef = useRef<HTMLDivElement | null>(null)

  const jumpSlide = useCallback((i: number) => {
    const c = carouselRef.current
    if (!c) return
    c.scrollTo({ left: i * c.offsetWidth, behavior: 'smooth' })
  }, [])

  const navSlide = useCallback((dir: -1 | 1) => {
    const c = carouselRef.current
    if (!c) return
    const w = c.offsetWidth
    const cur = Math.round(c.scrollLeft / w)
    const next = Math.max(0, Math.min(slides.length - 1, cur + dir))
    c.scrollTo({ left: next * w, behavior: 'smooth' })
  }, [slides.length])

  const onCarouselScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const c = e.currentTarget
    setActiveIdx(Math.round(c.scrollLeft / c.offsetWidth))
  }, [])

  // Keyboard + body-scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') navSlide(-1)
      else if (e.key === 'ArrowRight') navSlide(1)
      else if (e.key === 'm' || e.key === 'M') setIsMuted((m) => !m)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, navSlide])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.95)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 500,
          height: '100%',
          background: '#000',
          color: '#fff',
          overflow: 'hidden',
        }}
      >
        {isVideo ? (
          <LightboxVideo src={slides[0]} isMuted={isMuted} onUserUnmute={() => setIsMuted(false)} />
        ) : (
          <LightboxCarousel ref={carouselRef} slides={slides} onScroll={onCarouselScroll} />
        )}

        <LightboxChrome
          listing={listing}
          isVideo={isVideo}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((m) => !m)}
          onClose={onClose}
          slidesCount={slides.length}
          activeIdx={activeIdx}
          onJumpSlide={jumpSlide}
        />
      </div>
    </div>
  )
}
