'use client'

import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText, locationText } from '@/lib/public/slug-page-shape'

/**
 * All the static chrome that sits above the lightbox media: top + bottom
 * scrims, close button, mute button (video only), dot indicator row
 * (photos with ≥2 slides), and the bottom info bar (Instagram link).
 *
 * Presentation only. Parent owns state (activeIdx, isMuted) and the
 * close / navigate handlers.
 *
 * Spec: public_media_lightbox_final_UI_Spec.md chrome + info bar.
 */
export function LightboxChrome({
  listing,
  isVideo,
  isMuted,
  onToggleMute,
  onClose,
  slidesCount,
  activeIdx,
  onJumpSlide,
}: {
  listing: PublicListingRow
  isVideo: boolean
  isMuted: boolean
  onToggleMute: () => void
  onClose: () => void
  slidesCount: number
  activeIdx: number
  onJumpSlide: (i: number) => void
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

      {/* Mute — video only */}
      {isVideo && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
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
          {isMuted ? (
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

      {/* Close */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
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

      {/* Info bar — Instagram link */}
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
          zIndex: 2,
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
            <span style={{ fontSize: 11, color: '#888' }}>{locationText(listing)}</span>
          </div>
        </div>
      </a>
    </>
  )
}
