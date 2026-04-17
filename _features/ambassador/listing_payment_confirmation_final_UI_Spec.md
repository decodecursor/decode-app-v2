# Listing Payment Confirmation — UI Spec (FINAL)

**File:** `listing_payment_confirmation_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/listing/confirmation/{payment_intent_id}`
**Access:** Anyone with the full URL — no authentication. Stripe's `pi_xxx` (27+ chars) is the unguessable token.

---

## 1. Purpose

The receipt page a professional lands on after successful payment. Three jobs:
1. Confirm the payment succeeded (🎉 + "You're live!")
2. Show transaction details as a receipt / tax record
3. Link to their now-live listing on Sara's page

Stripe also emails an automatic payment receipt — the permanent backup.

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| Stripe redirect after successful payment | `return_url` configured in `stripe.confirmPayment()` on checkout page | **Primary path.** Stripe appends `?payment_intent=pi_xxx&payment_intent_client_secret=xxx&redirect_status=succeeded`. Page reads `pi_xxx` and fetches. |
| Bookmark / revisit | Professional saved the URL | Receipt is persistent forever |
| Browser back from ambassador's page | After tapping "See your listing" | Browser restores state — no refetch |
| Checkout page auto-redirect | Checkout detects `status='active'` on mount and redirects here | See `checkout_UI_Spec.md §2.4` — prevents re-pay loop |

**No authentication.** The `pi_xxx` is the unguessable token (same security model as Stripe's own hosted receipts).

### 2.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "See your listing on {name}'s page →" link | `/{ambassador.slug}` | **Same tab** | Hidden when `is_expired` or `is_refunded`. |
| "Need help? Contact support" link | `mailto:support@welovedecode.com?subject=Support request — {reference}` | Email client | Always visible. Locked subject format. |

### 2.3 State-dependent display

**Active (default):** CTA visible. Hero "You're live!" + 🎉. Subtitle "Your listing is live on {name}'s page".

**Expired** (`now > active_until`):
- "See your listing" CTA **hidden**
- Soft note: "This listing has expired. Contact {name} if you'd like to list again."
- Subtitle changes: "Your listing expired on {name}'s page"

**Refunded** (admin-initiated via Stripe) — **takes priority over Expired**:
- **Red banner at top**: "This payment was refunded on {date}"
- 🎉 emoji **hidden**
- Hero title: "You're live!" → **"Refunded"**
- Subtitle: "This payment was refunded on {date}"
- "See your listing" CTA **hidden**
- Receipt gains a **red row** at the bottom: `REFUNDED: {currency} {amount} / {date}`

**Not Found** (invalid `pi_xxx`, network error, or 404 from server):
- All main content **hidden**
- Simple centered layout:
  - Title: "Receipt not found" (22px bold)
  - Body: "We couldn't find this receipt.<br>Check your email for your payment confirmation." (12px grey)
  - Support link: "Need help? Contact support" (`mailto:`)
- Conservative default — any fetch error resolves to this state (never break silently)

### 2.4 Backend reads (no writes)

Read-only page.

| Action | Endpoint |
|---|---|
| Page load | `GET /api/listings/by-payment-intent/{pi_xxx}` |

Response shape:
```json
{
  "reference": "L8473921",
  "ambassador": { "id": "uuid", "name": "Sara Johnson", "slug": "sarajohnson" },
  "professional": { "name": "Salon de Luxe" },
  "category": "Hair",
  "duration_days": 90,
  "active_until": "2026-07-06T09:41:00Z",
  "amount": 70,
  "currency": "AED",
  "presentment_amount": 1580,
  "presentment_currency": "INR",
  "paid_at": "2026-04-07T09:41:00Z",
  "status": "active",
  "is_expired": false,
  "is_refunded": false,
  "refunded_at": null,
  "refund_amount": null
}
```

Field notes:
- `amount` + `currency` = ambassador's currency
- `presentment_amount` + `presentment_currency` = what professional's card was charged (from `paymentIntent.latest_charge`). Null when same as listing currency.
- `status` values: `'active' | 'expired' | 'refunded' | 'pending_payment'`
- `is_expired` / `is_refunded` computed server-side

### 2.5 Loading + pending-webhook retry

**Loading spinner:** pink+grey 28px spinner + "Loading your receipt…" subtitle. Shown while fetching. Hidden on success.

**Pending-webhook retry:** Stripe's redirect can arrive before the `payment_intent.succeeded` webhook fires (typical delay <1s, sometimes 1–3s). If endpoint returns `status: 'pending_payment'`:
- Retry every **1 second, up to 5 times** (5s total)
- After 5 retries, render optimistically ("You're live!") — Stripe's redirect confirms payment succeeded at Stripe's end

### 2.6 Resolved decisions

| Item | Decision |
|---|---|
| URL format | `/listing/confirmation/{payment_intent_id}` — uses Stripe's own `pi_xxx` token. No HMAC needed. |
| Reference `L8473921` | Shown INSIDE the receipt body. NEVER in URL. |
| Link navigation | Same tab (industry norm — Stripe, Shopify, Airbnb) |
| Post-payment gap | Pink+grey loading spinner. Retry endpoint every 1s up to 5 times. Plus 800ms minimum loading display in mockup for visibility testing. |
| Refund display | Red banner + hero changes to "Refunded" + red row in receipt + CTA hidden |
| Support subject line | `Support request — {reference}` (locked) |
| Support link visibility | Always visible in active/expired/refunded states. Also shown on "Not Found" state. |
| Support link desktop fallback | Silent fail if no mail client configured (users know how to copy email). |
| Timezone | Browser local (via `new Date()`) |
| Print support | `@media print` CSS — white bg, black text, red preserved for refund info |
| Persistence | Forever. GDPR/tax-record policy to revisit with legal counsel at scale. |
| Transactions endpoint | **Split** from gifts. `/api/listings/by-payment-intent/` only. Template shared. |
| Currency display when different | Primary: "AED 70". Subtitle: "Charged as INR 1,580 on your card" (only if different). |
| Error handling (404, network) | Show "Receipt not found" inline state (not a separate route). Conservative: any fetch failure resolves to this state. |
| Ambassador public page | Already built — professional's "See listing" link lands on the existing `/{slug}` page. |
| Demo mode (mockup only) | URL params `?demo=expired`, `?demo=refunded`, `?demo=presentment`, `?demo=notfound` trigger preview states. Remove in production. |

---

## 3. Layout (top to bottom)

1. **Loading state** — pink+grey spinner + label (until fetch completes)
2. **Refund banner** — red, only when `is_refunded`
3. **Hero** — 🎉 + "You're live!" + subtitle (emoji hidden / title changed if refunded)
4. **Receipt card** — dark grey block:
   - Visible on / Category / Duration / Active until / Amount (+ presentment subtitle) / Date / Reference / Refund row (red, only if refunded)
5. **Primary action** — "See your listing →" (hidden if expired or refunded)
6. **Expired note** — only if expired (not refunded)
7. **Email note** — "We've sent a confirmation to your email" (`#888`)
8. **Support link** — always visible (`#666`, `mailto:`)

---

## 4. Data Handling

### 4.1 URL parsing
- Path: `/listing/confirmation/pi_3QXyz789abc`
- Fallback: `?payment_intent=pi_xxx` (Stripe's appended query param)

### 4.2 Fetch + retry
```
GET /api/listings/by-payment-intent/{pi_xxx}
```
On `status === 'pending_payment'` → retry every 1s up to 5 times.
On network error → render fallback (mockup only; production shows error state).

### 4.3 Stripe params (ignored)
Stripe appends to return_url:
- `payment_intent=pi_xxx` ← **we use this**
- `payment_intent_client_secret=xxx` ← ignored
- `redirect_status=succeeded` ← ignored (trust server state)

### 4.4 Currency display
```js
// Primary
lp_amount = currency + ' ' + amount           // "AED 70"

// Subtitle (only if different)
if (presentment_amount && presentment_currency !== currency) {
  lp_presentment = 'Charged as ' + presentment_currency + ' ' +
                   Number(presentment_amount).toLocaleString() +
                   ' on your card'             // "Charged as INR 1,580 on your card"
}
```

Uses `toLocaleString()` for locale-correct thousands separator.

### 4.5 Date formatting
- Without time: `4 July 2026`
- With time: `7 April 2026, 9:41 AM`
- Browser local timezone. Full English month names.

### 4.6 State resolution priority
1. Refunded (highest)
2. Expired
3. Active (default)

---

## 5. Print support (`@media print`)

Triggered on Ctrl/Cmd+P:
- Background → white, text → black
- Borders → light grey `#ccc`
- Spinner + support link → hidden
- Links → black, no underline
- **Refund banner + refund row stay red** (critical info preserved on paper)

Makes it accounting/expense-report friendly.

---

## 6. Security

**Why `pi_xxx` alone is enough:**
Stripe PaymentIntent IDs are 27+ chars of base62 = ~161 bits of entropy. Effectively unguessable. Matches Stripe's own hosted-receipt security model.

**What's leaked by URL:** only `pi_xxx`. Fine — receipts are shareable.

**What's NOT leaked:** professional's email (on Stripe's auto-receipt, not this page), card details (tokenized by Stripe), internal user IDs, human reference `L8473921` (in body only).

**Endpoint:**
- `GET /api/listings/by-payment-intent/{pi_xxx}`
- Invalid `pi` → 404
- No rate limiting needed (pi is unguessable)

---

## 7. Persistence model

### 7.1 Denormalized snapshots
On `listings` row at payment time:
- `ambassador_name_snapshot VARCHAR(200) NOT NULL`
- `ambassador_slug_snapshot VARCHAR(100) NOT NULL`

So if Sara renames/deletes her account, old receipts still render correctly.

### 7.2 Refund flow
Admin refunds via Stripe Dashboard:
1. Stripe fires `charge.refunded` webhook
2. Handler: `status='refunded'`, `refunded_at=NOW()`, `refund_amount=X`
3. Listing removed from Sara's public page; appears in her "Refunded" dashboard section
4. Next visit to this confirmation page shows refund state

No auto-notification to professional — Sara handles communication manually (platform policy).

---

## 8. Build checklist for Claude Code

### Frontend
- [ ] Parse `pi_xxx` from path, fallback to `?payment_intent=`
- [ ] Show pink spinner until fetch completes (add ~400ms minimum visibility so spinner isn't a flash on fast connections)
- [ ] Fetch `GET /api/listings/by-payment-intent/{pi_xxx}`
- [ ] Retry every 1s up to 5× if `status === 'pending_payment'`
- [ ] Render receipt from response
- [ ] Show presentment subtitle only when currencies differ
- [ ] Apply refund state (banner, red row, hide emoji/CTA, title change)
- [ ] Apply expired state (hide CTA, show note, past-tense subtitle)
- [ ] Apply "Receipt not found" state on 404 or network error
- [ ] **Remove mockup's `applyDemoMode()` function** — it's for design preview only (`?demo=expired` etc.)
- [ ] Same-tab navigation on "See your listing"
- [ ] `mailto:` subject format `Support request — {reference}`
- [ ] `@media print` CSS for ink-friendly printing

### Backend
- [ ] `GET /api/listings/by-payment-intent/{pi_xxx}` endpoint
- [ ] Include presentment fields from Stripe charge
- [ ] Compute `is_expired` at response time
- [ ] Include refund fields (`is_refunded`, `refunded_at`, `refund_amount`)
- [ ] Return 404 on unknown `pi_xxx`
- [ ] Snapshot `ambassador_name` + `ambassador_slug` at payment time
- [ ] Checkout page: on mount, if listing already `active` → redirect here

### Stripe integration
- [ ] `return_url`: `https://welovedecode.com/listing/confirmation/` (Stripe auto-appends `?payment_intent=pi_xxx`)
- [ ] Handle `charge.refunded` webhook → update listing + notify Sara only

### Database
Additional columns on `listings` (beyond `checkout_UI_Spec.md §7`):
- [ ] `ambassador_name_snapshot VARCHAR(200) NOT NULL`
- [ ] `ambassador_slug_snapshot VARCHAR(100) NOT NULL`
- [ ] `presentment_amount DECIMAL(10,2)`
- [ ] `presentment_currency CHAR(3)`
- [ ] `refunded_at TIMESTAMPTZ`
- [ ] `refund_amount DECIMAL(10,2)`

---

## 9. Related files

| File | Purpose | Status |
|---|---|---|
| `add_listing_final.html` | Sara creates listing + sets prices | Final |
| `send_payment_link_after_listing.html` | Sara shares link | Final |
| `checkout_final.html` | Professional pays | Final |
| **`listing_payment_confirmation_final.html`** | **Receipt (this file)** | **Final** |
| `payment_link_no_longer_active_minimal.html` | Expired link page | Final |

---

## 10. Edge cases

| Case | Behavior |
|---|---|
| Professional reloads 100 days later | Still loads. If expired, CTA hidden + soft note shown. |
| Sara deletes her account | Receipt uses snapshots. "See listing" link would 404 if clicked. |
| Professional screenshots + forwards URL | Recipient can view (intentional — receipts are shareable). |
| Invalid `pi_xxx` in URL | 404 (TODO: error-state mockup separately) |
| Stripe webhook delayed >5s | Renders optimistically ("You're live!") after retry exhausts. |
| Refund after professional saw receipt | Next visit shows refund state. No notification. |
| Print | White bg, black text, red preserved for refund info. |
| Slow network | Loading spinner stays visible — no timeout. |
