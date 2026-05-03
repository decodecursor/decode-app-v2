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
 *                       → poster, pink ring, white filled glyph bottom-right
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
 * iOS hardening reused from LightboxVideo: programmatic play() in effect
 * on isActive flip, .catch() to absorb autoplay rejections — orb falls
 * back to TAPPABLE-with-glyph if play() promise rejects (Low Power Mode,
 * other rejection cases).
 *
 * preload="metadata" — only fetches video metadata (~10KB) on page load,
 * full bytes only when active. Critical for performance with N listings.
 */
type OrbVariant = 'playing' | 'tappable-video' | 'tappable-photos' | 'empty'

export function MediaOrb({
  videoUrl,
  posterUrl,
  hasPhotos,
  isActive,
  onTap,
  onScrollPause,
  ariaLabel,
}: {
  videoUrl: string | null
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

  // Drive video play/pause from isActive. Rewind on deactivate so the
  // next centered-entry starts fresh per spec.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return

    if (isActive && !reducedMotion) {
      setAutoplayBlocked(false)
      v.play().catch(() => setAutoplayBlocked(true))
    } else {
      v.pause()
      v.currentTime = 0
    }
  }, [isActive, hasVideo, reducedMotion])

  // iOS Safari first-frame nudge. Without poster, a paused <video>
  // renders a black box on iOS until play() runs at least once. Setting
  // currentTime to a small non-zero value on loadedmetadata forces the
  // browser to paint the first frame for the paused state.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return

    const onLoadedMetadata = () => {
      try {
        if (v.currentTime === 0) {
          v.currentTime = 0.1
        }
      } catch {
        // Some browsers throw if metadata isn't fully loaded; ignore.
      }
    }

    v.addEventListener('loadedmetadata', onLoadedMetadata)
    if (v.readyState >= 1) onLoadedMetadata()

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [videoUrl, hasVideo])

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
      {hasVideo && (
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterUrl ?? undefined}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {!hasVideo && hasPhotos && posterUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={posterUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {variant !== 'playing' && <PlayGlyph variant={variant} />}
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
        <polygon points="7 4 20 12 7 20 7 4" />
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
