'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxChrome } from './LightboxChrome'

/**
 * Video page within the lightbox deck. Mounts a full-screen <video>
 * when isHydrated (current ± 1 within the deck) so distant pages
 * don't fan out to N simultaneous metadata fetches. Plays only when
 * isCurrent (single-active rule across the deck).
 *
 * Mute is controlled by parent (LightboxDeck) — shared across all
 * video pages in the same session, so unmuting one persists to the
 * next.
 *
 * Tap-anywhere on the video toggles mute (TikTok pattern). The mute
 * button in LightboxChrome's top-left also routes to onToggleMute.
 *
 * iOS hardening:
 *  - playsInline + muted=true on first play (browser autoplay policy)
 *  - .catch() on play() promise → autoplayBlocked=true → tap-to-play
 *    overlay (mirrors the previous LightboxVideo pattern — file deleted
 *    in this commit, behavior preserved here).
 *
 * Reduced-motion: skip play() entirely; force the tap-to-play overlay
 * so the user must opt-in. Deck navigation still works.
 */
export function DeckVideoPage({
  listing,
  isCurrent,
  isHydrated,
  isMuted,
  onToggleMute,
  onClose,
}: {
  listing: PublicListingRow
  isCurrent: boolean
  isHydrated: boolean
  isMuted: boolean
  onToggleMute: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  // Drive play/pause from isCurrent. Only the focused page's video
  // plays; the rest pause + rewind so the next focus starts fresh.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    if (isCurrent && !reducedMotion) {
      setAutoplayBlocked(false)

      // play() may reject if readyState is too low (browser hasn't
      // loaded enough metadata yet to begin playback). Retry once on
      // 'canplay' before declaring autoplay blocked. iOS Safari hits
      // this most often when a video page becomes current shortly
      // after hydration — the mount + play() race loses on slow
      // metadata fetches (e.g. videos without moov-at-start /
      // faststart encoding).
      let cancelled = false
      let canplayHandler: (() => void) | null = null

      const tryPlay = () => {
        if (cancelled) return
        v.play().catch(() => {
          if (cancelled) return
          if (v.readyState < 3 && !canplayHandler) {
            // Not ready yet — wait for canplay and retry once.
            canplayHandler = () => {
              if (cancelled) return
              v.play().catch(() => setAutoplayBlocked(true))
            }
            v.addEventListener('canplay', canplayHandler, { once: true })
          } else {
            // Ready but rejected anyway (autoplay policy / Low Power Mode).
            setAutoplayBlocked(true)
          }
        })
      }

      tryPlay()

      return () => {
        cancelled = true
        if (canplayHandler) {
          v.removeEventListener('canplay', canplayHandler)
        }
      }
    } else {
      v.pause()
      v.currentTime = 0
      // Reduced-motion: surface the tap-to-play overlay so the user
      // can still play on demand.
      if (reducedMotion && isCurrent) {
        setAutoplayBlocked(true)
      }
    }
  }, [isCurrent, isHydrated, reducedMotion])

  // Tap on the video → toggle mute (TikTok pattern).
  // If currently autoplay-blocked, the same tap should attempt play().
  const onVideoTap = () => {
    const v = videoRef.current
    if (!v) return
    if (autoplayBlocked) {
      v.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => { /* leave overlay up */ })
      return
    }
    onToggleMute()
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {isHydrated && listing.video_url && (
        <video
          ref={videoRef}
          src={listing.video_url}
          loop
          playsInline
          muted={isMuted}
          preload={isCurrent ? 'auto' : 'metadata'}
          onClick={onVideoTap}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {autoplayBlocked && isCurrent && (
        <div
          onClick={onVideoTap}
          role="button"
          aria-label="Play video"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onVideoTap()
            }
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '1.5px solid #e91e8c',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxSizing: 'border-box',
            zIndex: 3,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="#fff"
            stroke="none"
          >
            <polygon points="7 4 20 12 7 20 7 4" />
          </svg>
        </div>
      )}

      <LightboxChrome
        listing={listing}
        isVideo={true}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onClose={onClose}
        slidesCount={1}
        activeIdx={0}
        onJumpSlide={() => { /* no-op for video */ }}
      />
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
