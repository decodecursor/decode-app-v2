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
 * Architecture (partner-locked plan):
 *   1. <video> always-mounted with src + preload="metadata". The
 *      currentTime=0.1 nudge on loadedmetadata paints the real first
 *      frame on iOS (otherwise paused <video> renders black).
 *   2. Lazy-capture that first frame to a data URL via canvas
 *      (crossOrigin="anonymous" required so the canvas isn't tainted;
 *      Supabase Storage returns CORS headers). Set as
 *      <video poster=...> so the visual persists when src is later
 *      removed for decoder release. Cached at module scope keyed by
 *      videoUrl — survives unmount/remount cycles within the session.
 *   3. iOS Safari decoder release on inactive: pause() +
 *      removeAttribute('src') + load(). Captured poster persists
 *      visually because the poster attribute survives src removal.
 *      On re-activation: setAttribute('src', videoUrl) + load() +
 *      play(). Hold off the very first inactive-release until
 *      capture settles — otherwise removing src too early prevents
 *      seeked from ever firing.
 *   4. Synthetic-placeholder fallback (gradient disk + centered play
 *      glyph) only when capture fails (CORS, codec, timing). Per-orb;
 *      doesn't crash the page.
 */
type OrbVariant = 'playing' | 'tappable-video' | 'tappable-photos' | 'empty'

// Module-level caches — persist across MediaOrb mount/unmount within
// the page session so re-renders don't re-trigger metadata fetch +
// frame capture for videos already settled.
const posterCache = new Map<string, string>()
const posterFailedSet = new Set<string>()

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
  const [capturedPoster, setCapturedPoster] = useState<string | null>(() =>
    videoUrl ? (posterCache.get(videoUrl) ?? null) : null,
  )
  const [posterFailed, setPosterFailed] = useState<boolean>(() =>
    videoUrl ? posterFailedSet.has(videoUrl) : false,
  )
  const reducedMotion = usePrefersReducedMotion()

  const hasVideo = !!videoUrl
  const variant: OrbVariant =
    hasVideo && isActive && !autoplayBlocked && !reducedMotion ? 'playing' :
    hasVideo                                                   ? 'tappable-video' :
    hasPhotos                                                  ? 'tappable-photos' :
                                                                 'empty'

  // First-frame nudge + capture. After loadedmetadata, bump
  // currentTime to 0.1 so iOS paints the real frame for the paused
  // state. On the resulting `seeked` event, draw that frame to a
  // canvas and set the data URL as the poster — so the visual
  // persists when src is later removed for decoder release.
  // Single-shot per videoUrl; cached at module scope.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo || !videoUrl) return
    if (capturedPoster || posterFailed) return  // already settled

    const onLoadedMetadata = () => {
      try { if (v.currentTime === 0) v.currentTime = 0.1 } catch { /* ignore */ }
    }

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = v.videoWidth || 72
        canvas.height = v.videoHeight || 72
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no-2d-ctx')
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        // toDataURL throws SecurityError if the canvas is tainted —
        // i.e. the video loaded without sending CORS-style request,
        // or the server didn't return ACAO. crossOrigin="anonymous"
        // on the <video> below opts into CORS; Supabase returns
        // headers. Caught + funneled to synthetic placeholder.
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
        posterCache.set(videoUrl, dataUrl)
        setCapturedPoster(dataUrl)
      } catch {
        posterFailedSet.add(videoUrl)
        setPosterFailed(true)
      } finally {
        v.removeEventListener('seeked', onSeeked)
      }
    }

    v.addEventListener('loadedmetadata', onLoadedMetadata)
    v.addEventListener('seeked', onSeeked)
    if (v.readyState >= 1) onLoadedMetadata()

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata)
      v.removeEventListener('seeked', onSeeked)
    }
  }, [videoUrl, hasVideo, capturedPoster, posterFailed])

  // Drive video play on isActive + decoder release on inactive. Hold
  // off the first inactive-state release until capture settles —
  // otherwise removing src too early prevents the seeked event from
  // ever firing and capture is permanently broken for that orb.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return
    if (!isActive && !capturedPoster && !posterFailed) return

    if (isActive && !reducedMotion) {
      // Re-bind src if a previous inactive cycle removed it.
      if (videoUrl && v.getAttribute('src') !== videoUrl) {
        v.setAttribute('src', videoUrl)
        v.load()
      }
      setAutoplayBlocked(false)
      v.play().catch(() => setAutoplayBlocked(true))
    } else {
      // iOS Safari decoder release: pause() alone keeps the slot
      // bound to the element. removeAttribute('src') + load()
      // returns it to no-source state — the cue iOS uses to free
      // the decoder. Captured poster persists visually because
      // it's set on the <video poster=...> attribute, not on src.
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
  }, [isActive, hasVideo, reducedMotion, videoUrl, capturedPoster, posterFailed])

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
          crossOrigin="anonymous"
          poster={capturedPoster ?? undefined}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Synthetic-placeholder fallback — only when canvas capture
          failed (CORS, codec, timing). Covers the orb so the user
          never sees the video element's empty/black frame. */}
      {hasVideo && !isActive && posterFailed && (
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
