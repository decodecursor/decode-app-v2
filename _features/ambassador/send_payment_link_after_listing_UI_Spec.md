# Send Payment Link — UI Spec (Final, with Navigation + Triggers)

**File:** `send_payment_link_after_listing.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/listings/{id}/send-link`
**Access:** Authenticated ambassadors only

---

## 1. Purpose

After ambassador adds a paid listing (or wants to send/resend a payment link for an existing listing), this page lets them edit the package prices and send a payment link to the professional via WhatsApp. Three states share the same layout, only the title subline differs.

---

## 2. Entry Points

| State | Source | Trigger |
|---|---|---|
| **S1 — Awaiting payment** | Add Listing (paid path) | After form submit |
| **S2 — Trial** | Listings page | Tap "Send payment link" button on a trial listing card |
| **S3 — Renewal** | Listings page | Tap "Send payment link" button on an active listing card nearing expiry |

---

## 3. Subline per State

The only visual difference between the 3 states is the subline under the title. **No banner, no separate UI element** — just the subline text.

| State | Subline |
|---|---|
| **S1** | "We'll list this professional once they pay" |
| **S2** | "Trial ends on {DD Month YYYY}" — exact date from `listings.trial_ends_at` |
| **S3** | "Listing expires on {DD Month YYYY}" — exact date from `listings.expires_at` |

S2 and S3 dates are **always shown**, not just last 7 days. Format example: "Trial ends on 5 July 2026".

---

## 4. Layout

1. ~~Status bar~~ — **REMOVED**
2. Back arrow (top-left) — returns to **Add Listing** (S1) or **Listings page** (S2/S3)
3. Progress tracker — Listed → Send link → Live
4. Title block — eyebrow + h1 + subline (varies by state — see §3)
5. Package price editor — 3 editable cards (30/60/90 days) with live $X/day math + pink "X% OFF" badges
6. Error message (when validation fails)
7. Payment link row — auto-generated URL + copy icon
8. Send via WhatsApp button
9. Skip for now link

---

## 5. Pricing — Same Validation as Add Listing

| Currency | Minimum |
|---|---|
| USD | 10 |
| EUR | 10 |
| GBP | 10 |
| AED | 50 |
| Other | 10 (fallback) |

Plus ordering: 30 < 60 < 90.

**Lazy validation** on blur/Enter (same UX as Add Listing).

Error message: **"Minimum {symbol}{X}"** or **"60-day price must be higher than 30-day"** etc.

---

## 6. Payment Link

### 6.1 Generation
- **Lazy: generated on this page load** (not at Add Listing time)
- Reason: tokens have an expiry — fresh generation gives full validity window

### 6.2 Storage
Add to existing `listings` table:
```sql
ALTER TABLE listings ADD COLUMN payment_token TEXT;
ALTER TABLE listings ADD COLUMN payment_token_expires_at TIMESTAMP;
```
- No separate table needed
- Token regenerated on each visit to this page (old token invalidated)

### 6.3 URL format
`welovedecode.com/pay/{token}` — public payment page (separate build, not in scope here)

### 6.4 Copy button behavior
- Tap → clipboard write
- URL text replaced with **"Copied!"** in green (`#4ade80`), horizontally centered in row
- Copy icon morphs to green checkmark, also centered next to text
- Reverts to URL + grey icon after 2s

---

## 7. Send via WhatsApp

### 7.1 Mechanism — no phone number stored
- URL: `https://wa.me/?text={url-encoded-message}`
- **No phone number** in the URL — opens WhatsApp's contact picker with message pre-filled
- Ambassador taps the professional from their WhatsApp contacts, then hits Send
- **No professional WhatsApp number stored in our DB** — privacy-friendly, no extra field needed in Add Listing

### 7.2 Mobile vs Desktop
- Mobile: opens WhatsApp app → contact picker → message pre-filled
- Desktop: opens WhatsApp Web → same flow

### 7.3 Message template (fixed across all sends)

```
Hello

I've just added you to my Beauty Squad on WeLoveDecode🌸

Confirm here to activate: {link}
```

URL-encoded when inserted into the wa.me URL.

### 7.4 Button states
| State | Trigger | Background | Label |
|---|---|---|---|
| Disabled | Validation errors | `#1f1f1f` | `#555` |
| Active | Pricing valid | `#e91e8c` | `#fff` |

Tap (active) → opens WhatsApp via `wa.me` URL → routes back to `/listings`

---

## 8. Skip for Now

- Routes back to `/listings`
- Listing stays in `pending_payment` status
- **No automated reminder** — ambassador manually re-sends from the listing card later

---

## 9. Payment Confirmation (after professional pays)

| Step | Trigger |
|---|---|
| 1 | Professional pays via `welovedecode.com/pay/{token}` |
| 2 | **Stripe webhook** fires → backend updates `listings.status = 'active_paid'` |
| 3 | Ambassador notified via **email** (transactional) |
| 4 | Ambassador notified via **WhatsApp** using **AUTHKey** (existing integration) |

Ambassador notification copy and channels are existing system patterns — Claude Code uses standard transactional email + AUTHKey send.

---

## 10. Navigation & Triggers (FULL MAP)

### 10.1 Inbound

| Source | Element | Result |
|---|---|---|
| Add Listing (paid path) | "Create listing" button success | Lands in S1 (Awaiting payment) |
| Listings page | Trial card → "Send payment link" button | Lands in S2 (Trial) |
| Listings page | Active card → "Send payment link" button | Lands in S3 (Renewal) |

### 10.2 Outbound

| Element | Destination | Tab |
|---|---|---|
| Back arrow (S1) | Add Listing page | Same |
| Back arrow (S2/S3) | Listings page | Same |
| Copy icon | Clipboard only | — |
| Send via WhatsApp | `wa.me/?text=...` (WhatsApp app/web) | New (system handler) |
| After WhatsApp send | `/listings` | Same |
| Skip for now | `/listings` | Same |

### 10.3 Backend writes

| Action | Trigger |
|---|---|
| Page load | Generate fresh `payment_token` + expiry, save to `listings` |
| Price input change | Update `listings.price_30/60/90` (debounced or on blur) |
| Send via WhatsApp tap | Mark listing `link_sent_at = NOW()` |
| Stripe webhook (when pro pays) | Set `status = 'active_paid'`, send email + WhatsApp to ambassador |

---

## 11. Build Notes for Claude Code

### 11.1 Schema additions

```sql
ALTER TABLE listings ADD COLUMN payment_token TEXT;
ALTER TABLE listings ADD COLUMN payment_token_expires_at TIMESTAMP;
ALTER TABLE listings ADD COLUMN link_sent_at TIMESTAMP NULL;
```

### 11.2 Token generation
- Random secure token (e.g. `crypto.randomUUID()` or `nanoid(10)`)
- Expiry suggestion: 14 days from generation
- Old tokens for the same listing should be invalidated when a new one is generated

### 11.3 WhatsApp send

```js
const message = `Hello\n\nI've just added you to my Beauty Squad on WeLoveDecode🌸\n\nConfirm here to activate: ${link}`;
const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
window.open(url, '_blank'); // mobile: opens WhatsApp app; desktop: WhatsApp Web
```

### 11.4 Stripe webhook (payment confirmation)
- Endpoint receives Stripe `checkout.session.completed` event
- Look up listing by `payment_token` in metadata
- Update `status = 'active_paid'`, set `expires_at = NOW() + chosen_package_days`
- Trigger email + AUTHKey WhatsApp send to ambassador

---

## 12. Files

- `send_payment_link_after_listing.html` — interactive mockup with all 3 states stacked
- `send_payment_link_after_listing_UI_Spec.md` — this document
