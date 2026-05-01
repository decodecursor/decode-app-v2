'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Full-frame video for the media lightbox. Autoplays muted (mobile
 * autoplay requires muted+playsInline); parent owns the mute toggle
 * and passes the controlled value.
 *
 * iOS hardening:
 *   - manual videoRef.current.play() in useEffect handles the React
 *     late-mount autoplay quirk on iOS Safari — the <video> element
 *     mounts a tick after the user gesture that opens the lightbox,
 *     and attribute-based autoplay sometimes silently no-ops on that
 *     path even with muted+playsInline set.
 *   - .catch() on the play() promise flips autoplayBlocked=true,
 *     surfacing a tap-to-play overlay that mirrors SquadRow's pink
 *     play-button (Principle E reuse). Covers iOS Low Power Mode +
 *     any other autoplay-rejection case. Tap unmutes too — the
 *     gesture allows audio per browser autoplay rules.
 *
 * Spec: public_media_lightbox_final_UI_Spec.md video frame.
 */
export function LightboxVideo({
  src,
  isMuted,
  onUserUnmute,
}: {
  src: string
  isMuted: boolean
  onUserUnmute?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    setAutoplayBlocked(false)
    v.play().catch(() => setAutoplayBlocked(true))
  }, [src])

  const onTapToPlay = () => {
    const v = videoRef.current
    if (!v) return
    v.play()
      .then(() => {
        setAutoplayBlocked(false)
        onUserUnmute?.()
      })
      .catch(() => { /* leave overlay up */ })
  }

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        playsInline
        muted={isMuted}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {autoplayBlocked && (
        <div
          onClick={onTapToPlay}
          role="button"
          aria-label="Play video"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTapToPlay() } }}
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
            zIndex: 1,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e91e8c"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="7 4 20 12 7 20 7 4" />
          </svg>
        </div>
      )}
    </>
  )
}
