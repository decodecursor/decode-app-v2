'use client'

/**
 * In-page overlay that previews the ambassador's public page inside an
 * iframe — checkout spec §2.2 "URL link behavior: in-page overlay,
 * Instagram-style, NOT new tab".
 *
 * Iframe load failure → graceful fallback card (spec §2.4 resolved
 * decision "URL overlay iframe load failure").
 *
 * CSP note: the embedded /{slug} public page must serve
 * `Content-Security-Policy: frame-ancestors 'self'` so third parties
 * can't embed it for clickjacking (spec §2.4). That header lives on
 * the public route, not this component.
 */

import { useEffect, useState } from 'react'

interface Props {
  isOpen: boolean
  slug: string
  ambassadorName: string
  tagline: string | null
  onClose: () => void
}

const LOAD_TIMEOUT_MS = 8000

export function UrlOverlay({ isOpen, slug, ambassadorName, tagline, onClose }: Props) {
  const [loadFailed, setLoadFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Reset load state when the overlay is re-opened — otherwise a second
  // open after a prior failure would render stale-fallback state.
  useEffect(() => {
    if (isOpen) {
      setLoadFailed(false)
      setLoaded(false)
    }
  }, [isOpen])

  // Load-timeout safety net — iframe onError doesn't fire for CSP or
  // network hangs, so we fall back after 8s of no onLoad event.
  useEffect(() => {
    if (!isOpen || loaded || loadFailed) return
    const t = setTimeout(() => setLoadFailed(true), LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [isOpen, loaded, loadFailed])

  if (!isOpen) return null

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
  const previewUrl = `${baseUrl}/${slug}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${ambassadorName}'s page`}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(28,28,28,0.9)',
          border: '1px solid #262626',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {loadFailed ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 28px',
            textAlign: 'center',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            {ambassadorName}
          </div>
          {tagline && (
            <div style={{ fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>
              {tagline}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#666' }}>
            Unable to load full page preview
          </div>
        </div>
      ) : (
        <iframe
          src={previewUrl}
          title={`${ambassadorName}'s page`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoadFailed(true)}
          style={{ flex: 1, width: '100%', border: 'none', background: '#000' }}
        />
      )}
    </div>
  )
}
