# Checkout (Professional) — UI Spec (FINAL)

**File:** `checkout_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/checkout/{payment_link_token}` — public, no auth required
**Access:** Anyone with the link (sent by ambassador via WhatsApp/email)

---

## 1. Purpose

A single landing page where a professional (e.g. Salon de Luxe) can:
1. Preview the ambassador's public page (inline overlay, no tab switch)
2. See their listing details (pre-filled by the ambassador on `add_listing_final.html`)
3. Pick a package (30 / 60 / 90 days)
4. Pay via Apple Pay, Google Pay, or card — all inside an in-page modal (no Stripe-hosted redirect)
5. Land on the confirmation page after successful payment

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| WhatsApp message from Sara | Tap the link Sara shared via `send_payment_link_after_listing.html` | Most common path. Opens in phone's default browser (or in-app WebView if opened inside WhatsApp). |
| Email from Sara | Tap link in email Sara sent | Same link as WhatsApp, different delivery channel |
| Direct paste of link | Professional saved it, pastes into browser | Works the same as WhatsApp tap |
| Sara opens her own link | Tap the link from her Dashboard (e.g. to preview what professional sees) | **Sara sees the same checkout** — no special "owner" view. Acceptable edge: she can try to pay her own listing, Stripe will still process it. |

**No authentication required.** This is a public URL keyed by a unique `payment_link_token` (not the `listings.id` — tokens prevent ID enumeration).

### 2.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| URL link under ambassador's name (`welovedecode.com/sarajohnson`) | In-page overlay | Same | **Does NOT open a new tab.** Slides up a full-screen overlay with the ambassador's public page (iframe in production). Tap X to dismiss. |
| Overlay X button | Dismiss overlay | Same | Returns to checkout, state preserved |
| Package tap (30 / 60 / 90 days) | No navigation | — | Selection-only. Updates Pay button amount + visibility note. |
| Pay button (pink, bottom) | In-page modal | — | Opens payment modal with package state |
| Modal X / Cancel / dimmed overlay tap / drag handle | Close modal | — | Returns to checkout, package still selected |
| Modal Apple Pay button | Native Apple/Google Pay sheet | — | Stripe Express Checkout Element handles device detection + sheet |
| Modal Pay by card button | Card form (same modal) | — | Swaps view to card form, keeps chips + price visible |
| Modal Pay button (on card form) | Stripe Payment Element confirmation | — | On success → redirect to confirmation page. On failure → error banner inline, stays in modal. |
| Successful payment (Apple Pay or card) | `/listing/confirmation?tx={reference}` | Same | Stripe confirmPayment `return_url`. Renders `listing_payment_confirmation_final.html`. |

### 2.3 Backend writes (all triggers and endpoints)

| Action | Trigger | Endpoint | Notes |
|---|---|---|---|
| Page load | Mount | `GET /api/payment-link/{token}` | Returns ambassador details, listing details, package options, pricing, and the listing ID (status='pending_payment') |
| Expired link check | Mount | Same endpoint | If link is past `payment_link_expires_at` → server returns 410 Gone → frontend redirects to `payment_link_no_longer_active_minimal.html` |
| URL preview load | User taps URL | Iframe `src="/{slug}"` | Iframe loads the ambassador's public page. No separate API call. |
| Package selection | Tap any package row | None — client state only | Selection stored locally until "Pay" is tapped |
| Pay button tap | Click Pay | `POST /api/stripe/create-payment-intent` | Creates a Stripe PaymentIntent server-side with the selected package amount. Returns `client_secret` for Stripe.js. |
| Payment confirmation | `stripe.confirmPayment()` | Stripe API (client) | Stripe handles 3DS, authentication, card tokenization. No direct DB write from frontend. |
| Payment success | Stripe webhook `payment_intent.succeeded` | Server-to-server | Backend updates `listings.status = 'active'`, sets `paid_at`, computes `expires_at`, fires notifications (see §6) |
| Payment failure | Stripe webhook `payment_intent.payment_failed` | Server-to-server | `listings.status` stays `pending_payment`. No row mutation. User retries in the modal. |

### 2.4 Resolved decisions (everything previously unclear)

| Item | Decision |
|---|---|
| Currency on checkout page | Ambassador's currency (pulled from `users.currency`, set during onboarding) — e.g. AED for Sara |
| Cover image | Pulled from `users.cover_photo_url` (same image Sara uploaded during onboarding/Settings) |
| URL link behavior | In-page overlay (Instagram-style), NOT new tab, NOT non-clickable |
| "Your details" editability on this page | **Read-only.** Professional cannot edit Name / Instagram / Category — those were entered by Sara on `add_listing_final.html`. |
| Modal Cancel behavior | Closes modal, returns to checkout, package selection preserved |
| After successful payment | Pay button text changes to "Processing…" and stays. Modal remains visible. Stripe redirects the browser to `/listing/confirmation/{pi_xxx}` automatically. No invented success UI between Stripe confirm and redirect. |
| After failed payment | Stays in modal, inline error banner, user can retry. No redirect. |
| Apple Pay cancelled / failed | Returns to modal default state (Apple Pay + Pay by card visible). No error shown — user initiated cancel. |
| Listings row timing | Created on `add_listing_final.html` with `status='pending_payment'` BEFORE payment. On success → `status='active'`. Lets Sara track pending listings in her dashboard. |
| Sara opening her own link | Sees the same checkout as professionals. No special owner view. |
| Payment link validity | 7 days from link creation |
| **URL route format** | `welovedecode.com/checkout/{token}` — opaque 64-char token, not the reference. Prevents ID enumeration. |
| **Reference vs token** | Two separate values: `reference` (L + 7 digits, user-facing on receipt) + `payment_link_token` (random opaque string, URL-only, unguessable) |
| **Card form validation errors** | Show Stripe's error inline in the error banner. Don't pre-validate on our side — Stripe already does it. |
| **Idempotency (double-tap Pay)** | Both frontend AND backend protection: (1) frontend sets `window._paying = true` on first tap, ignores subsequent taps; (2) backend sends Stripe idempotency key on every PaymentIntent create |
| **URL overlay iframe load failure** | Fallback to simple info card inside overlay: ambassador name + tagline + "Unable to load full page" notice. Data pulled from already-loaded payload — no extra API call. |
| **URL overlay security** | Public ambassador page MUST send `Content-Security-Policy: frame-ancestors 'self'` header — only the WeLoveDecode origin can embed via iframe. Prevents third-party sites from embedding Sara's page in phishing/clickjacking frames. |
| **Browser close during payment** | Server is source of truth — Stripe webhook fires regardless. Listing goes active, Sara gets both email + WhatsApp, professional gets Stripe receipt email. Only thing missed is our confirmation page visual. `beforeunload` warning shown during active payment to prevent accidental closes. |
| **Automatic follow-up to professional** | **None.** No email/WhatsApp from the system or Sara is sent to the professional in ANY scenario — not on abandonment, not on payment failure, not on expiry, not on renewal reminder. Sara handles all professional communication manually outside the platform. The only email the professional receives is Stripe's automatic payment receipt (which cannot be disabled). |
| **Sara's pending listings dashboard** | Listed in her Dashboard "Listings" section with "Pending Payment" badge. Separate design TBD. Schema supports it via `status` column. |

---

## 3. Data Loading

### 3.1 Page mount

```
GET /api/payment-link/{token}
```

Returns:
```json
{
  "listing": {
    "id": "uuid",
    "reference": "L8473921",
    "status": "pending_payment",
    "professional_name": "Salon de Luxe",
    "professional_instagram": "salonluxe",
    "category": "Hair"
  },
  "ambassador": {
    "id": "uuid",
    "slug": "sarajohnson",
    "first_name": "Sara",
    "full_name": "Sara Johnson",
    "tagline": "Get listed in Sara's Beauty Squad",
    "cover_photo_url": "https://.../cover-photos/sara.jpg",
    "currency": "AED"
  },
  "packages": [
    {"days": 30, "total": 30, "per_day": 1.00},
    {"days": 60, "total": 50, "per_day": 0.83, "savings_pct": 17},
    {"days": 90, "total": 70, "per_day": 0.78, "savings_pct": 22, "default": true}
  ],
  "payment_link_expires_at": "2026-04-20T09:41:00Z"
}
```

Package pricing is **per-listing** — Sara set these values when she created the listing on `add_listing_final.html`. They are NOT hardcoded platform-wide.

The "Save N%" badge is computed server-side from the cheapest per-day rate (30-day baseline) to prevent drift.

### 3.2 URL preview (overlay)

Iframe loads:
```
https://welovedecode.com/{ambassador.slug}
```

No separate API call. Iframe shares top-level origin so it loads cleanly without CSP headaches.

---

## 4. Layout

1. Cover image (180px) — `users.cover_photo_url` + gradient fade
2. Header (overlapping cover):
   - Ambassador name (24px, bold)
   - URL (11px, underlined — opens overlay)
   - Tagline (15px, semibold)
3. Divider
4. "Your details" card (read-only: Name / Instagram / Category)
5. "Choose your package" section
6. Three package rows (30 / 60 / 90 days) with "Save N%" badges
7. Pay note ("One-time payment · N days visibility")
8. Pay button (pink, full-width) — opens modal

---

## 5. Payment Modal

### 5.1 Default view

- **Amount** (32px bold): `AED {total}` — dynamic, matches selected package
- **Three chips** (pink checkmarks): `One-time` · `No subscription` · `{N} days package`
- **Apple Pay button** (black, 52px, white Apple logo + "Pay" text)
  - Stripe Express Checkout Element auto-renders the correct wallet per device:
    - iPhone/Safari → Apple Pay
    - Android/Chrome → Google Pay
    - Desktop Chrome → Link or Google Pay (per user setup)
    - No wallet available → button doesn't render (card becomes primary)
- **"Pay by card"** outline button
- **Cancel** link

### 5.2 Card form view

Same header (amount + chips), then:
- Card number
- MM/YY  •  CVC (side-by-side)
- Email for receipt
- Country
- **Pay AED {total}** pink button (disabled until fields are filled)
- "Secure payment by Stripe" footer (lock icon)
- **Cancel** link (no Back button — Cancel dismisses the whole modal)

### 5.3 Stripe integration (critical implementation notes for Claude Code)

**Elements used:**
1. **Express Checkout Element** — renders the Apple Pay / Google Pay button
2. **Payment Element** (card mode only, wallets suppressed via `paymentMethodTypes: ['card']`) — renders the card form

Per [Stripe docs](https://docs.stripe.com/payments/payment-element), combining these two is the supported pattern; Stripe deduplicates wallets so Apple Pay never appears twice.

**Flow:**
```
1. On page mount:
   - POST /api/stripe/create-payment-intent
     body: { listing_id, package_days, amount }
   - Receive { client_secret }
   - Initialize Stripe.js with client_secret

2. On Pay button tap:
   - Open modal (no new Stripe call yet)
   - Express Checkout Element mounted inside
   - User taps Apple Pay button → Stripe shows native sheet

3. On wallet confirm:
   - stripe.confirmPayment({
       elements,
       confirmParams: { return_url: 'https://welovedecode.com/listing/confirmation?tx={reference}' }
     })

4. On success:
   - Stripe redirects to return_url
   - Server marks listing as active via webhook
   - Frontend renders confirmation page with tx details
```

**In-app WebView caveat** (important): if professional opens the link inside the WhatsApp or Instagram in-app browser, Apple Pay popups may be blocked. Detection:
```js
if (/WhatsApp|Instagram|FBAN|FBAV/i.test(navigator.userAgent)) {
  // Show subtle banner: "Open in Safari/Chrome for faster checkout with Apple Pay"
}
```
Card form always works in WebViews — it's the reliable fallback.

### 5.4 Domain registration

Before Apple Pay works:
1. Add `welovedecode.com` (and any staging/preview domains) to **Payment Method Domains** in Stripe Dashboard
2. Host the Apple verification file at `/.well-known/apple-developer-merchantid-domain-association`
3. Click "Verify" in Stripe Dashboard

Without domain registration, Apple Pay button will not appear even on iOS Safari.

---

## 6. Notifications (on successful payment)

Triggered by the Stripe webhook `payment_intent.succeeded` — BEFORE the redirect to the confirmation page arrives. Both fire immediately (no Settings toggle yet).

### 6.1 Email to Sara — via Resend API

```
POST https://api.resend.com/emails
Authorization: Bearer re_xxxxxxxxxxxx
Content-Type: application/json

{
  "from": "WeLoveDecode <notifications@welovedecode.com>",
  "to": ["sara@email.com"],
  "subject": "New listing on your page — Salon de Luxe",
  "html": "<!-- template below -->"
}
```

**Template body:**
```
🎉 New listing!

Salon de Luxe just booked a 90-day listing on your page for AED 70.

Active until: 4 July 2026
Category: Hair
Instagram: @salonluxe
Reference: L8473921

[View your page →] https://welovedecode.com/sarajohnson

Thanks for being part of WeLoveDecode.
```

Required payload fields:
- `from` — verified sender in Resend dashboard
- `to` — Sara's email (from `users.email`)
- `subject` — dynamic with professional name
- Template variables: `{professional_name}`, `{package_days}`, `{amount}`, `{currency}`, `{active_until}`, `{category}`, `{instagram}`, `{reference}`, `{ambassador_slug}`

### 6.2 WhatsApp to Sara — via AUTHKey API

Same provider as onboarding OTP — reuse the existing integration.

```
POST https://api.authkey.io/request
Content-Type: application/x-www-form-urlencoded

authkey=XXXXXXXXXX
&mobile=971501234567
&country_code=971
&sid=<template_id>
&company=WeLoveDecode
&PVAR1=Salon de Luxe
&PVAR2=90
&PVAR3=AED 70
&PVAR4=L8473921
```

**Template copy (registered with AUTHKey):**
```
🎉 New listing! Salon de Luxe just booked a {PVAR2}-day listing for {PVAR3}. Ref {PVAR4}. View: welovedecode.com/sarajohnson
```

Required payload fields:
- `authkey` — API key (server env var)
- `mobile` — Sara's phone in international format WITHOUT `+` prefix
- `country_code` — extracted from Sara's phone
- `sid` — template ID (register this exact copy in AUTHKey dashboard first)
- `PVAR*` — template variables in order

### 6.3 Professional's email receipt — via Stripe

Stripe automatically sends the payment receipt to the email entered in the Payment Element or collected from Apple Pay's wallet. **No separate email needed from WeLoveDecode.**

Configure branding in Stripe Dashboard → Settings → Branding:
- Logo
- Primary color (`#e91e8c`)
- Reply-to: `support@welovedecode.com`

### 6.4 Trigger timing

All three fire from the same webhook handler, in parallel:

```
webhook handler (payment_intent.succeeded)
├─ UPDATE listings SET status='active', paid_at=NOW(), expires_at=NOW()+INTERVAL {days} DAY
├─ Resend API call (email Sara)
├─ AUTHKey API call (WhatsApp Sara)
└─ Stripe handles receipt to professional automatically
```

All three should be wrapped in try/catch — notification failure should NOT roll back the DB update. Log failures to a retry queue.

---

## 7. Listings table — suggested schema

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(8) UNIQUE NOT NULL,  -- Format: L + 7 digits (e.g. L8473921)
  ambassador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Professional details (denormalized — no separate professionals table)
  professional_name VARCHAR(200) NOT NULL,
  professional_instagram VARCHAR(100),
  category VARCHAR(50) NOT NULL REFERENCES categories(slug),

  -- Package
  package_days INT NOT NULL CHECK (package_days IN (30, 60, 90)),
  amount DECIMAL(10,2) NOT NULL,  -- Snapshotted at payment
  currency CHAR(3) NOT NULL,       -- Snapshotted (ambassador's currency at creation)

  -- Stripe
  stripe_payment_intent_id VARCHAR(255),
  payment_link_token VARCHAR(64) UNIQUE NOT NULL,

  -- Status lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'active', 'expired', 'refunded')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- Sara created the listing
  paid_at TIMESTAMPTZ,                                -- Professional paid
  expires_at TIMESTAMPTZ,                             -- paid_at + package_days
  payment_link_expires_at TIMESTAMPTZ NOT NULL        -- created_at + 7 days
);

CREATE INDEX idx_listings_ambassador ON listings(ambassador_id);
CREATE INDEX idx_listings_status_expires ON listings(status, expires_at);
CREATE INDEX idx_listings_payment_link_token ON listings(payment_link_token);
CREATE UNIQUE INDEX idx_listings_reference ON listings(reference);
```

### 7.1 Reference format
- `L` + 7 digits (L + 0000000 to 9999999 = 10M unique refs)
- Generate via DB sequence + prefix, NOT random (simpler debugging, sequential ordering)

### 7.2 Status transitions
```
pending_payment → active    (on Stripe webhook success)
pending_payment → expired   (on cron job: created_at + 7 days passed, no payment)
active          → expired   (on cron job: expires_at passed)
active          → refunded  (manual admin action)
```

### 7.3 Daily cron jobs
1. Expire pending listings past `payment_link_expires_at` (status → `expired`)
2. Expire active listings past `expires_at` (status → `expired`) — listing disappears from Sara's public page
3. Sara is notified via email + WhatsApp when her own listing expires (own-ambassador notification, per §6). **No notification sent to the professional.** Sara can manually reach out if she wants renewal.

---

## 8. Page offline / link expired

When professional opens a link past `payment_link_expires_at`:
- Server returns 410 Gone from `GET /api/payment-link/{token}`
- Frontend redirects to `payment_link_no_longer_active_minimal.html` (already designed)
- Copy: **"Link no longer active / This payment link has been removed."**

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| Professional paid, then Sara deletes her profile | Listing stays in professional's receipt history (stored on Stripe). Ambassador's public page is gone, so listing has no destination. No refund (per policy — packages are time-windowed). |
| Payment link expired but listing row still exists | Row stays in DB with `status='pending_payment'` past `payment_link_expires_at`. Cron job transitions it to `status='expired'` after N days. Sara sees it in dashboard as "Payment never completed." |
| Professional submits card, Stripe times out | Modal shows "Payment could not be completed. Try again." User retries. No DB changes. |
| Professional tries same listing link twice after paying | Server returns 409 Conflict from `GET /api/payment-link/{token}` with `{ already_paid: true, reference: 'L8473921' }`. Frontend redirects to `/listing/confirmation?tx=L8473921` (shows receipt they already have). |
| Network dies mid-Apple Pay confirm | Stripe's retry logic handles it. If confirmation succeeds server-side, webhook fires normally. If not, user sees error and retries. Idempotency key on PaymentIntent prevents double-charge. |
| Professional's card declined for 3DS | Stripe shows 3DS popup inline. If popup blocked (in-app WebView), Stripe falls back to redirect. |

---

## 10. Related files in the full flow

| File | Purpose | Status |
|---|---|---|
| `add_listing_final.html` | Sara enters professional's details + sets package prices | Final (untouched) |
| `send_payment_link_after_listing.html` | Sara shares the payment link via WhatsApp/email/copy | Final (untouched) |
| **`checkout_final.html`** | **Professional picks package + pays** | **This file** |
| `listing_payment_confirmation_final.html` | Success page after payment | Final (untouched) |
| `payment_link_no_longer_active_minimal.html` | Expired link page | Final (untouched) |

### 10.1 ⚠️ Dashboard + Listing page integration (for Claude Code)

When the listings row is created on `add_listing_final.html` with `status='pending_payment'`, the following places must read and display it:

| Location | Display |
|---|---|
| **Sara's Dashboard** (`/dashboard`) | Pending listings visible with "Pending Payment" badge + shared payment link + "Copy link" / "Resend via WhatsApp" actions |
| **Listings page** (if separate from Dashboard) | Same — pending listings shown alongside active ones with status badge |

Claude Code should:
1. Query `SELECT * FROM listings WHERE ambassador_id = ? ORDER BY status, created_at DESC` on both Dashboard and Listings page
2. Render grouping: Active first (alphabetical or by expiry), then Pending, then Expired
3. "Pending Payment" badge: yellow or neutral grey (NOT red — nothing is wrong, just waiting)
4. Action buttons per row: Copy link / Resend link / View listing / Delete (only for pending)
5. On successful payment (via webhook), status flips to `active` — Dashboard/Listings page re-fetches on next load (or real-time via Supabase subscription if available)

Renewal notifications for expiring listings are handled on the Listings page (separate spec — not this file's concern).

---

## 11. Build checklist for Claude Code

### Frontend
- [ ] Fetch `GET /api/payment-link/{token}` on mount, render dynamically
- [ ] Pull `users.cover_photo_url` via ambassador ID in payload — use for cover background
- [ ] Ambassador currency from payload — all prices display in that currency
- [ ] URL overlay: swap the `.publicPage` placeholder for `<iframe src="https://welovedecode.com/{slug}">`
- [ ] URL overlay: handle iframe `onerror` / timeout → show "Couldn't load page" + Retry button
- [ ] Wire Pay button to open modal (state: selected package)
- [ ] Mount Stripe Express Checkout Element in `#apple-pay-container`
- [ ] Mount Stripe Payment Element (card only) in card form view
- [ ] Handle `confirm` event from both Elements → `stripe.confirmPayment({ return_url })`
- [ ] Idempotency: frontend `window._paying` flag prevents double-tap on Apple Pay + Pay buttons
- [ ] `beforeunload` listener armed during active payment, disarmed on success/failure
- [ ] On Pay tap, change button text to "Processing…" and keep modal visible until Stripe redirects (no invented success UI between confirm and redirect)
- [ ] In-app WebView detection → show subtle banner about opening in Safari/Chrome
- [ ] Error banner for failed payments (stays in modal, doesn't dismiss, shows Stripe's error message verbatim)
- [ ] Apple Pay cancelled → silent, no error, reset `_paying` flag

### Backend
- [ ] `GET /api/payment-link/{token}` — returns payload per §3.1
- [ ] `POST /api/stripe/create-payment-intent` — creates Stripe PaymentIntent with **Stripe idempotency key** (key = `listing_id + package_days`) to prevent duplicate charges on retries
- [ ] Public ambassador page serves `Content-Security-Policy: frame-ancestors 'self'` header so only WeLoveDecode checkout can embed it via iframe
- [ ] Webhook handler for `payment_intent.succeeded`:
  - Update listings row (status, paid_at, expires_at)
  - Fire Resend API (email Sara)
  - Fire AUTHKey API (WhatsApp Sara)
- [ ] Webhook handler for `payment_intent.payment_failed` — log, no DB change
- [ ] Cron job: expire pending listings past `payment_link_expires_at`
- [ ] Cron job: expire active listings past `expires_at`, notify Sara with renewal CTA
- [ ] Categories reference table (`categories`) — seed with Hair, Nails, Makeup, Skin, Wellness, etc.
- [ ] Reserved-slug list on server (for ambassador URL — separate from this page but referenced)

### Integration with Dashboard / Listings page (see §10.1)
- [ ] Render pending listings on Dashboard with "Pending Payment" badge
- [ ] Render pending listings on Listings page same way
- [ ] Connect: when Stripe webhook flips status to `active`, those pages should reflect it on next load or real-time

### Stripe Dashboard
- [ ] Enable Apple Pay (Business Settings > Payment Methods)
- [ ] Register `welovedecode.com` as Payment Method Domain
- [ ] Host Apple verification file at `/.well-known/apple-developer-merchantid-domain-association`
- [ ] Configure receipt email branding (logo, color, reply-to)
- [ ] Configure Stripe webhook endpoint for `payment_intent.*` events

### Resend setup
- [ ] Verify sending domain (welovedecode.com SPF/DKIM records)
- [ ] Create transactional email template for "New listing" notification

### AUTHKey setup
- [ ] Reuse existing account (same as onboarding OTP)
- [ ] Register WhatsApp template "New listing notification" with 4 variables
- [ ] Wire `sid` (template ID) into the server notification handler
