import type { Metadata } from 'next'
import { ConfirmationClient } from '@/components/checkout/ConfirmationClient'

/**
 * /listing/confirmation/[pi_id] — Stripe's return_url landing. The
 * pi_xxx is the unguessable auth token (confirmation spec §6); no
 * auth, no extra validation beyond what the API route enforces.
 *
 * Thin server wrapper. All state — pending-webhook retry, active /
 * expired / refunded / not-found branches — lives in ConfirmationClient.
 * Server fetch was considered for a pre-hydrated receipt but Stripe's
 * redirect frequently lands before the webhook writes the row, so
 * client-side retry polling is the correct primary path anyway.
 *
 * Route-group layout (app/(public)/layout.tsx) provides outer black
 * chrome; ConfirmationClient adds the 500px mobile frame inline per
 * the public/checkout-page pattern.
 *
 * noindex because individual receipts are PII-adjacent (reference
 * number visible, amount visible) — must not enter search indexes
 * even though the pi_xxx URL is unguessable.
 */

export const metadata: Metadata = {
  title: 'Your receipt',
  robots: { index: false, follow: false },
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ pi_id: string }>
}) {
  const { pi_id } = await params
  return <ConfirmationClient piId={pi_id} />
}
