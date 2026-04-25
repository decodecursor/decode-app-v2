'use client'

/**
 * Terminal "someone was faster" page reached from /api/checkout/wish 409.
 *
 * Visual fidelity to `_features/ambassador/payment_gift_taken_already_final.html`:
 * 22px bold title "Someone was faster!", 13px muted body, then a pink
 * full-width CTA "Go to {first_name}'s page" routing to /{slug}.
 *
 * URL params:
 *   slug:  ambassador slug — validated against /^[a-z0-9_.-]{1,30}$/i;
 *          missing or invalid → router.replace('/') (home).
 *   first: ambassador first name — validated as letters+spaces, max 50;
 *          missing or invalid → fallback "their" (CTA reads "Go to their page").
 *
 * history.replaceState on mount so browser back-button skips this hop
 * and doesn't loop the user back through the 409 redirect cycle.
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const SLUG_RE = /^[a-z0-9_.-]{1,30}$/i
const FIRST_RE = /^[\p{L}\s]{1,50}$/u

export function WishTakenClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [resolved, setResolved] = useState<{ slug: string; first: string } | null>(null)

  useEffect(() => {
    const slug = searchParams.get('slug')
    const first = searchParams.get('first')

    if (!slug || !SLUG_RE.test(slug)) {
      router.replace('/')
      return
    }

    const safeFirst = first && FIRST_RE.test(first) ? first : 'their'
    setResolved({ slug, first: safeFirst })

    // Replace history entry so browser back doesn't loop back through
    // the 409 redirect chain.
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.href)
    }
  }, [router, searchParams])

  if (!resolved) {
    // Brief render gap while validation + redirect resolve. No spinner —
    // the home redirect lands fast on bad input; on good input the
    // useState set is synchronous on the next paint.
    return (
      <div style={{ minHeight: '100vh', background: '#000' }} />
    )
  }

  const ctaLabel = resolved.first === 'their'
    ? 'Go to their page'
    : `Go to ${resolved.first}’s page`

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
          This beauty wish has already been<br />
          gifted by someone else.
        </div>
        <a
          href={`/${resolved.slug}`}
          style={{
            background: '#e91e8c', borderRadius: 12, padding: 16,
            fontSize: 15, fontWeight: 600, color: '#fff',
            textAlign: 'center', textDecoration: 'none', display: 'block',
            transition: 'filter 0.15s, transform 0.05s',
          }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  )
}
