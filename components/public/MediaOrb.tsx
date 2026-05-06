'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Inline media orb for SquadRow — replaces the previous 56×56 play
 * button + lightbox flow for video listings. Photo listings still
 * route through MediaLightbox (parent decides via onTap).
 *
 * Four variants resolved from props:
 *   - 'playing'         hasVideo + isActive + !autoplayBlocked + !reducedMotion
 *                       → muted looping <video>, pink ring + glow halo, no glyph
 *   - 'tappable-video'  hasVideo + (!isActive || autoplayBlocked || reducedMotion)
 *                       → server-side thumbnail <img> (or synthetic placeholder
 *                         if videoThumbnailUrl is NULL), pink ring
 *   - 'tappable-photos' !hasVideo + hasPhotos
 *                       → photo poster, pink ring, white filled glyph bottom-right
 *   - 'empty'           no media
 *                       → solid #1c1c1c, no border, dim grey filled glyph,
 *                         non-interactive
 *
 * Single-active rule enforced by parent (PublicPageClient): exactly one
 * orb has isActive={true} at any time. Reduced-motion preference forces
 * TAPPABLE for video state — user taps to play.
 *
 * Decoder ceiling avoidance: <video> is mounted ONLY when variant is
 * 'playing'. Inactive video orbs render an <img> (server-side first-frame
 * URL from model_listings.video_thumbnail_url) or a synthetic gradient
 * placeholder when that URL is NULL. Since the parent enforces a single
 * active orb at any time, at most one <video> element exists in the DOM
 * across the whole page — no client-side decoder slot pressure on iOS.
 */
type OrbVariant = 'playing' | 'tappable-video' | 'tappable-photos' | 'empty'

export function MediaOrb({
  videoUrl,
  videoThumbnailUrl,
  posterUrl,
  hasPhotos,
  isActive,
  onTap,
  onScrollPause,
  ariaLabel,
}: {
  videoUrl: string | null
  videoThumbnailUrl: string | null
  posterUrl: string | null
  hasPhotos: boolean
  isActive: boolean
  onTap: () => void
  onScrollPause: () => void
  ariaLabel: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const hasVideo = !!videoUrl
  const variant: OrbVariant =
    hasVideo && isActive && !autoplayBlocked && !reducedMotion ? 'playing' :
    hasVideo                                                   ? 'tappable-video' :
    hasPhotos                                                  ? 'tappable-photos' :
                                                                 'empty'

  // Drive playback when the <video> mounts. Only attempts when the
  // element is in the DOM (variant === 'playing'). play() rejection
  // → autoplayBlocked, which flips variant back to tappable-video on
  // the next render and unmounts the <video> for clean state.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (!isActive || reducedMotion) return
    setAutoplayBlocked(false)
    v.play().catch(() => setAutoplayBlocked(true))
  }, [isActive, reducedMotion, videoUrl])

  const interactive = variant !== 'empty'
  // Tap is unified across variants: always escalates to MediaLightbox via
  // the parent's onTap. Inline play/pause is driven exclusively by the
  // page-level IntersectionObserver via isActive. onScrollPause prop
  // retained on the type for future re-introduction; flagged for cleanup.
  void onScrollPause
  const handleTap = () => {
    if (!interactive) return
    onTap()
  }

  const baseStyle: React.CSSProperties = {
    width: 72,
    height: 72,
    borderRadius: '50%',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    cursor: interactive ? 'pointer' : 'default',
    background: variant === 'empty' ? '#1c1c1c' : '#000',
  }

  const ringStyle: React.CSSProperties =
    variant === 'empty'
      ? { border: 'none' }
      : variant === 'playing'
        ? {
            border: '2px solid #e91e8c',
            boxShadow:
              '0 0 18px rgba(233,30,140,0.55), 0 0 6px rgba(233,30,140,0.85)',
          }
        : { border: '2px solid #e91e8c' }

  return (
    <div
      onClick={handleTap}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleTap()
        }
      }}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      aria-hidden={interactive ? undefined : true}
      tabIndex={interactive ? 0 : undefined}
      style={{ ...baseStyle, ...ringStyle }}
    >
      {hasVideo && variant === 'playing' && (
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {hasVideo && variant !== 'playing' && videoThumbnailUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={videoThumbnailUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Synthetic placeholder — videos with no cached thumbnail (NULL
          before Phase 2b backfill, or future upload-time generation
          failures). Gradient + centered triangle keeps the orb readable
          as a video tile even without the first frame. */}
      {hasVideo && variant !== 'playing' && !videoThumbnailUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #1c1c1c 0%, #0a0a0a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#1c1c1c" strokeWidth="2" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
            <polygon points="7 4 20 12 7 20 7 4" />
          </svg>
        </div>
      )}
      {!hasVideo && hasPhotos && posterUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={posterUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {variant !== 'playing' && (isActive || !hasVideo) && <PlayGlyph variant={variant} />}
    </div>
  )
}

function PlayGlyph({ variant }: { variant: OrbVariant }) {
  const isEmpty = variant === 'empty'
  const size = isEmpty ? 24 : 28
  const fill = isEmpty ? '#777' : '#fff'
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        opacity: isEmpty ? 0.4 : 1,
        filter: isEmpty ? undefined : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
        pointerEvents: 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        stroke="none"
      >
        <polygon points="7 4 20 12 7 20 7 4" stroke="#1c1c1c" strokeWidth="2" strokeLinejoin="round" />
      </svg>
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
