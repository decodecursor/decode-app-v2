import type { Metadata } from 'next'
import { WishConfirmationClient } from '@/components/checkout/WishConfirmationClient'

/**
 * /wish/confirmation/[pi_id] — Stripe's return_url landing for wish
 * gifts. Sibling of /listing/confirmation/[pi_id].
 *
 * Same security model: pi_xxx is ~161 bits of unguessable entropy
 * (Stripe-hosted-receipt pattern). No auth required, no extra
 * validation beyond what /api/wishes/by-payment-intent enforces.
 *
 * Thin server wrapper; all retry + active/refunded/not-found state
 * lives in WishConfirmationClient.
 *
 * noindex because individual receipts are PII-adjacent (gifter name +
 * Instagram visible when not anonymous, reference number visible).
 */

export const metadata: Metadata = {
  title: 'Your gift receipt',
  robots: { index: false, follow: false },
}

export default async function WishConfirmationPage({
  params,
}: {
  params: Promise<{ pi_id: string }>
}) {
  const { pi_id } = await params
  return <WishConfirmationClient piId={pi_id} />
}
