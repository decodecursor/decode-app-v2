'use client'

import { useRef, useState } from 'react'

type Flash = 'idle' | 'shared' | 'copied' | 'failed'

/**
 * Share button — top-right of the public page cover. navigator.share first
 * (mobile sheet), clipboard fallback (desktop), text flash on completion.
 *
 * Spec: public_page_final_UI_Spec.md §2.3.
 * Mockup: public_page_final.html sharePage() — same fallback chain.
 */
export function ShareButton({
  url,
  title,
  slug,
}: {
  url: string
  title: string
  slug: string
}) {
  const [flash, setFlash] = useState<Flash>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashFor = (state: Exclude<Flash, 'idle'>) => {
    setFlash(state)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlash('idle'), 1800)
  }

  const onShare = () => {
    // Fire analytics BEFORE branching on capability — even if the share
    // sheet or clipboard write fails, the intent-to-share is the signal
    // we want to count. keepalive ensures it survives if the user
    // immediately switches apps after picking a target.
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'public_page_share_click', slug }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })

    if (typeof navigator === 'undefined') {
      flashFor('failed')
      return
    }
    // typeof nav.share === 'function' avoids TS narrowing `navigator`
    // to `never` in the fallback branches (which `'share' in navigator`
    // would do under strict control-flow analysis).
    const nav = navigator
    if (typeof nav.share === 'function') {
      nav.share({ title, url })
        .then(() => flashFor('shared'))
        .catch(() => {
          // User-cancelled share shouldn't flash anything; swallow silently.
        })
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
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
          color: '#4ade80',
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
