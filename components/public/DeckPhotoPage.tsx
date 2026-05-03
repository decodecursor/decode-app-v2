'use client'

import { useCallback, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxCarousel } from './LightboxCarousel'
import { LightboxChrome } from './LightboxChrome'

/**
 * Photo page within the lightbox deck. Hosts the existing
 * LightboxCarousel for inner horizontal swipe through 1-3 photos.
 *
 * Two-axis gesture handling: touch-action: pan-x on this container
 * scopes horizontal swipes to the inner carousel. The outer deck has
 * touch-action: pan-y. Browser direction-locking decides per gesture
 * which axis to handle — no JS handlers needed.
 *
 * Pinch-zoom disabled (touch-action: pan-x excludes pinch). Future
 * enhancement if needed: switch to 'pan-x pinch-zoom'.
 */
export function DeckPhotoPage({
  listing,
  onClose,
}: {
  listing: PublicListingRow
  onClose: () => void
}) {
  const slides = [listing.photo_url_1, listing.photo_url_2, listing.photo_url_3].filter(
    (s): s is string => !!s,
  )
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const onCarouselScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const c = e.currentTarget
    setActiveIdx(Math.round(c.scrollLeft / c.offsetWidth))
  }, [])

  const onJumpSlide = useCallback((i: number) => {
    const c = carouselRef.current
    if (!c) return
    c.scrollTo({ left: i * c.offsetWidth, behavior: 'smooth' })
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        touchAction: 'pan-x',
      }}
    >
      <LightboxCarousel ref={carouselRef} slides={slides} onScroll={onCarouselScroll} />
      <LightboxChrome
        listing={listing}
        isVideo={false}
        isMuted={true}
        onToggleMute={() => { /* no-op for photo */ }}
        onClose={onClose}
        slidesCount={slides.length}
        activeIdx={activeIdx}
        onJumpSlide={onJumpSlide}
      />
    </div>
  )
}
