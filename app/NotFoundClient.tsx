'use client'

/**
 * 404 client subtree — separate file so app/not-found.tsx can stay a
 * server component (Next.js requirement: not-found.tsx must be allowed
 * to render at the root, including before any client mount).
 *
 * Loading state on tap prevents double-tap navigation per mockup spec
 * §7. The button is a real <a href> so it works with JS disabled (the
 * loading state is purely a polish layer).
 */

import { useState } from 'react'

interface NotFoundClientProps {
  brandUrl: string
}

export default function NotFoundClient({ brandUrl }: NotFoundClientProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      e.preventDefault()
      return
    }
    setLoading(true)
  }

  return (
    // Slice 7C item 35 fix 2: <main> landmark for screen readers.
    // app/not-found.tsx is at app root (not in /(public)), so the
    // /(public) layout's <main> doesn't apply here — wrap explicitly.
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh', padding: '200px 22px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.2px' }}>
          Page not found
        </div>
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 40 }}>
          This page doesn&apos;t exist.
        </div>
        <a
          href={brandUrl}
          onClick={handleClick}
          style={{
            background: '#e91e8c', borderRadius: 12, padding: 16,
            fontSize: 14, fontWeight: 600, color: '#fff',
            textAlign: 'center', textDecoration: 'none', display: 'block',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'default' : 'pointer',
            transition: 'filter 0.15s, transform 0.05s',
          }}
        >
          {loading ? 'Loading…' : 'Go to WeLoveDecode'}
        </a>
      </div>
    </main>
  )
}
