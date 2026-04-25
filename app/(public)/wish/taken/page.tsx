import type { Metadata } from 'next'
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
 */

export const metadata: Metadata = {
  title: 'This wish has already been gifted',
  robots: { index: false, follow: false },
}

export default function WishTakenPage() {
  return <WishTakenClient />
}
