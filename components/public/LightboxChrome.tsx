'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'

/**
 * Per-slide chrome that rides with each lightbox page: top + bottom
 * scrims, photo-dot indicator row (when slidesCount > 1), and the
 * bottom info bar (Instagram link).
 *
 * Close + mute buttons used to live here per-slide; they're now
 * rendered once at the LightboxDeck wrapper level with position:fixed
 * so they stay viewport-locked during swipe (per-slide rendering meant
 * they translated with the active slide's scroll-snap movement).
 *
 * Spec: public_media_lightbox_final_UI_Spec.md chrome + info bar.
 */
export function LightboxChrome({
  listing,
  slidesCount,
  activeIdx,
  onJumpSlide,
  isVideo,
}: {
  listing: PublicListingRow
  slidesCount: number
  activeIdx: number
  onJumpSlide: (i: number) => void
  isVideo: boolean
}) {
  const igUrl = `https://instagram.com/${listing.professional_instagram}`
  const initials = listing.professional_name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')

  return (
    <>
      {/* Top scrim */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 90,
          background: 'linear-gradient(rgba(0,0,0,0.55),transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Bottom scrim */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 130,
          background: 'linear-gradient(transparent,rgba(0,0,0,0.92))',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Dots — photos with ≥2 slides */}
      {!isVideo && slidesCount > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 86,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            zIndex: 2,
          }}
        >
          {Array.from({ length: slidesCount }).map((_, i) => (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                onJumpSlide(i)
              }}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === activeIdx ? '#e91e8c' : 'rgba(255,255,255,0.35)',
                transition: 'background 0.2s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      {/* Info bar — Instagram link. z:4 keeps the avatar / name / IG /
          category visible above the pool host (z:3) on video slides;
          on photo slides the pool host is hidden so z:4 is moot but
          consistent. */}
      <a
        href={igUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
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
    </>
  )
}
