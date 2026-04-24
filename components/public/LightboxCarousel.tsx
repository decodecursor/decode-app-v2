'use client'

import { forwardRef } from 'react'

/**
 * Horizontal scroll-snap carousel for 1–3 photos. Parent keeps the ref
 * (used for programmatic navigation via dots + keyboard arrows) and
 * receives onScroll callbacks so it can sync the active dot indicator.
 *
 * Spec: public_media_lightbox_final_UI_Spec.md image-carousel frame.
 * WebKit scrollbar is hidden via a scoped <style> block — no global CSS.
 */
export const LightboxCarousel = forwardRef<
  HTMLDivElement,
  {
    slides: readonly string[]
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  }
>(function LightboxCarousel({ slides, onScroll }, ref) {
  return (
    <>
      <div
        ref={ref}
        onScroll={onScroll}
        className="mb-carousel"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {slides.map((src, i) => (
          <div
            key={i}
            style={{
              minWidth: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              flexShrink: 0,
              position: 'relative',
              background: '#000',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ))}
      </div>
      <style>{`.mb-carousel::-webkit-scrollbar{display:none}`}</style>
    </>
  )
})
