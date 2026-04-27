import type { Metadata } from 'next'
import { getBrandUrl } from '@/lib/brand-url'
import ExpiredCTA from './ExpiredCTA'

/**
 * Generic terminal page shown when a /pay/[token] link is no longer
 * valid. Covers: missing price/FK data, listing deleted / hidden,
 * admin revocation, invalid token format, and deleted wishes that
 * aren't "already gifted" (that case ships /wish/taken).
 *
 * Slice 7A: the already-paid case (race with another payer on a
 * shared link) is now handled by /listing/paid?slug=&first= per
 * listing_paid_final_UI_Spec.md — that path leaves /expired as the
 * truly generic "no context to personalize" terminal.
 *
 * Spec: _features/ambassador/payment_link_no_longer_active_final_UI_Spec.md
 *
 * Server component for static prerender + metadata export. The CTA
 * button is split into a small client component (`ExpiredCTA.tsx`)
 * to add the spec §6 loading-state on tap. Button href reads
 * NEXT_PUBLIC_BRAND_URL via lib/brand-url.ts so the canonical apex
 * (Carrd default) is the destination, NOT app.welovedecode.com/
 * which resolves to legacy auctions auth (locked Slice 7A Q5).
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
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh', padding: '0 20px' }}>
      <div style={{ paddingTop: 200, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 14, color: '#fff' }}>
          Link no longer active
        </h1>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 40 }}>
          This payment link is no longer valid.
        </p>
        <ExpiredCTA brandUrl={getBrandUrl()} />
      </div>
    </div>
  )
}
