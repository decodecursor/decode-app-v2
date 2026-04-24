/**
 * Notification stubs for the ambassador-stripe webhook.
 *
 * Slice 4 locked decision #8: real email + WhatsApp copy lands in
 * post-4C polish. For the 4B+4C milestone the webhook fires these
 * stubs so the call-graph is complete — swapping in Resend + AUTHKey
 * later becomes a body-only change, no webhook-handler edit needed.
 *
 * Fire-and-forget: callers must NOT await. Failures are logged but
 * don't fail the webhook (notification failure ≠ payment failure;
 * user already paid, DB state is correct, retry-on-500 would
 * reprocess the money side and that's worse than a missed email).
 */

export interface ListingPaidEmailPayload {
  payerEmail: string | null
  ambassadorEmail: string
  ambassadorName: string
  professionalName: string
  packageDays: number
  amount: number
  currency: string
  reference: string
  activeUntil: Date
  ambassadorSlug: string
  categoryLabel: string | null
}

export interface ListingPaidWhatsAppPayload {
  ambassadorPhone: string | null
  professionalName: string
  packageDays: number
  amount: number
  currency: string
  reference: string
  ambassadorSlug: string
}

export async function sendListingPaidEmail(payload: ListingPaidEmailPayload): Promise<void> {
  // TODO (post-4C polish): Resend API call per checkout spec §6.1.
  // Template vars: {professional_name}, {package_days}, {amount},
  // {currency}, {active_until}, {category}, {instagram}, {reference},
  // {ambassador_slug}. From: notifications@welovedecode.com.
  console.log('[ambassador-notif:email] stub payload', {
    kind: 'listing_paid',
    reference: payload.reference,
    to: payload.ambassadorEmail,
    professional: payload.professionalName,
    package_days: payload.packageDays,
    amount_currency: `${payload.amount} ${payload.currency}`,
  })
}

export async function sendListingPaidWhatsApp(payload: ListingPaidWhatsAppPayload): Promise<void> {
  // TODO (post-4C polish): AUTHKey API call per checkout spec §6.2.
  // Reuse AUTHKEY_API_KEY + AUTHKEY_WID_LISTING_PAID env vars.
  // Skip silently when ambassador has no phone on file (not an error
  // condition — WhatsApp notifications are opt-in via phone verification).
  if (!payload.ambassadorPhone) {
    console.log('[ambassador-notif:whatsapp] skipped — no phone on file', {
      reference: payload.reference,
    })
    return
  }
  console.log('[ambassador-notif:whatsapp] stub payload', {
    kind: 'listing_paid',
    reference: payload.reference,
    to: payload.ambassadorPhone,
    professional: payload.professionalName,
    package_days: payload.packageDays,
    amount_currency: `${payload.amount} ${payload.currency}`,
  })
}
