/**
 * Format a numeric amount for display in transactional emails.
 * Uses Intl.NumberFormat with the locale-neutral 'en' tag (a single
 * currency code already in scope; we don't localize beyond the digits
 * for V1). Two-decimal fixed; thousands grouping. Returns plain string.
 */
export function formatAmountForEmail(amount: number): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Slice 7B placeholder · payout-paid receipt email.
 *
 * Short, functional, on-brand. Real copy swap is a partner concern
 * post-V1 — the swap touches only this body, not the calling code.
 * Variable-driven so iterations don't require backend changes.
 *
 * Mirrors renderButtonEmail's Outlook-safe shell (VML roundrect for
 * mso, color-scheme meta, [data-ogsc] selectors). Same `WeLoveDecode`
 * wordmark heading + pink button pattern as the magic-link email.
 */
export function renderPayoutPaidEmail({
  firstName,
  netAmount,
  currency,
  payoutDate,
  payoutReference,
  statementUrl,
}: {
  firstName: string
  netAmount: number
  currency: string
  payoutDate: string
  payoutReference: string
  statementUrl: string
}): string {
  const amountDisplay = `${formatAmountForEmail(netAmount)} ${currency.toUpperCase()}`
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] .btn-bg, [data-ogsb] .btn-bg { background-color: #e91e8c !important; }
    [data-ogsc] .btn-txt, [data-ogsb] .btn-txt { color: #ffffff !important; }
    [data-ogsc] .body, [data-ogsb] .body { color: #111111 !important; }
    [data-ogsc] .muted, [data-ogsb] .muted { color: #444444 !important; }
    [data-ogsc] .signoff, [data-ogsb] .signoff { color: #111111 !important; }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="left">
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 16px;">Hi ${firstName},</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">We sent you money❤️</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Payout: ${amountDisplay}<br>Date: ${payoutDate}<br>Reference: ${payoutReference}</p>
        <p class="muted" style="font-size:15px;line-height:1.6;color:#444444;margin:0 0 32px;">Funds arrive in 1–2 business days.</p>
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${statementUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" strokecolor="#e91e8c" fillcolor="#e91e8c">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">View statement</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" class="btn-bg" bgcolor="#e91e8c" style="background-color:#e91e8c;border-radius:8px;">
          <tr>
            <td class="btn-bg" bgcolor="#e91e8c" align="center" style="background-color:#e91e8c;border-radius:8px;">
              <a class="btn-txt" href="${statementUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;line-height:20px;border-radius:8px;background-color:#e91e8c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">View statement</a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
        <p class="signoff" style="font-size:14px;line-height:1.6;color:#111111;margin:32px 0 0;">WeLoveDecode</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * 7-day listing-expiry reminder email (ambassador-side).
 *
 * Two variants:
 * - PAID  (isFreeTrial=false) → "Time to renew" + reference row +
 *   "Send renewal link" CTA.
 * - TRIAL (isFreeTrial=true)  → "Time to upgrade" + no reference
 *   (no payment exists yet) + "Send payment link" CTA + softer
 *   trailing prose pointing the ambassador at the professional.
 *
 * Receipt-style monospace data block (Courier New, white-space:pre)
 * with box-drawing separators is the partner-locked aesthetic for
 * all transactional summary emails — same pattern reused by the
 * upcoming listing-paid + wish-gifted helpers.
 *
 * Same Outlook-safe shell as renderPayoutPaidEmail (left-aligned,
 * VML roundrect, color-scheme light only, [data-ogsc] selectors,
 * WeLoveDecode wordmark as bottom sign-off).
 */
export function renderListingExpiringEmail({
  firstName,
  serviceName,
  professionalName,
  expiryDate,
  listingReference,
  sendLinkUrl,
  isFreeTrial,
}: {
  firstName: string
  serviceName: string
  professionalName: string
  expiryDate: string
  listingReference: string
  sendLinkUrl: string
  isFreeTrial: boolean
}): string {
  const heading = isFreeTrial ? 'Time to upgrade ⏰' : 'Time to renew ⏰'
  const expiryLine = isFreeTrial ? 'Free trial expires in 7 days.' : 'Listing expires in 7 days.'
  const trailingLine = isFreeTrial
    ? `Send ${professionalName} a payment link to keep their listing live.`
    : 'Keep your listing active.'
  const buttonLabel = isFreeTrial ? 'Send payment link' : 'Send renewal link'

  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const dataBlock = isFreeTrial
    ? `${separator}

Listing:        ${serviceName}
Professional:   ${professionalName}
Expires:        ${expiryDate}

${separator}`
    : `${separator}

Listing:        ${serviceName}
Professional:   ${professionalName}
Expires:        ${expiryDate}
Reference:      ${listingReference}

${separator}`

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] .btn-bg, [data-ogsb] .btn-bg { background-color: #e91e8c !important; }
    [data-ogsc] .btn-txt, [data-ogsb] .btn-txt { color: #ffffff !important; }
    [data-ogsc] .body, [data-ogsb] .body { color: #111111 !important; }
    [data-ogsc] .signoff, [data-ogsb] .signoff { color: #111111 !important; }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="left">
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 16px;">Hi ${firstName},</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">${heading}</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">${expiryLine}</p>
        <div style="margin:0 0 24px;"><pre style="font-family:'Courier New',Consolas,monospace;font-size:14px;line-height:1.6;margin:0;white-space:pre;color:#111111;">${dataBlock}</pre></div>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 32px;">${trailingLine}</p>
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${sendLinkUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" strokecolor="#e91e8c" fillcolor="#e91e8c">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">${buttonLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" class="btn-bg" bgcolor="#e91e8c" style="background-color:#e91e8c;border-radius:8px;">
          <tr>
            <td class="btn-bg" bgcolor="#e91e8c" align="center" style="background-color:#e91e8c;border-radius:8px;">
              <a class="btn-txt" href="${sendLinkUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;line-height:20px;border-radius:8px;background-color:#e91e8c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${buttonLabel}</a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
        <p class="signoff" style="font-size:14px;line-height:1.6;color:#111111;margin:32px 0 0;">WeLoveDecode</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const RECEIPT_SEPARATOR = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

function stripUrlProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

/**
 * Listing-paid receipt email — sent to the professional whose listing
 * was just purchased by an ambassador's audience. Receipt-style
 * monospace data block with box-drawing separators (matches the
 * partner-locked aesthetic established in renderListingExpiringEmail).
 *
 * No bottom-button CTA: the email surfaces two plain-text URLs (public
 * page + receipt) inline as the conversion is "discovery" rather than
 * a single-action funnel.
 *
 * Same Outlook-safe shell as the other receipt templates (left-aligned,
 * color-scheme light only, [data-ogsc] selectors, white background).
 */
export function renderListingPaidEmail({
  ambassadorFirstName,
  ambassadorFullName,
  professionalName,
  packageDays,
  reference,
  purchaseDate,
  amount,
  currency,
  startDate,
  endDate,
  ambassadorSlug,
  receiptUrl,
}: {
  ambassadorFirstName: string
  ambassadorFullName: string
  professionalName: string
  packageDays: number
  reference: string
  purchaseDate: string
  amount: number
  currency: string
  startDate: string
  endDate: string
  ambassadorSlug: string
  receiptUrl: string
}): string {
  const amountDisplay = `${formatAmountForEmail(amount)} ${currency.toUpperCase()}`
  const listingUrl = `https://app.welovedecode.com/${ambassadorSlug}`
  const listingUrlDisplay = `app.welovedecode.com/${ambassadorSlug}`
  const receiptUrlDisplay = stripUrlProtocol(receiptUrl)
  const dataBlock = `${RECEIPT_SEPARATOR}

Ambassador:     ${ambassadorFullName}
Reference:      ${reference}
Service:        ${packageDays}-day listing on ${ambassadorFirstName}'s page
Purchase date:  ${purchaseDate}
Amount:         ${amountDisplay}
Start date:     ${startDate}
End date:       ${endDate}

${RECEIPT_SEPARATOR}`

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] .body, [data-ogsb] .body { color: #111111 !important; }
    [data-ogsc] .signoff, [data-ogsb] .signoff { color: #111111 !important; }
    [data-ogsc] .link, [data-ogsb] .link { color: #e91e8c !important; }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="left">
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 16px;">Congrats</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">${professionalName} is now live on ${ambassadorFirstName}'s page 🎉</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Thousands of her followers will be able to discover your work.</p>
        <div style="margin:0 0 24px;"><pre style="font-family:'Courier New',Consolas,monospace;font-size:14px;line-height:1.6;margin:0;white-space:pre;color:#111111;">${dataBlock}</pre></div>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 8px;">View listing:<br><a class="link" href="${listingUrl}" style="color:#e91e8c;text-decoration:none;">${listingUrlDisplay}</a></p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">View receipt online:<br><a class="link" href="${receiptUrl}" style="color:#e91e8c;text-decoration:none;">${receiptUrlDisplay}</a></p>
        <div style="margin:0 0 24px;"><pre style="font-family:'Courier New',Consolas,monospace;font-size:14px;line-height:1.6;margin:0;white-space:pre;color:#111111;">${RECEIPT_SEPARATOR}</pre></div>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Didn't make this payment? Please reply right away.</p>
        <p class="signoff" style="font-size:14px;line-height:1.6;color:#111111;margin:32px 0 0;">Your DECODE team<br>welovedecode.com</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Wish-gifted receipt email — sent to the gifter who just fulfilled
 * an ambassador's wish. Two variants:
 * - NAMED (isAnonymous=false) → confirms the gifter's name + Instagram
 *   appear on the Wall of Love.
 * - ANONYMOUS (isAnonymous=true) → confirms identity stays private,
 *   data block shows "Visibility: Anonymous" instead of name + IG rows.
 *
 * Same receipt-style monospace shell as renderListingPaidEmail.
 */
export function renderWishGiftedEmail({
  ambassadorFirstName,
  ambassadorFullName,
  isAnonymous,
  reference,
  giftLabel,
  purchaseDate,
  amount,
  currency,
  gifterName,
  gifterInstagram,
  ambassadorSlug,
  receiptUrl,
}: {
  ambassadorFirstName: string
  ambassadorFullName: string
  isAnonymous: boolean
  reference: string
  giftLabel: string
  purchaseDate: string
  amount: number
  currency: string
  gifterName: string | null
  gifterInstagram: string | null
  ambassadorSlug: string
  receiptUrl: string
}): string {
  const amountDisplay = `${formatAmountForEmail(amount)} ${currency.toUpperCase()}`
  const listingUrl = `https://app.welovedecode.com/${ambassadorSlug}`
  const listingUrlDisplay = `app.welovedecode.com/${ambassadorSlug}`
  const receiptUrlDisplay = stripUrlProtocol(receiptUrl)

  const visibilityProse = isAnonymous
    ? `<p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Your gift will appear as &quot;Anonymous&quot; on her Wall of Love.</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Your name and Instagram stay private.</p>`
    : `<p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Thousands will see your name and Instagram on her Wall of Love.</p>`

  const dataBlock = isAnonymous
    ? `${RECEIPT_SEPARATOR}

Gift received:  ${ambassadorFullName}
Reference:      ${reference}
Gift:           ${giftLabel}
Purchase date:  ${purchaseDate}
Amount:         ${amountDisplay}
Visibility:     Anonymous

${RECEIPT_SEPARATOR}`
    : `${RECEIPT_SEPARATOR}

Gift received:  ${ambassadorFullName}
Reference:      ${reference}
Gift:           ${giftLabel}
Purchase date:  ${purchaseDate}
Amount:         ${amountDisplay}
Your name:      ${gifterName ?? ''}
Your IG:        @${gifterInstagram ?? ''}

${RECEIPT_SEPARATOR}`

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] .body, [data-ogsb] .body { color: #111111 !important; }
    [data-ogsc] .signoff, [data-ogsb] .signoff { color: #111111 !important; }
    [data-ogsc] .link, [data-ogsb] .link { color: #e91e8c !important; }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="left">
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 16px;">Amazing</p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">You fulfilled ${ambassadorFirstName}'s beauty wish 🎁</p>
        ${visibilityProse}
        <div style="margin:0 0 24px;"><pre style="font-family:'Courier New',Consolas,monospace;font-size:14px;line-height:1.6;margin:0;white-space:pre;color:#111111;">${dataBlock}</pre></div>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 8px;">View ${ambassadorFirstName}'s page:<br><a class="link" href="${listingUrl}" style="color:#e91e8c;text-decoration:none;">${listingUrlDisplay}</a></p>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">View receipt online:<br><a class="link" href="${receiptUrl}" style="color:#e91e8c;text-decoration:none;">${receiptUrlDisplay}</a></p>
        <div style="margin:0 0 24px;"><pre style="font-family:'Courier New',Consolas,monospace;font-size:14px;line-height:1.6;margin:0;white-space:pre;color:#111111;">${RECEIPT_SEPARATOR}</pre></div>
        <p class="body" style="font-size:15px;line-height:1.6;color:#111111;margin:0 0 24px;">Didn't make this gift? Please reply right away.</p>
        <p class="signoff" style="font-size:14px;line-height:1.6;color:#111111;margin:32px 0 0;">Your DECODE team<br>welovedecode.com</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Shared Outlook-dark-mode-safe button email template.
 *
 * Design notes:
 * - `color-scheme` + `supported-color-schemes` meta opt out of automatic
 *   dark-mode color inversion in Apple Mail, Outlook Web, and iOS Mail.
 * - VML roundrect fallback renders a real pink button in Outlook for
 *   Windows desktop (mso), which ignores CSS padding/bgcolor on anchors.
 * - `[data-ogsc]` attribute selectors target Outlook.com web specifically
 *   so dark-mode overrides don't recolor the button.
 * - Background declared on `<td>` (`bgcolor=`), `<a>` (`background-color`),
 *   AND inline class; any one surviving the client's sanitizer is enough.
 */
export function renderButtonEmail({
  heading,
  buttonLabel,
  callbackUrl,
}: {
  heading: string
  buttonLabel: string
  callbackUrl: string
}): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] .btn-bg, [data-ogsb] .btn-bg { background-color: #e91e8c !important; }
    [data-ogsc] .btn-txt, [data-ogsb] .btn-txt { color: #ffffff !important; }
    [data-ogsc] .heading, [data-ogsb] .heading { color: #111111 !important; }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="center">
        <h1 class="heading" style="font-size:20px;font-weight:700;margin:0 0 24px;color:#111111;">${heading}</h1>
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${callbackUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" strokecolor="#e91e8c" fillcolor="#e91e8c">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">${buttonLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-bg" bgcolor="#e91e8c" style="background-color:#e91e8c;border-radius:8px;">
          <tr>
            <td class="btn-bg" bgcolor="#e91e8c" align="center" style="background-color:#e91e8c;border-radius:8px;">
              <a class="btn-txt" href="${callbackUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;line-height:20px;border-radius:8px;background-color:#e91e8c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${buttonLabel}</a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}
