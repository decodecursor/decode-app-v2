'use client'

/**
 * Ambassador route-group error boundary. Catches uncaught render or
 * data-fetch errors anywhere under app/(ambassador)/* and renders a
 * neutral retry surface instead of Next's dev-mode red screen.
 *
 * Per Slice 7A — every route group ships an error boundary so a single
 * client-side throw doesn't blank-page the whole flow. Mounted by Next
 * convention (file name `error.tsx` adjacent to the layout).
 *
 * Reset handler: Next provides reset() which re-renders the segment's
 * tree from scratch. Useful for transient errors (rate-limit transient
 * 429, network blip). For persistent errors (genuine bug), the user
 * can navigate away via the "Go to dashboard" link.
 *
 * Styled to match the ambassador chrome (max-width 420 + safe-center
 * + black bg from app/(ambassador)/layout.tsx). The layout's outer
 * padding still applies — this fragment renders inside it.
 */

import { useEffect } from 'react'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AmbassadorError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Surface the error to the server log for triage. `digest` is the
    // Next-assigned correlation id present in production; it's the
    // anchor that ties this client surface back to the server stack.
    console.error('[Ambassador route group error]', error)
  }, [error])

  return (
    <div style={{ paddingTop: 160, textAlign: 'center', color: '#fff' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 14 }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 32 }}>
        We hit an unexpected error.<br />
        Try again, or head back to your dashboard.
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
        }}
      >
        Try again
      </button>

      <a
        href="/model"
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
        Go to dashboard
      </a>

      {error.digest && (
        <p style={{ fontSize: 9, color: '#444', marginTop: 24 }}>
          Reference: {error.digest}
        </p>
      )}
    </div>
  )
}
