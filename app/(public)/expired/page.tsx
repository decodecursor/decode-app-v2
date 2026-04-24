import type { Metadata } from 'next'

/**
 * Generic terminal page shown when a /pay/[token] link is no longer
 * valid. Covers: listing deleted / hidden, listing paid by another
 * professional (V1 fallback per audit locked decision #2), admin
 * revocation, invalid token format, and — from Slice 5 onward —
 * deleted wishes that aren't "already gifted" (that case ships its
 * own page in Slice 5 per payment_link_no_longer_active spec §2.4).
 *
 * Spec: _features/ambassador/payment_link_no_longer_active_final_UI_Spec.md
 *
 * Pure static HTML — no JS, no fetch, no params processed. Works with
 * JS disabled (button is a real <a href="/">).
 *
 * Route-group layout (app/(public)/layout.tsx) provides the outer
 * black chrome; this page adds the 500px mobile frame inline, matching
 * the public /{slug} + checkout-page pattern.
 */

export const metadata: Metadata = {
  title: 'Link no longer active',
  robots: { index: false, follow: false },
}

export default function ExpiredPage() {
  return (
    <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', minHeight: '100vh', padding: '0 20px' }}>
      <div style={{ paddingTop: 160, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 14, color: '#fff' }}>
          Link no longer active
        </h1>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 40 }}>
          This payment link is no longer valid.
        </p>
        <a
          href="/"
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
          }}
        >
          Go to WeLoveDecode
        </a>
      </div>
    </div>
  )
}
