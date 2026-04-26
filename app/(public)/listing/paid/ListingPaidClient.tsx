'use client'

/**
 * Terminal "someone was faster" page reached from /pay/[token] dispatch
 * when an already-paid listing is opened by a second/third colleague
 * sharing the link.
 *
 * Visual fidelity to `_features/ambassador/listing_paid_final.html`:
 * 22px bold title "Someone was faster!", 13px muted body, then a pink
 * full-width CTA "Go to {first_name}'s page" routing to /{slug}.
 *
 * Privacy rationale (mockup spec §3): person 3 must NOT be redirected
 * to person 1's receipt at /listing/confirmation/{pi_id} — that would
 * leak the first payer's reference + amount + date. This neutral page
 * shows no financial data; CTA returns to the ambassador's public page.
 *
 * URL params:
 *   slug:  ambassador slug — validated against /^[a-z0-9_.-]{1,30}$/i;
 *          missing or invalid → router.replace('/') (home).
 *   first: ambassador first name — letters+spaces (any language), max 50;
 *          missing or invalid → fallback "their" ("Go to their page").
 *
 * history.replaceState on mount so browser back-button skips this hop
 * and doesn't loop the user back through the 409-style redirect cycle.
 *
 * Sibling of `app/(public)/wish/taken/WishTakenClient.tsx`. The two
 * regexes are identical by spec — duplicated inline at rule-of-two; a
 * third consumer would trigger Principle I extraction (logged as
 * hardening item 34 watch).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const SLUG_RE = /^[a-z0-9_.-]{1,30}$/i
const FIRST_RE = /^[\p{L}\s]{1,50}$/u

export function ListingPaidClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [resolved, setResolved] = useState<{ slug: string; first: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const btnRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    const slug = searchParams.get('slug')
    const first = searchParams.get('first')

    if (!slug || !SLUG_RE.test(slug)) {
      router.replace('/')
      return
    }

    const safeFirst = first && FIRST_RE.test(first) ? first : 'their'
    setResolved({ slug, first: safeFirst })

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.href)
    }
  }, [router, searchParams])

  if (!resolved) {
    return <div style={{ minHeight: '100vh', background: '#000' }} />
  }

  const ctaLabel = loading
    ? 'Loading…'
    : resolved.first === 'their'
      ? 'Go to their page'
      : `Go to ${resolved.first}’s page`

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      e.preventDefault()
      return
    }
    setLoading(true)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', minHeight: '100vh', padding: '160px 20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.2px' }}>
          Someone was faster!
        </div>
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 40 }}>
          This listing has already been<br />
          paid by someone else.
        </div>
        <a
          ref={btnRef}
          href={`/${resolved.slug}`}
          onClick={handleClick}
          style={{
            background: '#e91e8c', borderRadius: 12, padding: 16,
            fontSize: 15, fontWeight: 600, color: '#fff',
            textAlign: 'center', textDecoration: 'none', display: 'block',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'default' : 'pointer',
            transition: 'filter 0.15s, transform 0.05s',
          }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  )
}
