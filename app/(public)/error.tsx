'use client'

/**
 * Public route-group error boundary. Catches uncaught render or data-
 * fetch errors anywhere under app/(public)/* (the /{slug} profile,
 * terminal pages, listing/wish confirmation, /terms, /privacy) and
 * renders a neutral retry surface.
 *
 * Per Slice 7A — every route group ships an error boundary so a
 * single client-side throw doesn't blank-page the visitor flow.
 *
 * Visitor-context note: visitors here are gifters / professionals /
 * the general public, NOT logged-in ambassadors. The "Go home" CTA
 * resolves via lib/brand-url.ts so the destination is the canonical
 * apex (Carrd default) — same locked-Q5 logic that gates 404 and
 * /expired CTAs.
 *
 * 500px mobile-frame chrome matches the rest of the (public) route
 * group precedent.
 */

import { useEffect } from 'react'
import { getBrandUrl } from '@/lib/brand-url'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PublicError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('[Public route group error]', error)
  }, [error])

  return (
    <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', minHeight: '100vh', padding: '0 20px' }}>
      <div style={{ paddingTop: 160, textAlign: 'center', color: '#fff' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 14 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 32 }}>
          We hit an unexpected error.<br />
          Try again, or head back home.
        </p>

        <button
          type="button"
          onClick={reset}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            background: '#e91e8c',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        >
          Try again
        </button>

        <a
          href={getBrandUrl()}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            background: 'transparent',
            border: '1px solid #262626',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Go to WeLoveDecode
        </a>

        {error.digest && (
          <p style={{ fontSize: 9, color: '#444', marginTop: 24 }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
