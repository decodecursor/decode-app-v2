'use client'

/**
 * /expired CTA button — split into a client component so the parent
 * page.tsx can stay a server component (preserves the static-render
 * + metadata export pattern). Loading state on tap prevents double-tap
 * navigation per mockup spec §6 "Loading state on button tap".
 *
 * Same button shape as NotFoundClient at app/NotFoundClient.tsx
 * (rule-of-two; rule-of-three would trigger Principle I extraction —
 * tracked as item 34 watch in the 7A closeout doc).
 */

import { useState } from 'react'

interface ExpiredCTAProps {
  brandUrl: string
}

export default function ExpiredCTA({ brandUrl }: ExpiredCTAProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      e.preventDefault()
      return
    }
    setLoading(true)
  }

  return (
    <a
      href={brandUrl}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '16px',
        borderRadius: 12,
        background: '#e91e8c',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        textAlign: 'center',
        textDecoration: 'none',
        boxSizing: 'border-box',
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'default' : 'pointer',
        transition: 'filter 0.15s, transform 0.05s',
      }}
    >
      {loading ? 'Loading…' : 'Go to WeLoveDecode'}
    </a>
  )
}
