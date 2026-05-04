import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ListingPaidClient } from './ListingPaidClient'

/**
 * /listing/paid — terminal page reached when /pay/[token] dispatch
 * detects an already-paid listing (second/third colleague click on a
 * shared payment link).
 *
 * Mockup: `_features/ambassador/listing_paid_final.html` (+ spec).
 *
 * Server params (read by the client component for slug/first-name
 * validation + history.replaceState to avoid back-button loop):
 *   slug:  ambassador slug (regex /^[a-z0-9_.-]{1,30}$/i required;
 *          missing → home redirect via client logic)
 *   first: ambassador first name for the CTA copy (any-language letters
 *          + spaces; missing → fallback "their")
 *
 * Same /(public) route-group layout as /wish/taken, /expired, and the
 * /listing/confirmation receipt — black full-bleed chrome with the
 * 500px mobile frame inside.
 *
 * Suspense wrapper required by Next 15: any client subtree that calls
 * useSearchParams() must be inside a <Suspense> boundary or static
 * prerender fails the build. Same pattern as /wish/taken.
 */

export const metadata: Metadata = {
  title: "This listing isn't accepting payments",
  robots: { index: false, follow: false },
}

function PaidFallback() {
  return <div style={{ minHeight: '100vh', background: '#000' }} />
}

export default function ListingPaidPage() {
  return (
    <Suspense fallback={<PaidFallback />}>
      <ListingPaidClient />
    </Suspense>
  )
}
