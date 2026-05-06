'use client'

import { useEffect, useRef, useState } from 'react'
import { orbMediaPool } from '@/lib/public/orb-media-pool'

/**
 * Inline media orb for SquadRow — tappable circle that previews each
 * listing's media. Photo listings still route through MediaLightbox
 * (parent decides via onTap).
 *
 * Four variants resolved from props:
 *   - 'playing'         hasVideo + isActive + !reducedMotion
 *                       → shared pool <video> appended into this orb's
 *                         container by orbMediaPool.activate, plays
 *                         muted; pink ring + glow halo, no glyph
 *   - 'tappable-video'  hasVideo + (!isActive || reducedMotion)
 *                       → server-side thumbnail <img> (or synthetic
 *                         placeholder if videoThumbnailUrl is NULL),
 *                         pink ring, no glyph
 *   - 'tappable-photos' !hasVideo + hasPhotos
 *                       → photo poster, pink ring, white filled glyph
 *                         bottom-right
 *   - 'empty'           no media
 *                       → solid #1c1c1c, no border, dim grey filled
 *                         glyph, non-interactive
 *
 * Single-active rule enforced by parent (PublicPageClient): exactly
 * one orb has isActive={true} at any time. Reduced-motion preference
 * keeps the orb static (no autoplay).
 *
 * Decoder ceiling avoidance: a single shared <video> element lives in
 * orbMediaPool. activate(parent, src) appendChild-moves the element
 * into the active orb's container, swaps src, and plays. There is at
 * most one <video> in the DOM across the whole public page — iOS
 * Safari's 4-6 decoder slot ceiling is structurally unreachable.
 *
 * autoplayBlocked tracking dropped: muted autoplay essentially never
 * rejects under WebKit policy, and per spec no PlayGlyph is shown on
 * video orbs. If a play() rejection ever does happen, the orb cleanly
 * falls back to its static thumbnail beneath the (uninserted) pool
 * element.
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
  const orbContainerRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const hasVideo = !!videoUrl
  const variant: OrbVariant =
    hasVideo && isActive && !reducedMotion ? 'playing' :
    hasVideo                                ? 'tappable-video' :
    hasPhotos                               ? 'tappable-photos' :
                                              'empty'

  // Drive pool activation. When this orb becomes the playing one, the
  // shared pool <video> is appendChild'd into our container and started.
  // On the next active-orb change, the next orb's activate() moves the
  // element to itself (implicit removeChild from us). When no orb is
  // active, PublicPageClient calls orbMediaPool.deactivate to pause +
  // detach the element.
  useEffect(() => {
    if (variant !== 'playing') return
    const parent = orbContainerRef.current
    if (!parent || !videoUrl) return
    orbMediaPool.activate(parent, videoUrl)
  }, [variant, videoUrl])

  // onScrollPause prop retained for type compatibility; the page-level
  // IntersectionObserver drives single-active via isActive instead.
  void onScrollPause

  const interactive = variant !== 'empty'
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
      ref={orbContainerRef}
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
      {/* Persistent base layer for video orbs — <img> stays mounted
          whether active or not. Pool <video> is appendChild'd after
          this in DOM order so it visually overlays once playing,
          eliminating any flash on activation. */}
      {hasVideo && videoThumbnailUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={videoThumbnailUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {hasVideo && !videoThumbnailUrl && (
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

      {/* PlayGlyph: only for photo and empty orbs. Video orbs have no
          glyph — autoplay covers the active case via the pool, and the
          static thumbnail covers the inactive case. */}
      {(variant === 'tappable-photos' || variant === 'empty') && <PlayGlyph variant={variant} />}
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
