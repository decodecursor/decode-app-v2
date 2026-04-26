'use client'

/**
 * Email-error page CTA + side effects — split into a client component
 * so the parent page.tsx can stay an async server component and keep
 * its 5-reason copy lookup at request-time + metadata export.
 *
 * Slice 7A locked Q4 (4c): keep the shipped 5-reason copy (UX wins
 * over the mockup spec's security-by-obscurity universal copy — see
 * 7A closeout retro), but cherry-pick the mockup mechanics from
 * email_error_final_UI_Spec.md §4.4 + §8:
 *   1. history.replaceState on mount — removes this failure hop from
 *      the back-stack, prevents the back → email client → click link
 *      → bounce-back-here infinite loop (spec §4.4).
 *   2. Loading state on tap — prevents double-tap navigation (spec §8).
 *
 * Button stays a real <a href> so it works with JS disabled (loading
 * state + replaceState are polish layers).
 */

import { useEffect, useState } from 'react'

export default function EmailErrorCTA() {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.href)
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      e.preventDefault()
      return
    }
    setLoading(true)
  }

  return (
    <a
      href="/model/auth"
      onClick={handleClick}
      style={{
        display: 'inline-block',
        background: '#e91e8c',
        color: '#fff',
        textDecoration: 'none',
        padding: '14px 32px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 600,
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'default' : 'pointer',
        transition: 'filter 0.15s, transform 0.05s',
      }}
    >
      {loading ? 'Loading…' : 'Go to login'}
    </a>
  )
}
