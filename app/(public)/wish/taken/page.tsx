import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WishTakenClient } from './WishTakenClient'

/**
 * /wish/taken — terminal page reached when /api/checkout/wish returns
 * 409 (race lost — another gifter claimed first).
 *
 * Mockup: `_features/ambassador/payment_gift_taken_already_final.html`.
 *
 * Server params (read by client component for slug/first-name validation
 * + history.replaceState to avoid back-button loop):
 *   slug:  ambassador slug (regex /^[a-z0-9_.-]{1,30}$/i required;
 *          missing → home redirect via client logic)
 *   first: ambassador first name for the CTA copy (any-language letters
 *          + spaces; missing → fallback "their")
 *
 * Same /(public) layout as /expired and /wish/confirmation — black
 * full-bleed chrome with the 500-px mobile frame inside.
 *
 * Suspense wrapper required by Next.js 15: any client subtree that
 * calls useSearchParams() must be inside a <Suspense> boundary or
 * static prerender fails the build. Matches the same pattern in
 * legacy app/pay/{failed,pending,success}/page.tsx.
 */

export const metadata: Metadata = {
  title: 'This wish has already been gifted',
  robots: { index: false, follow: false },
}

function TakenFallback() {
  // Minimal fallback — same outer chrome as the loaded state so there's
  // no layout shift when the client subtree resolves. No spinner: the
  // resolution is synchronous on next paint after URL parsing, so any
  // visible loader would flash.
  return <div style={{ minHeight: '100vh', background: '#000' }} />
}

export default function WishTakenPage() {
  return (
    <Suspense fallback={<TakenFallback />}>
      <WishTakenClient />
    </Suspense>
  )
}
