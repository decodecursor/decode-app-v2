/**
 * Notification stubs for the ambassador-stripe webhook + admin payout
 * mark-paid endpoint.
 *
 * Slice 4 locked decision #8: real email + WhatsApp copy lands in
 * post-4C polish. For the 4B+4C milestone the webhook fires these
 * stubs so the call-graph is complete — swapping in Resend + AUTHKey
 * later becomes a body-only change, no webhook-handler edit needed.
 *
 * Slice 7B: payout-paid email is now LIVE (Resend wired with
 * placeholder body per locked Q1 1d — partner swaps real copy via
 * template-only edit later, no backend changes needed). Listing-paid
 * email + listing-paid WhatsApp + payout-paid WhatsApp remain stubs
 * pending real copy + (for WhatsApp) Meta template approval.
 *
 * Fire-and-forget: callers must NOT await. Failures are logged but
 * don't fail the webhook (notification failure ≠ payment failure;
 * user already paid, DB state is correct, retry-on-500 would
 * reprocess the money side and that's worse than a missed email).
 */
import {
  formatAmountForEmail,
  renderListingExpiringEmail,
  renderPayoutPaidEmail,
} from './email-templates'

function getAppBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
}

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

// ============================================================================
// Slice 6B-2: payout-paid notifications (stub — real copy in Slice 7)
// ============================================================================
// Per Slice 6B locked decision #4: trigger sites land in 6B-2, real Resend +
// AUTHKey copy + template wiring lands in Slice 7 polish. Same fire-and-
// forget pattern as the listing-paid notifications above.

export interface PayoutPaidEmailPayload {
  ambassadorEmail: string
  ambassadorName: string
  payoutId: string
  payoutReference: string
  netAmount: number
  currency: string
  bankName: string
  bankLast4: string
  paidAt: Date
  listingsCount: number
  wishesCount: number
}

export interface PayoutPaidWhatsAppPayload {
  ambassadorPhone: string | null
  firstName: string
  payoutReference: string
  netAmount: number
  currency: string
  paidAt: Date
}

export async function sendPayoutPaidEmail(payload: PayoutPaidEmailPayload): Promise<void> {
  // Slice 7B placeholder live (locked Q1 1d). Real copy swap is a
  // partner concern post-V1 — touches only `renderPayoutPaidEmail` body
  // in lib/ambassador/email-templates.ts, not this call site.
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Fail-soft: in environments where RESEND_API_KEY isn't set
    // (local dev, preview without secrets), log + return rather than
    // throw. Keeps the fire-and-forget contract intact.
    console.log('[ambassador-notif:email] RESEND_API_KEY unset, skipping send', {
      kind: 'payout_paid',
      reference: payload.payoutReference,
      to: payload.ambassadorEmail,
    })
    return
  }

  const statementUrl = `${getAppBase()}/model/payouts/${encodeURIComponent(payload.payoutId)}`
  // Long-form English date per partner spec ("4 January 2026"). Mirrors
  // sendPayoutPaidWhatsApp formatting for cross-channel parity.
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(payload.paidAt)
  const html = renderPayoutPaidEmail({
    firstName: payload.ambassadorName,
    netAmount: payload.netAmount,
    currency: payload.currency,
    payoutDate: formattedDate,
    payoutReference: payload.payoutReference,
    statementUrl,
  })

  try {
    // Lazy import + per-call construction (matches add-email/route.ts
    // TODO note about avoiding top-level Resend instantiation breaking
    // next build when the env var is unset).
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: payload.ambassadorEmail,
      subject: 'We sent you money❤️',
      html,
      text: `Hi ${payload.ambassadorName},

We sent you money ❤️

Payout: ${formatAmountForEmail(payload.netAmount)} ${payload.currency.toUpperCase()}
Date: ${formattedDate}
Reference: ${payload.payoutReference}

Funds arrive in 1–2 business days.

View statement: ${statementUrl}

WeLoveDecode`,
    })
    if (error) {
      console.error('[ambassador-notif:email] payout_paid resend failed', {
        reference: payload.payoutReference,
        error,
      })
      return
    }
    console.log('[ambassador-notif:email] payout_paid sent', {
      reference: payload.payoutReference,
      to: payload.ambassadorEmail,
    })
  } catch (err) {
    // Network / SDK error — log + swallow so fire-and-forget contract
    // holds even on totally unexpected failures.
    console.error('[ambassador-notif:email] payout_paid threw', {
      reference: payload.payoutReference,
      err,
    })
  }
}

export async function sendPayoutPaidWhatsApp(payload: PayoutPaidWhatsAppPayload): Promise<void> {
  // Slice 7B wire — locked partner authorization to ship without
  // Meta-approval confirmation (V1 timeline pressure overrides
  // approval-confirmation gate; if Meta rejects + reassigns wid on
  // resubmit, env var swap covers the divergence). Template
  // `payout_paid_v1_placeholder` registered at AUTHKey wid=32755.
  //
  // Variable mapping (5-slot array in order):
  //   {{1}} first_name, {{2}} net_amount (formatted), {{3}} currency,
  //   {{4}} payout_reference, {{5}} payout_date (long-form en-GB)
  //
  // Calls the canonical AuthkeyWhatsAppService.sendTemplate() shape
  // (Slice 1.5 OTP precedent + Slice X bid-confirmation precedent),
  // which auto-logs success + failure to public.whatsapp_messages
  // with provider_response. Fire-and-forget — failures don't bubble
  // back to the mark-paid caller.
  if (!payload.ambassadorPhone) {
    console.log('[ambassador-notif:whatsapp] skipped — no phone on file', {
      reference: payload.payoutReference,
    })
    return
  }

  const wid = process.env.AUTHKEY_WID_PAYOUT_PAID
  if (!wid) {
    console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_WID_PAYOUT_PAID unset', {
      reference: payload.payoutReference,
    })
    return
  }

  // Long-form English date per partner spec ("4 January 2026"). Uses
  // en-GB locale to get day-month-year ordering without commas.
  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(payload.paidAt)

  // Two-decimal grouped amount for the WhatsApp body. Mirrors the
  // email helper's formatAmountForEmail to keep cross-channel parity
  // (recipient sees the same number on both surfaces).
  const amountFormatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(payload.netAmount)

  try {
    const { authkeyWhatsAppService } = await import('@/lib/services/AuthkeyWhatsAppService')
    if (!authkeyWhatsAppService.isConfigured()) {
      console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_API_KEY unset', {
        reference: payload.payoutReference,
      })
      return
    }

    const result = await authkeyWhatsAppService.sendTemplate({
      phone: payload.ambassadorPhone,
      templateWid: wid,
      templateName: 'payout_paid_v1_placeholder',
      bodyValues: {
        '1': payload.firstName,
        '2': amountFormatted,
        '3': payload.currency.toUpperCase(),
        '4': payload.payoutReference,
        '5': dateFormatted,
      },
    })

    if (result.success) {
      console.log('[ambassador-notif:whatsapp] payout_paid sent', {
        reference: payload.payoutReference,
        messageId: result.messageId,
      })
    } else {
      console.error('[ambassador-notif:whatsapp] payout_paid send failed', {
        reference: payload.payoutReference,
        error: result.error,
      })
    }
  } catch (err) {
    console.error('[ambassador-notif:whatsapp] payout_paid threw', {
      reference: payload.payoutReference,
      err,
    })
  }
}

// ============================================================================
// 7-day listing-expiry notifications (ambassador-side, daily cron)
// ============================================================================
// Fired by app/api/cron/daily via lib/ambassador/cron-helpers.ts when a paid
// listing's paid_until lands in the next 7 days and no expiry-notification
// stamp exists. Email + WhatsApp wired to the same Resend / AUTHKey pattern
// as Slice 7B payout-paid. AUTHKEY_WID_LISTING_EXPIRING_AMB=32766 (Meta
// approval pending; sender fail-soft if env var or AUTHKEY_API_KEY unset).

export interface ListingExpiringEmailPayload {
  ambassadorEmail: string
  ambassadorName: string
  serviceName: string
  professionalName: string
  paidUntil: Date
  listingId: string
  listingReference: string
}

export interface ListingExpiringWhatsAppPayload {
  ambassadorPhone: string | null
  firstName: string
  serviceName: string
  professionalName: string
  paidUntil: Date
  listingReference: string
}

export async function sendListingExpiringEmail(payload: ListingExpiringEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[ambassador-notif:email] RESEND_API_KEY unset, skipping send', {
      kind: 'listing_expiring',
      reference: payload.listingReference,
      to: payload.ambassadorEmail,
    })
    return
  }

  const sendLinkUrl = `${getAppBase()}/model/listings/${encodeURIComponent(payload.listingId)}/send-link`
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(payload.paidUntil)

  const html = renderListingExpiringEmail({
    firstName: payload.ambassadorName,
    serviceName: payload.serviceName,
    professionalName: payload.professionalName,
    expiryDate: formattedDate,
    listingReference: payload.listingReference,
    sendLinkUrl,
  })

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: payload.ambassadorEmail,
      subject: 'Time to renew ⏰',
      html,
      text: `Hi ${payload.ambassadorName},

Time to renew ⏰

Listing expires in 7 days.

Listing: ${payload.serviceName}
Where: ${payload.professionalName}
Expires: ${formattedDate}
Reference: ${payload.listingReference}

Keep your listing active.

Send renewal link: ${sendLinkUrl}

WeLoveDecode`,
    })
    if (error) {
      console.error('[ambassador-notif:email] listing_expiring resend failed', {
        reference: payload.listingReference,
        error,
      })
      return
    }
    console.log('[ambassador-notif:email] listing_expiring sent', {
      reference: payload.listingReference,
      to: payload.ambassadorEmail,
    })
  } catch (err) {
    console.error('[ambassador-notif:email] listing_expiring threw', {
      reference: payload.listingReference,
      err,
    })
  }
}

export async function sendListingExpiringWhatsApp(payload: ListingExpiringWhatsAppPayload): Promise<void> {
  if (!payload.ambassadorPhone) {
    console.log('[ambassador-notif:whatsapp] skipped — no phone on file', {
      reference: payload.listingReference,
    })
    return
  }

  const wid = process.env.AUTHKEY_WID_LISTING_EXPIRING_AMB
  if (!wid) {
    console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_WID_LISTING_EXPIRING_AMB unset', {
      reference: payload.listingReference,
    })
    return
  }

  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(payload.paidUntil)

  try {
    const { authkeyWhatsAppService } = await import('@/lib/services/AuthkeyWhatsAppService')
    if (!authkeyWhatsAppService.isConfigured()) {
      console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_API_KEY unset', {
        reference: payload.listingReference,
      })
      return
    }

    const result = await authkeyWhatsAppService.sendTemplate({
      phone: payload.ambassadorPhone,
      templateWid: wid,
      templateName: 'listing_expiring_amb_v1',
      bodyValues: {
        '1': payload.firstName,
        '2': payload.serviceName,
        '3': payload.professionalName,
        '4': dateFormatted,
        '5': payload.listingReference,
      },
    })

    if (result.success) {
      console.log('[ambassador-notif:whatsapp] listing_expiring sent', {
        reference: payload.listingReference,
        messageId: result.messageId,
      })
    } else {
      console.error('[ambassador-notif:whatsapp] listing_expiring send failed', {
        reference: payload.listingReference,
        error: result.error,
      })
    }
  } catch (err) {
    console.error('[ambassador-notif:whatsapp] listing_expiring threw', {
      reference: payload.listingReference,
      err,
    })
  }
}
