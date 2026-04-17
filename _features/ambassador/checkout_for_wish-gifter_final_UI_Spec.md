# Wish Gifter Checkout — UI Spec (FINAL)

**File:** `checkout_for_wish-gifter_final.html`
**Companion:** `payment_gift_taken_already_final.html` (race-condition state, see §9)
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** Production URL format TBD in dedicated URL session. Mockup uses `?wish={wish_id}` query param as placeholder.
**Access:** Anyone with the link — no authentication required.

---

## 1. Purpose

The checkout page where a gifter pays for one of an ambassador's beauty wishes. Jobs:
1. Show whose wish is being granted (ambassador + public URL preview)
2. Show wish details (service, professional, amount) — read-only, set by ambassador
3. Collect gifter's name + Instagram OR allow anonymous gifting
4. Process payment via in-page modal (Apple Pay + card — same pattern as Professional Checkout)
5. Redirect to confirmation page on success

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| "Gift it" button on ambassador's public page (`/{slug}`) | Tap a wish item → link to this checkout with `wish_id` | **Primary path.** Public page already built. |
| Shared wish link | Ambassador copies + shares via WhatsApp / Instagram DM / other | URL format TBD — dedicated URL session. Frontend + backend all built. |
| Ambassador opening her own wish link | Same page, no special "owner" view | Sara sees the same checkout gifters see. No block. |
| Direct paste | Anyone with link | No auth gate |

**No authentication.** Public URL.

### 2.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| URL link under ambassador's name | In-page overlay (Instagram-style) | Same | Tap X to dismiss. Production iframe loads `/{slug}`. |
| Overlay X / dismiss | Closes overlay | Same | State preserved |
| Anonymous toggle | Collapses fields + pink border on row | — | No navigation. Pay note changes to "One-time payment · No subscription". |
| Pay button (disabled) | Nothing | — | Must be valid before clickable |
| Pay button (active) | **Last-second server check, then modal** | — | `POST /api/checkout/wish` returns 409 if wish already granted → redirect to `payment_gift_taken_already_final.html`. Otherwise returns `client_secret` → open modal. |
| Modal Apple Pay button | Native Apple Pay sheet (Stripe Express Checkout) | — | |
| Modal Pay by card | Swaps to card form view | — | Same modal stays open |
| Modal Cancel / X / backdrop | Closes modal | — | Input preserved |
| Modal Pay button (card form) | Stripe confirmPayment → "Processing…" state → redirect | Same | Pay button text changes to "Processing…". No invented success UI. |
| Successful payment | `/wish/confirmation/{pi_xxx}` | Same | Stripe `return_url`. See `wish-gift_payment_confirmation_for_gifter_UI_Spec.md`. |
| 409 Conflict on Pay | `payment_gift_taken_already_final.html?slug={ambassador_slug}&first={ambassador_first_name}` | Same | "Someone was faster!" state |

### 2.3 Backend writes

| Action | Trigger | Endpoint | Notes |
|---|---|---|---|
| Page load | Mount | `GET /api/wishes/{wish_id}` | Returns wish + ambassador. Currency from `users.currency`. Returns 410 Gone if wish already granted. |
| URL preview | Tap URL link | Iframe `src=/{slug}` | No separate API call |
| Pay button tap | Click | `POST /api/checkout/wish` | Body: `{ wish_id, anonymous, name, instagram }`. Server re-checks `wish.is_granted` — if true, returns **409 Conflict**. Otherwise creates PaymentIntent with idempotency key, returns `client_secret`. |
| Payment success | Stripe webhook `payment_intent.succeeded` | Server-to-server | **Creates `gifts` row here for the first time.** Sets `wish.is_granted = true` atomically. Triggers notifications to ambassador (Resend + AUTHKey). Stripe sends auto-receipt to gifter. |
| Payment failure | Stripe webhook `payment_intent.payment_failed` | Server-to-server | No gift row created. Wish stays available. No follow-up to gifter. |

### 2.4 Resolved decisions

| Item | Decision |
|---|---|
| Authentication | None — public URL |
| Ambassador opening her own link | Same checkout; no owner view |
| URL format (production) | TBD in dedicated URL session. Mockup uses `?wish={wish_id}` placeholder. |
| Currency displayed | Always ambassador's currency from `users.currency` (set at onboarding). Pulled from server. Mockup placeholder shows "AED 300". |
| Cover image | Pulled from `users.cover_photo_url` (**mandatory at onboarding** — never null in production). Fallback if ever null: grey gradient `#2a2a2a → #1a1a1a` (NOT pink — avoid brand color fallback conflict). |
| Wish editability | Read-only on this page |
| Gifter's Name field | Letters / spaces / hyphens / apostrophes only (Unicode `\p{L}` — supports any language). **Reject emoji, digits, special chars.** Max 70 chars. Auto-capitalize first letter. |
| Gifter's Instagram field | **Use Settings-page sanitizer pattern**: strip `http(s)://`, `www.`, `instagram.com/` prefixes + leading `@`. Keep only `a-zA-Z0-9._`. Max 30 chars. |
| Validation | Pay enabled if: anonymous ON **OR** name has ≥2 characters after trim |
| Anonymous toggle | Pink track + knob on `#e91e8c`. Pink border on row. Fields collapse smoothly. Label changes to "Appear as **Anonymous** on {first_name}'s page". **On toggle ON, name + Instagram fields are cleared** (empty input + empty state). Ensures nothing typed before toggling can leak to the server. |
| "(optional)" label on "Your details" | Kept. The section IS optional in the sense that toggling Anonymous is the opt-out path. |
| WebView banner tap | **Tap copies the current URL to clipboard** + shows toast "Link copied — paste in Safari". Lets the user paste into Safari in one tap. |
| WebView banner demo mode | `?demo=webview` URL param forces the banner to display in any browser for mockup review. Remove in production. |
| Pay note when anonymous | "One-time payment · No subscription" |
| Pay note default | "One-time payment · Your name forever on {first_name}'s page" |
| No other copy changes when anonymous | Tagline, wish card, etc. all unchanged |
| In-app WebView banner | **Enabled.** Subtle grey info banner at top: "For Apple Pay, **open in Safari**". Shown only when `navigator.userAgent` matches Instagram/WhatsApp/Facebook/Line/WeChat. Hidden otherwise. |
| Payment modal | **Same component as Professional Checkout.** Apple Pay + Pay by card. All mechanics identical (idempotency, `beforeunload`, error handling). |
| After successful payment | Pay button shows "Processing…", modal stays visible, Stripe redirects. No invented success UI. |
| After failed payment | Inline error banner in modal. Gifter retries. |
| Apple Pay cancelled | Silent return to modal default |
| Double-tap Pay | Client `_payingActive` flag + server Stripe idempotency key |
| Tab close during active payment | `beforeunload` warning |
| `gifts` row timing | **Created ONLY on Stripe webhook success.** No "pending_payment" state. If payment fails or abandoned, no trace. Simpler schema. Claude Code to confirm during build. |
| Race condition (wish already granted when gifter clicks Pay) | Server returns **409 Conflict** on `POST /api/checkout/wish`. Frontend redirects to `payment_gift_taken_already_final.html?slug={slug}&first={first_name}`. Covers 99.9% of race cases without complex real-time sync. Remaining <0.1%: webhook creates duplicate gift → handled by idempotency on `wish_id`. |
| One wish = one gift | **Locked.** A wish becomes a gift when paid. The wish disappears from Sara's public page the moment `payment_intent.succeeded` webhook fires. No partial/split gifts allowed. |
| Gifter currency different from ambassador | Show both on confirmation page (primary + "Charged as X on your card"). Same pattern as listing confirmation. |
| Automatic follow-up to gifter | **None** beyond Stripe's auto-receipt email. No email/WhatsApp from WeLoveDecode to gifter. |

---

## 3. Layout (top to bottom)

1. **In-app WebView banner** (only when detected): grey strip with "For Apple Pay, open in Safari"
2. **Cover image** (180px) — `users.cover_photo_url`, fallback grey gradient
3. **Ambassador name** (24px bold) + **URL link** (11px underlined, opens overlay) + **tagline** "Make {first_name}'s beauty wish come true"
4. **Divider**
5. **"Beauty wish" card** (read-only):
   - Service
   - At (professional)
   - Amount (in ambassador's currency)
6. **"Your details (optional)" section**:
   - Name input (sanitized, auto-cap, 70 char max)
   - Instagram input (same sanitizer as Settings)
   - **Anonymous toggle** (below fields, pink border when on)
7. **Pay note** (dynamic):
   - Default: "One-time payment · Your name forever on {first_name}'s page"
   - Anonymous: "One-time payment · No subscription"
8. **Pay button** — grey/disabled → pink/active when valid

---

## 4. Data loading

### 4.1 Page mount
```
GET /api/wishes/{wish_id}
```
Response:
```json
{
  "id": "uuid",
  "service": "Hair",
  "professional": "Salon de Luxe",
  "amount": 300,
  "currency": "AED",
  "is_granted": false,
  "ambassador": {
    "id": "uuid",
    "name": "Sara Johnson",
    "first_name": "Sara",
    "slug": "sarajohnson",
    "cover_image_url": "https://..."
  }
}
```

- **If `is_granted === true` at page load**: server should return 410 Gone. Frontend redirects to `payment_gift_taken_already_final.html`.
- **Currency** from `users.currency` — NEVER from the wish row itself (ambassador's currency at the time of fetch).

### 4.2 URL preview (overlay)
Iframe loads `https://welovedecode.com/{slug}`. Public page sends `Content-Security-Policy: frame-ancestors 'self'`.

---

## 5. Payment modal

Same component as `checkout_final.html`. Differences:

| Element | Professional Checkout | Wish Checkout |
|---|---|---|
| Price chips | `One-time` · `No subscription` · `{N} days package` | `One-time` · `No subscription` · `One gift` |
| Amount | Selected package | Ambassador's price for the wish |
| Success redirect | `/listing/confirmation/{pi_xxx}` | `/wish/confirmation/{pi_xxx}` |
| Backend endpoint | `POST /api/stripe/create-payment-intent` | `POST /api/checkout/wish` |
| Metadata on PaymentIntent | `{ listing_id, package_days }` | `{ wish_id, anonymous, name, instagram }` |

All other modal mechanics identical: Stripe Express Checkout + Payment Element, in-page only, card form swap, error handling, `beforeunload` protection, idempotency key, **Pay button shows "Processing…" during final redirect** (no invented UI).

---

## 6. WebView detection

**Detection logic:**
```js
var ua = navigator.userAgent || '';
var isWebView = /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|MicroMessenger/i.test(ua);
```

**Coverage:**
- `Instagram` — Instagram in-app browser
- `FBAN`, `FBAV`, `FB_IAB` — Facebook / Messenger
- `WhatsApp` — WhatsApp
- `Line/` — Line (messaging app popular in Japan/Asia)
- `MicroMessenger` — WeChat

**Behavior:** If detected, show the grey banner at the top. Card form always works as fallback, so WebView users can still pay even without Apple Pay.

---

## 7. Data model

### 7.1 `wishes` table
```sql
CREATE TABLE wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL REFERENCES categories(slug),
  professional VARCHAR(200) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,            -- Snapshotted at creation (= ambassador currency at creation time)
  is_granted BOOLEAN NOT NULL DEFAULT FALSE,
  granted_gift_id UUID,                 -- Backfilled when first gift arrives
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_wishes_granted ON wishes(id) WHERE is_granted = TRUE;
```

### 7.2 `gifts` table
```sql
CREATE TABLE gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(8) UNIQUE NOT NULL,    -- W + 7 digits
  wish_id UUID NOT NULL UNIQUE REFERENCES wishes(id),  -- UNIQUE: one wish = one gift
  ambassador_id UUID NOT NULL REFERENCES users(id),

  -- Gifter details
  gifter_name_public VARCHAR(200),         -- Displayed on Wall of Love (or literally "Anonymous")
  gifter_instagram VARCHAR(30),            -- Only stored if not anonymous
  gifter_name_from_stripe VARCHAR(200),    -- ALWAYS stored — from Apple Pay / card metadata. For refund/audit. Never public.
  gifter_email_from_stripe VARCHAR(255),   -- For Stripe receipt
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,               -- Ambassador's currency (snapshot)
  presentment_amount DECIMAL(10,2),        -- What gifter's card was actually charged
  presentment_currency CHAR(3),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,

  -- Snapshots for historical display integrity
  ambassador_name_snapshot VARCHAR(200) NOT NULL,
  ambassador_slug_snapshot VARCHAR(100) NOT NULL,
  service_snapshot VARCHAR(50) NOT NULL,
  professional_snapshot VARCHAR(200) NOT NULL,

  -- Status (gifts are created only on webhook success, so status starts at 'active')
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'refunded')),
  refunded_at TIMESTAMPTZ,
  refund_amount DECIMAL(10,2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_gifts_ambassador ON gifts(ambassador_id);
CREATE INDEX idx_gifts_stripe_pi ON gifts(stripe_payment_intent_id);
```

**`wish_id` is UNIQUE** — enforces one gift per wish at the database level. If a concurrent webhook tries to create a second gift for the same wish, it fails with a unique-constraint violation. Handles the <0.1% race that the 409-check can't catch.

**Key points:**
- `gifts` row created ONLY on webhook success — no pending state
- `gifter_name_from_stripe` always stored (for refund/audit/disputes). Never shown publicly.
- `gifter_name_public` = real name (if not anonymous) OR literal `"Anonymous"` string
- Snapshots ensure receipts display correctly even if Sara renames/deletes later

---

## 8. Notifications on successful payment

From the `payment_intent.succeeded` webhook handler. Same providers as Professional Checkout (Resend + AUTHKey). Fired in parallel with `gifts` row creation.

### 8.1 Email to ambassador — Resend
Template variables: `{gifter_public_name}` ("Anonymous" OR real name), `{service}`, `{professional}`, `{amount}`, `{currency}`, `{reference}`.

### 8.2 WhatsApp to ambassador — AUTHKey
Body: "💝 New gift! {gifter_public_name} just granted your {service} wish. Ref {reference}. View: welovedecode.com/{slug}"

### 8.3 Gifter — Stripe auto-receipt + our confirmation page
- Stripe auto-receipt email to `gifter_email_from_stripe`
- Our confirmation page `/wish/confirmation/{pi_xxx}`

### 8.4 What is NEVER sent
- No notification to the professional / venue (same policy as listings)
- No follow-up to gifter from WeLoveDecode ever

---

## 9. Race condition — "Someone was faster!" page

**Scenario:** Gifter A and Gifter B both open the wish link at the same time. Gifter A pays first. Gifter B's browser tab is still on the checkout page. Gifter B clicks Pay 10 minutes later.

**Prevention (99.9% of cases):**
`POST /api/checkout/wish` performs a last-second atomic check:
```sql
SELECT is_granted FROM wishes WHERE id = $1 FOR UPDATE;
```
If `is_granted = true`, server returns **409 Conflict** with `{ error: 'wish_already_granted', ambassador: { slug, first_name } }`. Frontend immediately redirects:
```
/wish/already-gifted?slug={slug}&first={first_name}
```

**Final safety net (<0.1% of cases):**
Two webhooks create gifts simultaneously for the same wish. The UNIQUE constraint on `gifts.wish_id` kills the second one with a DB error. The loser's payment is refunded automatically via a Stripe API call from the webhook handler's catch block.

**The "Someone was faster!" page** (`payment_gift_taken_already_final.html`):
- Reads `?slug=` and `?first=` query params
- Renders:
  - "Someone was faster!" (22px bold)
  - "This beauty wish has already been gifted to her by someone else." (13px grey, `<br>` between lines)
  - "Back to {first_name}'s page" pink button → links to `/{slug}`
- No status bar, no "Powered by WeLoveDecode" footer (matches other pages in the flow)

---

## 10. Wish lifecycle (Sara's perspective)

Complete state diagram for a wish row:

```
Sara creates wish
        ↓
  wish row created (is_granted=false)
        ↓
  appears on Sara's public page under "My Beauty Wishlist"
        ↓
       ╔══════════════════╦══════════════════════╗
       ↓                  ↓                      ↓
  Sara deletes wish   Gifter pays        Wish stays visible forever
  before any gift    (webhook success)   (no auto-expiry on wishes)
       ↓                  ↓
  HARD DELETE         wish.is_granted=true
  (row removed)       gifts row inserted
                      wish.granted_gift_id = gift.id
                           ↓
                      Removed from "My Beauty Wishlist" on public page
                      Added to "Wall of Love" on public page
                      (shows gifter name OR "Anonymous")
```

**Deletion policy (pre-gift):** Hard delete. If no gift has been paid, nothing to preserve. Row is removed from DB.

**Deletion after gift exists:** Not allowed. The `gifts` table has FK constraint on `wish_id`. If Sara wants to clean up old wishes from Wall of Love, that's a separate admin action (we won't support it initially).

**"Wall of Love" data source:**
Powered by the `gifts` table filtered by `gifts.ambassador_id = sara.id AND status != 'refunded'`. Displays:
- Gifter name (`gifter_name_public`) — real name OR "Anonymous"
- Service + date
- Amount

---

## 11. Security

| Item | Decision |
|---|---|
| Authentication | None (public page) |
| CSRF | Not applicable (Stripe tokens gate payment) |
| Rate limiting | Applied on `POST /api/checkout/wish` to prevent PaymentIntent spam |
| iframe security | Public page sends `CSP: frame-ancestors 'self'` |
| Gifter PII retention | 7 years (legal/tax requirement). Real name + IG stored. Anonymous gifts: underlying Stripe name stored for refunds, never shown publicly. |
| Apple Pay domain | `welovedecode.com` registered in Stripe Payment Method Domains |

---

## 12. Edge cases

| Case | Behavior |
|---|---|
| Gifter abandons checkout | No DB trace. Wish stays available for others. |
| Payment fails | Inline error in modal. Gifter retries. |
| Sara deletes account after gift paid | Gift row uses snapshots. Wall of Love is gone (public page deleted). |
| Two gifters click Pay within 100ms | First commits (wish goes `is_granted`), second's `POST /api/checkout/wish` returns 409 → redirect to already-gifted page |
| Two gifters both pass the 409 check, both webhooks fire | DB UNIQUE constraint on `wish_id` rejects second. Loser's payment auto-refunded by webhook handler. |
| Gifter in different country | Stripe handles FX. `presentment_amount` stored. Shown on confirmation page. |
| In-app WebView | Banner shown. Card form works as fallback. Apple Pay may not work — banner explains. |
| Browser tab close during payment | `beforeunload` warning. Stripe webhook still fires if processed. |
| Name field paste of "AHMED KHALIL" | Capitalized first letter auto → stays "AHMED KHALIL". Server stores as typed. |
| Name field paste of "ahmed 😊" | Emoji stripped → "Ahmed " → save as "Ahmed". |
| Instagram field paste of "https://instagram.com/@sarah_beauty" | Sanitized to `sarah_beauty`. |
| Gifter types 1-char name "a" | Pay button stays disabled (min 2 chars). |
| Gifter types name then toggles anonymous ON | `wp.nameValue` cleared to empty, input fields cleared. Server never receives the typed name. |
| Gifter taps the WebView banner | URL copied to clipboard via `navigator.clipboard.writeText()`. Toast: "Link copied — paste in Safari". Fallback: legacy `document.execCommand('copy')`. |
| `?demo=webview` URL param (mockup only) | Forces the WebView banner to show in regular browsers for design review. Remove in production. |

---

## 13. Build checklist for Claude Code

### Frontend (this page)
- [ ] Fetch `GET /api/wishes/{wish_id}` — URL format TBD per dedicated session
- [ ] If server returns 410 Gone → redirect to `payment_gift_taken_already_final.html?slug=&first=`
- [ ] Render currency from `users.currency` (via wishes endpoint response)
- [ ] Grey-gradient fallback if `cover_image_url` ever null (shouldn't happen — mandatory at onboarding)
- [ ] URL overlay: replace `.publicPage` placeholder with `<iframe src="https://welovedecode.com/{slug}">`
- [ ] Anonymous toggle: pink border + collapse fields + label change + pay-note change to "One-time payment · No subscription"
- [ ] Name input: Unicode letters only (`\p{L}`), spaces, hyphens, apostrophes. Max 70 chars. Auto-capitalize.
- [ ] Instagram input: use exact sanitizer from Settings (@ + URL prefix strip + allowed chars). Max 30 chars.
- [ ] Validation: Pay enabled if anonymous ON OR name ≥2 chars after trim
- [ ] In-app WebView detection + banner display
- [ ] On Pay click → `POST /api/checkout/wish` with `{ wish_id, anonymous, name, instagram }`
- [ ] If 409 → redirect to `payment_gift_taken_already_final.html`
- [ ] Otherwise → open modal with returned `client_secret`
- [ ] Stripe Express Checkout Element (Apple/Google Pay) + Payment Element (card) combo
- [ ] `return_url = https://welovedecode.com/wish/confirmation/`
- [ ] Pay button shows "Processing…" during Stripe redirect — no invented UI
- [ ] `beforeunload` warning during active payment
- [ ] Client idempotency via `_payingActive` flag

### Backend
- [ ] `GET /api/wishes/{wish_id}` — returns wish + ambassador (currency from `users.currency`). Return 410 Gone if `is_granted === true`.
- [ ] `POST /api/checkout/wish`:
  - Atomic `SELECT FOR UPDATE` on `wishes.is_granted` — if true, return **409 Conflict** with `{ ambassador: { slug, first_name } }`
  - Create Stripe PaymentIntent with idempotency key + metadata
  - Return `client_secret`
- [ ] Webhook `payment_intent.succeeded`:
  - Create `gifts` row (with snapshots + presentment + Stripe name)
  - `UPDATE wishes SET is_granted = true, granted_gift_id = gifts.id`
  - Wrap in transaction — if UNIQUE constraint fails on `gifts.wish_id`, rollback and call Stripe refund on this PaymentIntent (handle <0.1% race loser)
  - Fire Resend email to ambassador
  - Fire AUTHKey WhatsApp to ambassador
- [ ] Sara's public page `/{slug}`:
  - "My Beauty Wishlist" section queries `wishes WHERE ambassador_id = sara.id AND is_granted = false`
  - "Wall of Love" section queries `gifts WHERE ambassador_id = sara.id AND status != 'refunded'`
  - When wish is granted → automatically disappears from Wishlist (filter excludes it) and appears in Wall of Love (gift row now exists)
- [ ] Sara's "Delete wish" action:
  - Only allowed when `is_granted = false`
  - `DELETE FROM wishes WHERE id = $1 AND is_granted = false` (hard delete)
  - Block deletion if `is_granted = true` (FK protected anyway)
- [ ] Webhook `payment_intent.payment_failed` → log only, no DB change
- [ ] Webhook `charge.refunded` → update gift status + notify ambassador only (never gifter)

### Stripe Dashboard
- [ ] Enable Apple Pay + Google Pay
- [ ] Register `welovedecode.com` as Payment Method Domain
- [ ] Host Apple verification file at `/.well-known/apple-developer-merchantid-domain-association`

### Database
- [ ] Create `wishes` table (§7.1)
- [ ] Create `gifts` table (§7.2) — UNIQUE on `wish_id` is critical
- [ ] Seed `categories` if not already done

### Resend / AUTHKey
- [ ] Register "New gift" email template in Resend
- [ ] Register "New gift" WhatsApp template in AUTHKey (get `sid`)

---

## 14. Related files

| File | Purpose | Status |
|---|---|---|
| `add_wish.html` | Sara creates wish | External / TBD |
| Public ambassador page `/{slug}` | Shows wishes with "Gift it" buttons | Already built |
| **`checkout_for_wish-gifter_final.html`** | **Gifter pays (this file)** | **Final** |
| `payment_gift_taken_already_final.html` | Race-condition "Someone was faster!" state | Final |
| `wish-gift_payment_confirmation_for_gifter_final.html` | Post-payment receipt | Final |

---

## 15. Outstanding items for separate sessions

- [ ] Final URL format for the checkout page (dedicated URL session)
- [ ] Final URL format for shared wish links (dedicated URL session)
- [ ] `add_wish` page design if not already built
- [ ] Dashboard design for Sara's "Gifts received" section
