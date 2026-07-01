'use client'

import { useRef, useState } from 'react'

type Flash = 'idle' | 'shared' | 'copied' | 'failed'

/**
 * Salon cover Share button (top-right). Behaviour mirrors the ambassador
 * ShareButton — navigator.share first (mobile sheet), clipboard fallback
 * (desktop), text flash on completion — but the chrome matches the salon
 * mock: a translucent dark rounded square (40px, radius 11px, subtle
 * border) rather than the ambassador's 32px circle.
 *
 * Additive: separate from ShareButton so the ambassador page is untouched.
 */
export function SalonShareButton({ url, title }: { url: string; title: string }) {
  const [flash, setFlash] = useState<Flash>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashFor = (state: Exclude<Flash, 'idle'>) => {
    setFlash(state)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlash('idle'), 1800)
  }

  const onShare = () => {
    if (typeof navigator === 'undefined') {
      flashFor('failed')
      return
    }
    const nav = navigator
    if (typeof nav.share === 'function') {
      nav.share({ title, url })
        .then(() => flashFor('shared'))
        .catch(() => { /* user-cancelled — swallow silently */ })
      return
    }
    if (nav.clipboard?.writeText) {
      nav.clipboard.writeText(url)
        .then(() => flashFor('copied'))
        .catch(() => flashFor('failed'))
      return
    }
    flashFor('failed')
  }

  const label =
    flash === 'shared' ? 'Shared!'
    : flash === 'copied' ? 'Copied!'
    : flash === 'failed' ? 'Copy failed'
    : ''

  return (
    <div
      onClick={onShare}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onShare()
        }
      }}
      aria-label="Share this salon"
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 11,
        background: 'rgba(0,0,0,0.38)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          fontWeight: 600,
          color: '#34d399',
          opacity: flash === 'idle' ? 0 : 1,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  )
}
