# Wish Gift Confirmation — UI Spec (FINAL)

**File:** `wish-gift_payment_confirmation_for_gifter_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/wish/confirmation/{payment_intent_id}`
**Access:** Anyone with the full URL — Stripe's `pi_xxx` (27+ chars) is the unguessable token

---

## 1. Purpose

The receipt page a gifter lands on after successfully paying for a wish. Jobs:
1. Confirm the gift succeeded (❤️ + "Wish granted!")
2. Show transaction details as a receipt / tax record
3. Link to the ambassador's public page where the gifter's name appears on the Wall of Love
4. Offer sharing (WhatsApp / Instagram / generic) to inspire friends

Stripe also sends an automatic payment receipt email to the gifter — the permanent backup.

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| Stripe redirect after successful payment | `return_url` configured in `stripe.confirmPayment()` on the wish checkout page | **Primary path.** Stripe appends `?payment_intent=pi_xxx&payment_intent_client_secret=xxx&redirect_status=succeeded`. Page reads `pi_xxx` and fetches. |
| Bookmark / revisit | Gifter saved the URL | Accessible forever |
| Browser back from ambassador's page | After tapping "See your name on {name}'s page" | Browser restores state — no refetch |

**No authentication.** Same security model as Stripe's hosted receipts — `pi_xxx` is the token.

### 2.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "See your name on {name}'s page →" link | `/{ambassador.slug}` | **Same tab** | Hidden when `is_refunded`. Browser back returns to receipt. |
| WhatsApp share icon | `https://wa.me/?text=...` (pre-filled message) | New tab | "I just gifted {name} a beauty wish ❤️ {url}" |
| Instagram share icon | Copies link to clipboard (Instagram has no direct share URL) | — | Toast confirmation recommended in production |
| Generic share icon | `navigator.share()` if available, else clipboard | — | Web Share API — works on mobile natively |
| "Need help? Contact support" link | `mailto:support@welovedecode.com?subject=Support request — {reference}` | Email client | Always visible. Silent fail on desktop without mail client is acceptable. |

### 2.3 State-dependent display

**Active (default):** ❤️ + "Wish granted!" + "See your name" CTA + share block.

**Refunded** (admin-initiated via Stripe):
- **Red banner at top**: "This payment was refunded on {date}"
- ❤️ emoji **hidden**
- Hero title: "Wish granted!" → **"Refunded"**
- Subtitle: "This payment was refunded on {date}"
- "See your name" CTA **hidden** (gifter's name is gone from Wall of Love)
- **Share block hidden** (nothing to celebrate)
- Receipt gains a **red row** at the bottom: `REFUNDED: {currency} {amount} / {date}`

**Not Found** (invalid `pi_xxx`, network error, or 404 from server):
- All main content hidden
- Simple centered: "Receipt not found" + "Check your email for your payment confirmation." + support link

**No Expired state** — unlike listings, gifts don't expire. They're permanent contributions.

### 2.4 Backend reads (no writes)

This page is **read-only**.

| Action | Endpoint |
|---|---|
| Page load | `GET /api/gifts/by-payment-intent/{pi_xxx}` |

Response shape:
```json
{
  "reference": "W8473921",
  "recipient": {
    "id": "uuid",
    "name": "Sara Johnson",
    "first_name": "Sara",
    "slug": "sarajohnson"
  },
  "gifter": {
    "name": "Ahmed Khalil",
    "instagram": null,
    "anonymous": false
  },
  "service": "Hair",
  "professional": "Salon de Luxe",
  "amount": 300,
  "currency": "AED",
  "presentment_amount": 68,
  "presentment_currency": "USD",
  "paid_at": "2026-04-07T09:41:00Z",
  "status": "active",
  "is_refunded": false,
  "refunded_at": null,
  "refund_amount": null
}
```

Field notes:
- `amount` + `currency` = ambassador's currency (what the wish was priced in)
- `presentment_amount` + `presentment_currency` = what the gifter's card was actually charged. From `paymentIntent.latest_charge.amount` + `presentment_currency`. Null when same as `currency`.
- `gifter` object — for this page, only used if needed for a "gifted by" row. Currently not displayed on this receipt; gifter sees their own gift.
- `status` values: `'active' | 'refunded' | 'pending_payment'`

### 2.5 Loading + pending-webhook retry

Same mechanic as listing confirmation:
- Pink+grey 28px spinner + "Loading your receipt…" during fetch
- If response has `status: 'pending_payment'` → retry every 1s, up to 5 times
- After 5 retries, render optimistically (Stripe's redirect already confirmed payment at its end)

### 2.6 Resolved decisions

| Item | Decision |
|---|---|
| URL format | `/wish/confirmation/{payment_intent_id}` — `pi_xxx` is the token. No HMAC needed. |
| Reference `W8473921` | Shown in receipt body. NEVER in URL. |
| Link navigation | Same tab (industry norm) |
| Currency display when different | Primary: `AED 300`. Subtitle: "Charged as USD 68 on your card" (only if different). Same as listing confirmation. |
| Post-payment gap | Pink spinner + retry logic. 800ms minimum in mockup for testing. |
| Refund display | Red banner + hero changes to "Refunded" + red row in receipt + CTA + share block hidden |
| Support subject line | `Support request — {reference}` (locked) |
| Support link visibility | Always visible, all states |
| Timezone | Browser local (via `new Date()`) |
| Print support | `@media print` CSS — white bg, black text, red preserved for refund info |
| Persistence | Forever |
| Transactions endpoint | Separate from listings. `/api/gifts/by-payment-intent/` only. Visual template shared. |
| Error handling | "Receipt not found" inline state. Conservative — any fetch error resolves to this. |
| Demo mode (mockup only) | `?demo=refunded`, `?demo=presentment`, `?demo=notfound`, `?demo=anonymous`. Remove in production. |
| Refund banner copy | "This **payment** was refunded on {date}" — uses "payment" (not "gift") to match listing confirmation copy and reflect the financial nature of the refund. |
| URL shared by share buttons | **Ambassador's public page** (`https://welovedecode.com/{ambassador.slug}`). Friends land on Sara's page → see her remaining wishes → can gift one. Most useful path. |
| Share button feedback | All clipboard copies show toast "Link copied — paste in Instagram" / "Link copied". Toast is positioned absolutely at bottom of frame, hidden by default, fades in on copy and out after 2.4s. Hidden in print. |
| `pi_xxx` URL validation | Validated against `/^pi_[A-Za-z0-9]{20,40}$/` BEFORE any fetch. Malformed → "Receipt not found" state immediately, no wasted API call. |
| Share buttons — WhatsApp | `https://wa.me/?text=...` with pre-filled message + URL |
| Share buttons — Instagram | Copies URL to clipboard (IG has no deep share URL) |
| Share buttons — Generic | Uses `navigator.share()` Web Share API if available, else clipboard |
| Expired state | **Not applicable.** Gifts don't expire (they're permanent). |
| Referenced recipient data | Gifter sees the ambassador (recipient) name, first_name, slug |

---

## 3. Layout (top to bottom)

1. **Loading state** — pink+grey spinner + "Loading your receipt…" (until fetch completes)
2. **Refund banner** — red, only when `is_refunded`
3. **Hero** — ❤️ + "Wish granted!" + "Your gift is on its way to {first_name}"
4. **Receipt card** (dark grey on black):
   - Gifted to (recipient full name)
   - Service
   - At (professional)
   - Date (long format with time)
   - Reference (W + 7 digits)
   - Amount (+ presentment subtitle when different)
   - **Refund row** (red, only when `is_refunded`): `REFUNDED: AED 300 / 12 April 2026`
5. **Primary action** (hidden when refunded): "See your name on {first_name}'s page →" (pink link, same tab)
6. **Email note** — "We've sent a confirmation to your email" (grey `#888`)
7. **Share block** (hidden when refunded):
   - "Inspire your friends" label
   - WhatsApp / Instagram / Generic-share icons
8. **Support link** — always visible, `mailto:`

---

## 4. Data Handling

### 4.1 URL parsing
- Path: `/wish/confirmation/pi_3QXyz789abc`
- Fallback: `?payment_intent=pi_xxx`

### 4.2 Fetch + retry
```
GET /api/gifts/by-payment-intent/{pi_xxx}
```
On `status === 'pending_payment'` → retry every 1s up to 5 times.
On network error → render "Not Found" state (conservative).

### 4.3 Stripe redirect params
Stripe appends `payment_intent`, `payment_intent_client_secret`, `redirect_status` to return_url. Only `payment_intent` is used.

### 4.4 Currency display
```js
lp_amount = currency + ' ' + amount                    // "AED 300"
if (presentment_currency !== currency) {
  lp_presentment = 'Charged as ' + presentment_currency + ' ' +
                   Number(presentment_amount).toLocaleString() +
                   ' on your card'                     // "Charged as USD 68 on your card"
}
```

### 4.5 Date formatting
- Long format with time for `Date` row: `7 April 2026, 9:41 AM`
- Long format without time for refund date: `12 April 2026`
- Browser local timezone

### 4.6 State resolution priority
1. Refunded (highest)
2. Active (default)

No expired state for gifts.

### 4.7 Share handlers
- **WhatsApp**: opens `https://wa.me/?text={encoded message + URL}` in new tab. Message: `"I just gifted {first_name} a beauty wish ❤️ {url}"`
- **Instagram**: copies `https://welovedecode.com/{slug}` to clipboard + shows toast "Link copied — paste in Instagram"
- **Generic**: calls `navigator.share({ url, text })` if available (native iOS/Android share sheet); falls back to clipboard + toast "Link copied"

**URL shared in all cases:** `https://welovedecode.com/{ambassador.slug}` — the ambassador's public page. Friends who tap the link discover Sara's profile → can browse her remaining wishes/listings.

### 4.8 PI validation regex (locked)

Before any fetch, `pi_xxx` is validated:

```regex
/^pi_[A-Za-z0-9]{20,40}$/
```

- Must start with `pi_`
- Followed by 20–40 alphanumeric characters
- Matches Stripe PaymentIntent ID format (`pi_3QXyz789abc...`)
- Invalid → `showNotFound()` immediately, no fetch attempted

---

## 5. Print support (`@media print`)

- Background → white, text → black
- Borders → light grey `#ccc`
- Spinner / support link / **share block** → hidden
- Links → black, no underline
- **Refund banner + refund row stay red** (critical info)

---

## 6. Security

**Why `pi_xxx` alone is enough:**
27+ characters of base62 = ~161 bits entropy. Matches Stripe's hosted-receipt security.

**What's leaked by URL:** just `pi_xxx`. Receipts are meant to be shareable.

**What's NOT leaked:**
- Gifter's email (on Stripe's auto-receipt, not this page)
- Ambassador's internal user ID (only `slug`)
- `gifter_name_from_stripe` (stored for audit, never shown publicly)
- Card details (tokenized by Stripe)

---

## 7. Persistence model

### 7.1 Denormalized snapshots
On `gifts` row:
- `ambassador_name_snapshot` + `ambassador_slug_snapshot` (for historical display)
- `service_snapshot` + `professional_snapshot` (from wish at gift time)

### 7.2 Refund flow
Admin refunds via Stripe Dashboard:
1. Stripe fires `charge.refunded` webhook
2. Handler: `status='refunded'`, `refunded_at=NOW()`, `refund_amount=X`
3. Gifter's name disappears from Sara's Wall of Love
4. Next visit to this confirmation page shows refund state

No notification to the gifter from the system (Stripe sends its own refund receipt automatically).

---

## 8. Build checklist for Claude Code

### Frontend
- [ ] Parse `pi_xxx` from path, fallback to `?payment_intent=`
- [ ] **Validate `pi_xxx` against `/^pi_[A-Za-z0-9]{20,40}$/`** — invalid → "Receipt not found" without fetching
- [ ] Show pink+grey spinner during fetch
- [ ] Fetch `GET /api/gifts/by-payment-intent/{pi_xxx}`
- [ ] Retry every 1s up to 5× if `status === 'pending_payment'`
- [ ] Render all receipt rows from response
- [ ] Show presentment subtitle only when currencies differ
- [ ] Apply refund state (banner copy: "This **payment** was refunded on {date}", red row, hide CTA/share/emoji, title change)
- [ ] Apply "Receipt not found" state on 404 / network error
- [ ] **Remove mockup's `applyDemoMode()` function** in production
- [ ] Same-tab navigation on "See your name on {name}'s page"
- [ ] `mailto:` subject format: `Support request — {reference}`
- [ ] Wire share buttons:
  - WhatsApp deep link with pre-filled message + URL
  - Instagram → clipboard copy + toast "Link copied — paste in Instagram"
  - Generic → `navigator.share()` with clipboard fallback + toast "Link copied"
  - **All share URLs point to `https://welovedecode.com/{ambassador.slug}`** (Sara's public page, never the wish itself)
- [ ] Toast component: positioned absolutely at bottom of frame, hidden by default, fades in/out, hidden in print
- [ ] `@media print` CSS

### Backend
- [ ] `GET /api/gifts/by-payment-intent/{pi_xxx}` endpoint
- [ ] Include presentment fields from Stripe charge
- [ ] Include `is_refunded`, `refunded_at`, `refund_amount` from refund record
- [ ] Return 404 on unknown `pi_xxx`
- [ ] Snapshot ambassador + service + professional at gift time

### Stripe integration
- [ ] `return_url` in `stripe.confirmPayment()`: `https://welovedecode.com/wish/confirmation/` (Stripe auto-appends `?payment_intent=pi_xxx`)
- [ ] Handle `charge.refunded` webhook → update gift + notify Sara (not gifter)

### Database
Columns on `gifts` covered by `checkout_for_wish-gifter_UI_Spec.md §6.2`.

---

## 9. Related files

| File | Purpose | Status |
|---|---|---|
| `checkout_for_wish-gifter_final.html` | Gifter pays | Final |
| **`wish-gift_payment_confirmation_for_gifter_final.html`** | **Receipt (this file)** | **Final** |

---

## 10. Edge cases

| Case | Behavior |
|---|---|
| Gifter reloads page months later | Still loads. Receipt data unchanged. |
| Ambassador deletes account | Gift uses snapshots. "See your name" link would 404 — acceptable (rare). |
| Gifter screenshots + forwards URL | Recipient can view receipt. OK (receipts are shareable). |
| Invalid `pi_xxx` | "Receipt not found" inline state |
| Stripe webhook delayed >5s | Renders optimistically after retry exhausts |
| Refund after gifter saw receipt | Next visit shows refund state. No notification to gifter. |
| Print receipt | White bg, black text, red preserved for refund info |
| Slow network | Loading spinner stays visible (no timeout) |
| Anonymous gift | Receipt to gifter shows their real name (it's THEIR receipt). Sara's Wall of Love shows "Anonymous". |

---

## 11. Demo modes (mockup only)

Test in browser by adding URL params:

| URL | What you see |
|---|---|
| No params | Active state — all normal |
| `?demo=refunded` | Refund state — red banner, red row, CTA + share hidden |
| `?demo=presentment` | Active state with "Charged as USD 68 on your card" subtitle |
| `?demo=notfound` | "Receipt not found" state |
| `?demo=anonymous` | Anonymous gifter state (for reference) |

Remove `applyDemoMode()` function before shipping to production.
