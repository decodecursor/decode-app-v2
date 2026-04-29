/**
 * Notification senders for the ambassador-stripe webhook, admin payout
 * mark-paid endpoint, and daily expiry cron.
 *
 * Email surfaces are LIVE (Resend wired): listing-paid (sent to the
 * professional), payout-paid, listing-expiring (paid + free trial
 * variants), wish-gifted (sent to the gifter; named + anonymous
 * variants). WhatsApp surfaces still stubbed for: listing-paid,
 * wish-gifted (pending Meta template approval per partner). Payout-paid
 * + listing-expiring WhatsApp are LIVE (templates already approved).
 *
 * Fire-and-forget: callers must NOT await. Failures are logged but
 * don't fail the webhook (notification failure ≠ payment failure;
 * user already paid, DB state is correct, retry-on-500 would
 * reprocess the money side and that's worse than a missed email).
 */
import {
  renderListingExpiringEmail,
  renderListingExpiringProEmail,
  renderListingPaidEmail,
  renderNewUserOperatorEmail,
  renderPayoutPaidEmail,
  renderWishGiftedEmail,
} from './email-templates'
import { formatCurrencyText } from './currency-format'

function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

// BCC for transactional emails when OPERATOR_BCC_EMAIL is set in env.
// Returns undefined when unset so the field is omitted from the Resend
// payload (vs. an empty array, which the API rejects).
function getOperatorBcc(): string[] | undefined {
  const bcc = process.env.OPERATOR_BCC_EMAIL
  return bcc ? [bcc] : undefined
}

function getAppBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
}

export interface ListingPaidEmailPayload {
  payerEmail: string | null
  ambassadorEmail: string
  ambassadorFirstName: string
  ambassadorFullName: string
  professionalName: string
  packageDays: number
  amount: number
  currency: string
  reference: string
  purchaseDate: Date
  startDate: Date
  endDate: Date
  ambassadorSlug: string
  receiptUrl: string
}

export interface ListingPaidWhatsAppPayload {
  ambassadorPhone: string | null
  ambassadorFirstName: string
  ambassadorSlug: string
  serviceName: string
  professionalName: string
  packageDays: number
  activeUntil: Date
  amount: number
  currency: string
  reference: string
}

export interface WishGiftedWhatsAppPayload {
  ambassadorPhone: string | null
  ambassadorFirstName: string
  ambassadorSlug: string
  isAnonymous: boolean
  wishService: string
  gifterName: string | null
  purchaseDate: Date
  amount: number
  currency: string
  reference: string
}

export async function sendListingPaidEmail(payload: ListingPaidEmailPayload): Promise<void> {
  // Recipient is the PROFESSIONAL (Stripe receipt_email = the person
  // who paid for the listing). Skip + log when null — Stripe Checkout
  // can complete without a receipt_email in some flows.
  if (!payload.payerEmail) {
    console.log('[ambassador-notif:email] listing_paid skipped — no payer email', {
      reference: payload.reference,
    })
    return
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[ambassador-notif:email] RESEND_API_KEY unset, skipping send', {
      kind: 'listing_paid',
      reference: payload.reference,
      to: payload.payerEmail,
    })
    return
  }

  const purchaseDate = formatLongDate(payload.purchaseDate)
  const startDate = formatLongDate(payload.startDate)
  const endDate = formatLongDate(payload.endDate)
  const amountDisplay = formatCurrencyText('amount-with-code', payload.currency, payload.amount, { decimals: 'fixed-2' })
  const listingUrl = `https://app.welovedecode.com/${payload.ambassadorSlug}`

  const html = renderListingPaidEmail({
    ambassadorFirstName: payload.ambassadorFirstName,
    ambassadorFullName: payload.ambassadorFullName,
    professionalName: payload.professionalName,
    packageDays: payload.packageDays,
    reference: payload.reference,
    purchaseDate,
    amount: payload.amount,
    currency: payload.currency,
    startDate,
    endDate,
    ambassadorSlug: payload.ambassadorSlug,
    receiptUrl: payload.receiptUrl,
  })

  const text = `Congrats

${payload.professionalName} is now live on ${payload.ambassadorFirstName}'s page 🎉

Thousands of her followers will be able to discover your work.

---

Ambassador:     ${payload.ambassadorFullName}
Reference:      ${payload.reference}
Service:        ${payload.packageDays}-day listing on ${payload.ambassadorFirstName}'s page
Purchase date:  ${purchaseDate}
Amount:         ${amountDisplay}
Start date:     ${startDate}
End date:       ${endDate}

---

View listing:
${listingUrl}

View receipt online:
${payload.receiptUrl}

---

Didn't make this payment? Please reply right away.

Your DECODE team
welovedecode.com`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: payload.payerEmail,
      bcc: getOperatorBcc(),
      subject: `You're live on ${payload.ambassadorFirstName}'s page 🎉`,
      html,
      text,
    })
    if (error) {
      console.error('[ambassador-notif:email] listing_paid resend failed', {
        reference: payload.reference,
        error,
      })
      return
    }
    console.log('[ambassador-notif:email] listing_paid sent', {
      reference: payload.reference,
      to: payload.payerEmail,
    })
  } catch (err) {
    console.error('[ambassador-notif:email] listing_paid threw', {
      reference: payload.reference,
      err,
    })
  }
}

export interface WishGiftedEmailPayload {
  gifterEmail: string | null
  ambassadorFirstName: string
  ambassadorFullName: string
  isAnonymous: boolean
  reference: string
  giftLabel: string
  purchaseDate: Date
  amount: number
  currency: string
  gifterName: string | null
  gifterInstagram: string | null
  ambassadorSlug: string
  paymentIntentId: string
}

export async function sendWishGiftedEmail(payload: WishGiftedEmailPayload): Promise<void> {
  if (!payload.gifterEmail) {
    console.log('[ambassador-notif:email] wish_gifted skipped — no gifter email', {
      reference: payload.reference,
    })
    return
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[ambassador-notif:email] RESEND_API_KEY unset, skipping send', {
      kind: 'wish_gifted',
      reference: payload.reference,
      to: payload.gifterEmail,
    })
    return
  }

  const receiptUrl = `${getAppBase()}/wish/confirmation/${encodeURIComponent(payload.paymentIntentId)}`
  const purchaseDate = formatLongDate(payload.purchaseDate)
  const amountDisplay = formatCurrencyText('amount-with-code', payload.currency, payload.amount, { decimals: 'fixed-2' })
  const listingUrl = `https://app.welovedecode.com/${payload.ambassadorSlug}`

  const html = renderWishGiftedEmail({
    ambassadorFirstName: payload.ambassadorFirstName,
    ambassadorFullName: payload.ambassadorFullName,
    isAnonymous: payload.isAnonymous,
    reference: payload.reference,
    giftLabel: payload.giftLabel,
    purchaseDate,
    amount: payload.amount,
    currency: payload.currency,
    gifterName: payload.gifterName,
    gifterInstagram: payload.gifterInstagram,
    ambassadorSlug: payload.ambassadorSlug,
    receiptUrl,
  })

  // Plain-text fallback. Anonymous variant swaps the name+IG rows for
  // a "Visibility: Anonymous" row and the prose lines for the privacy
  // note (matches the html branch).
  const visibilityProse = payload.isAnonymous
    ? `Your gift will appear as "Secret Gifter" on her Wall of Love.

Your name and Instagram stay private.`
    : `Thousands will see your name and Instagram on her Wall of Love.`

  const dataLines = payload.isAnonymous
    ? `Gift received:  ${payload.ambassadorFullName}
Reference:      ${payload.reference}
Gift:           ${payload.giftLabel}
Purchase date:  ${purchaseDate}
Amount:         ${amountDisplay}
Visibility:     Secret Gifter`
    : `Gift received:  ${payload.ambassadorFullName}
Reference:      ${payload.reference}
Gift:           ${payload.giftLabel}
Purchase date:  ${purchaseDate}
Amount:         ${amountDisplay}
Your name:      ${payload.gifterName ?? ''}
Your IG:        @${payload.gifterInstagram ?? ''}`

  const text = `Amazing

You fulfilled ${payload.ambassadorFirstName}'s beauty wish 🎁

${visibilityProse}

---

${dataLines}

---

View ${payload.ambassadorFirstName}'s page:
${listingUrl}

View receipt online:
${receiptUrl}

---

Didn't make this gift? Please reply right away.

Your DECODE team
welovedecode.com`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: payload.gifterEmail,
      bcc: getOperatorBcc(),
      subject: `You made ${payload.ambassadorFirstName}'s day 🎁`,
      html,
      text,
    })
    if (error) {
      console.error('[ambassador-notif:email] wish_gifted resend failed', {
        reference: payload.reference,
        error,
      })
      return
    }
    console.log('[ambassador-notif:email] wish_gifted sent', {
      reference: payload.reference,
      to: payload.gifterEmail,
    })
  } catch (err) {
    console.error('[ambassador-notif:email] wish_gifted threw', {
      reference: payload.reference,
      err,
    })
  }
}

export async function sendListingPaidWhatsApp(payload: ListingPaidWhatsAppPayload): Promise<void> {
  // Skip silently when ambassador has no phone on file — WhatsApp
  // notifications are opt-in via phone verification, not an error.
  if (!payload.ambassadorPhone) {
    console.log('[ambassador-notif:whatsapp] skipped — no phone on file', {
      reference: payload.reference,
    })
    return
  }

  const wid = process.env.AUTHKEY_WID_LISTING_PAID
  if (!wid) {
    console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_WID_LISTING_PAID unset', {
      reference: payload.reference,
    })
    return
  }

  const dateFormatted = formatLongDate(payload.activeUntil)
  const amountFormatted = formatCurrencyText('amount-with-code', payload.currency, payload.amount, { decimals: 'fixed-2' })

  try {
    const { authkeyWhatsAppService } = await import('@/lib/services/AuthkeyWhatsAppService')
    if (!authkeyWhatsAppService.isConfigured()) {
      console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_API_KEY unset', {
        reference: payload.reference,
      })
      return
    }

    const result = await authkeyWhatsAppService.sendTemplate({
      phone: payload.ambassadorPhone,
      templateWid: wid,
      templateName: 'listing_paid_v1',
      bodyValues: {
        '1': payload.ambassadorFirstName,
        '2': payload.serviceName,
        '3': payload.professionalName,
        '4': `${payload.packageDays} days`,
        '5': dateFormatted,
        '6': amountFormatted,
        '7': payload.reference,
      },
      buttonValues: {
        '1': payload.ambassadorSlug,
      },
    })

    if (result.success) {
      console.log('[ambassador-notif:whatsapp] listing_paid sent', {
        reference: payload.reference,
        messageId: result.messageId,
      })
    } else {
      console.error('[ambassador-notif:whatsapp] listing_paid send failed', {
        reference: payload.reference,
        error: result.error,
      })
    }
  } catch (err) {
    console.error('[ambassador-notif:whatsapp] listing_paid threw', {
      reference: payload.reference,
      err,
    })
  }
}

export async function sendWishGiftedWhatsApp(payload: WishGiftedWhatsAppPayload): Promise<void> {
  if (!payload.ambassadorPhone) {
    console.log('[ambassador-notif:whatsapp] skipped — no phone on file', {
      reference: payload.reference,
    })
    return
  }

  const wid = process.env.AUTHKEY_WID_WISH_GIFTED
  if (!wid) {
    console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_WID_WISH_GIFTED unset', {
      reference: payload.reference,
    })
    return
  }

  const dateFormatted = formatLongDate(payload.purchaseDate)
  const amountFormatted = formatCurrencyText('amount-with-code', payload.currency, payload.amount, { decimals: 'fixed-2' })
  // Anonymous gifters surface as "Secret Gifter" per partner-locked
  // copy. Snapshot row's gifter_name is null for anonymous gifts (DB
  // CHECK enforces this), so the explicit branch + fallback covers
  // both paths defensively.
  const gifterDisplay = payload.isAnonymous
    ? 'Secret Gifter'
    : (payload.gifterName ?? 'Secret Gifter')

  try {
    const { authkeyWhatsAppService } = await import('@/lib/services/AuthkeyWhatsAppService')
    if (!authkeyWhatsAppService.isConfigured()) {
      console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_API_KEY unset', {
        reference: payload.reference,
      })
      return
    }

    const result = await authkeyWhatsAppService.sendTemplate({
      phone: payload.ambassadorPhone,
      templateWid: wid,
      templateName: 'wish_gifted_v1',
      bodyValues: {
        '1': payload.ambassadorFirstName,
        '2': payload.wishService,
        '3': gifterDisplay,
        '4': dateFormatted,
        '5': amountFormatted,
        '6': payload.reference,
      },
      buttonValues: {
        '1': payload.ambassadorSlug,
      },
    })

    if (result.success) {
      console.log('[ambassador-notif:whatsapp] wish_gifted sent', {
        reference: payload.reference,
        messageId: result.messageId,
      })
    } else {
      console.error('[ambassador-notif:whatsapp] wish_gifted send failed', {
        reference: payload.reference,
        error: result.error,
      })
    }
  } catch (err) {
    console.error('[ambassador-notif:whatsapp] wish_gifted threw', {
      reference: payload.reference,
      err,
    })
  }
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
      bcc: getOperatorBcc(),
      subject: 'We sent you money❤️',
      html,
      text: `Hi ${payload.ambassadorName},

We sent you money ❤️

Payout: ${formatCurrencyText('amount-with-code', payload.currency, payload.netAmount, { decimals: 'fixed-2' })}
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

  // Two-decimal grouped amount for the WhatsApp body. Inlined here
  // (not formatCurrencyText) because the WhatsApp template expects
  // amount and currency in separate slots — bodyValues['2'] is the
  // number alone, bodyValues['3'] carries the code. Keeps cross-channel
  // parity with the email/text receipts (same fixed-2 grouping shape).
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
// as Slice 7B payout-paid. AUTHKEY_WID_LISTING_EXPIRING_7D=32771 (UTILITY,
// Meta-approved; v1 wid=32766 was auto-recategorized to MARKETING and
// retired). Sender fail-soft if env var or AUTHKEY_API_KEY unset.

export interface ListingExpiringEmailPayload {
  ambassadorEmail: string
  ambassadorName: string
  serviceName: string
  professionalName: string
  expiryAt: Date
  listingId: string
  listingReference: string
  isFreeTrial: boolean
}

export interface ListingExpiringWhatsAppPayload {
  ambassadorPhone: string | null
  firstName: string
  serviceName: string
  professionalName: string
  expiryAt: Date
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
  }).format(payload.expiryAt)

  const html = renderListingExpiringEmail({
    firstName: payload.ambassadorName,
    serviceName: payload.serviceName,
    professionalName: payload.professionalName,
    expiryDate: formattedDate,
    listingReference: payload.listingReference,
    sendLinkUrl,
    isFreeTrial: payload.isFreeTrial,
  })

  const subject = payload.isFreeTrial ? 'Time to upgrade ⏰' : 'Time to renew ⏰'
  const text = payload.isFreeTrial
    ? `Hi ${payload.ambassadorName},

Time to upgrade ⏰

Free trial expires in 7 days.

Listing: ${payload.serviceName}
Professional: ${payload.professionalName}
Expires: ${formattedDate}

Send ${payload.professionalName} a payment link to keep their listing live.

Send payment link: ${sendLinkUrl}

WeLoveDecode`
    : `Hi ${payload.ambassadorName},

Time to renew ⏰

Listing expires in 7 days.

Listing: ${payload.serviceName}
Professional: ${payload.professionalName}
Expires: ${formattedDate}
Reference: ${payload.listingReference}

Keep your listing active.

Send renewal link: ${sendLinkUrl}

WeLoveDecode`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: payload.ambassadorEmail,
      bcc: getOperatorBcc(),
      subject,
      html,
      text,
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

  const wid = process.env.AUTHKEY_WID_LISTING_EXPIRING_7D
  if (!wid) {
    console.log('[ambassador-notif:whatsapp] skipped — AUTHKEY_WID_LISTING_EXPIRING_7D unset', {
      reference: payload.listingReference,
    })
    return
  }

  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(payload.expiryAt)

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

// ============================================================================
// 7-day listing-expiry reminder · professional-facing
// ============================================================================
// Sibling of sendListingExpiringEmail. Fires alongside the ambassador
// notifications from the daily cron, paid listings only (trials have
// no payer). Recipient is the Stripe receipt_email captured at
// listing checkout. No CTA — pro pings the ambassador for renewal.

export interface ListingExpiringProEmailPayload {
  payerEmail: string | null
  serviceName: string
  ambassadorFullName: string
  ambassadorFirstName: string
  packageDays: string
  expiryDate: string
  listingReference: string
}

export async function sendListingExpiringProEmail(payload: ListingExpiringProEmailPayload): Promise<void> {
  if (!payload.payerEmail) {
    console.log('[ambassador-notif:email] listing_expiring_pro skipped — no payer email', {
      reference: payload.listingReference,
    })
    return
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[ambassador-notif:email] RESEND_API_KEY unset, skipping send', {
      kind: 'listing_expiring_pro',
      reference: payload.listingReference,
      to: payload.payerEmail,
    })
    return
  }

  const html = renderListingExpiringProEmail({
    serviceName: payload.serviceName,
    ambassadorFullName: payload.ambassadorFullName,
    ambassadorFirstName: payload.ambassadorFirstName,
    packageDays: payload.packageDays,
    expiryDate: payload.expiryDate,
    listingReference: payload.listingReference,
  })

  const text = `Hello,

It's renewal time⏰

Your listing expires in 7 days.

---

Listing:        ${payload.serviceName}
Ambassador:     ${payload.ambassadorFullName}
Package:        ${payload.packageDays}
Expires:        ${payload.expiryDate}
Reference:      ${payload.listingReference}

---

To keep your spotlight, ask ${payload.ambassadorFirstName} for a renewal link.

Your DECODE team
welovedecode.com`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: payload.payerEmail,
      bcc: getOperatorBcc(),
      subject: `One week left on ${payload.ambassadorFirstName}'s page ⏰`,
      html,
      text,
    })
    if (error) {
      console.error('[ambassador-notif:email] listing_expiring_pro resend failed', {
        reference: payload.listingReference,
        error,
      })
      return
    }
    console.log('[ambassador-notif:email] listing_expiring_pro sent', {
      reference: payload.listingReference,
      to: payload.payerEmail,
    })
  } catch (err) {
    console.error('[ambassador-notif:email] listing_expiring_pro threw', {
      reference: payload.listingReference,
      err,
    })
  }
}

// ============================================================================
// Operator-facing notifications (internal triage surface)
// ============================================================================
// Fires once per fully-registered ambassador (after profile + instagram
// shadow update at /api/ambassador/model/setup). Single env var
// OPERATOR_BCC_EMAIL pulls double-duty: it's both the recipient address
// for this notification AND the BCC address for the 5 transactional emails
// above. Unset → silent (no signup notif, no BCC). Wiring lands once,
// behavior toggles via Vercel env.

export interface NewUserOperatorEmailPayload {
  method: 'WhatsApp' | 'Email'
  phone: string | null
  email: string | null
  firstName: string
  lastName: string
  slug: string
  instagramHandle: string
  createdAt: Date
}

function formatRegisteredAtForOperator(d: Date): string {
  // Hand-format date + time + zone suffix because Intl's
  // `timeZoneName: 'short'` renders "GMT+4" on some Node runtimes
  // instead of "GST". Splitting the two formats keeps the output
  // stable across runtimes.
  const dateOnly = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  }).format(d)
  const timeOnly = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Dubai',
  }).format(d)
  return `${dateOnly}, ${timeOnly} GST`
}

function buildNewUserSubject(payload: NewUserOperatorEmailPayload): string {
  const fullName = `${payload.firstName} ${payload.lastName}`.trim()
  if (fullName) return `New user - ${fullName} 🎉`
  if (payload.method === 'WhatsApp' && payload.phone) return `New user - ${payload.phone} 🎉`
  if (payload.method === 'Email' && payload.email) return `New user - ${payload.email} 🎉`
  return 'New user 🎉'
}

export async function sendNewUserOperatorEmail(payload: NewUserOperatorEmailPayload): Promise<void> {
  const operatorEmail = process.env.OPERATOR_BCC_EMAIL
  if (!operatorEmail) {
    console.log('[ambassador-notif:operator] OPERATOR_BCC_EMAIL unset, skipping new-user notif', {
      method: payload.method,
      slug: payload.slug,
    })
    return
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[ambassador-notif:operator] RESEND_API_KEY unset, skipping new-user notif', {
      method: payload.method,
      slug: payload.slug,
    })
    return
  }

  const registeredAt = formatRegisteredAtForOperator(payload.createdAt)
  const html = renderNewUserOperatorEmail({
    method: payload.method,
    phone: payload.phone,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    slug: payload.slug,
    instagramHandle: payload.instagramHandle,
    registeredAt,
  })

  const contactLine = payload.method === 'WhatsApp'
    ? `Phone: ${payload.phone ?? ''}`
    : `Email: ${payload.email ?? ''}`

  const text = `New user 🎉

Method: ${payload.method}
${contactLine}

First name: ${payload.firstName}
Last name: ${payload.lastName}

Slug: ${payload.slug}
Instagram: ${payload.instagramHandle}

Registered: ${registeredAt}

WeLoveDecode`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'WeLoveDecode <noreply@welovedecode.com>',
      to: operatorEmail,
      subject: buildNewUserSubject(payload),
      html,
      text,
    })
    if (error) {
      console.error('[ambassador-notif:operator] new-user resend failed', {
        slug: payload.slug,
        error,
      })
      return
    }
    console.log('[ambassador-notif:operator] new-user sent', {
      slug: payload.slug,
      method: payload.method,
    })
  } catch (err) {
    console.error('[ambassador-notif:operator] new-user threw', {
      slug: payload.slug,
      err,
    })
  }
}
