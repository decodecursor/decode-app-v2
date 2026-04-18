# DECODE — Ambassador Feature Project State

**Last updated:** 2026-04-15 (after all 21 page audits complete)
**Project:** DECODE (welovedecode.com) — Ambassador feature
**Current subdomain:** `app.welovedecode.com` (apex still on Carrd, migration later)
**Status:** ✅ Phase B COMPLETE — all 21 pages audited, schema finalized, ready for Claude Code handoff (Phase C)

---

## How to use this document

If a new chat (or Claude Code) needs to pick up:
1. Paste this entire document into the new chat
2. Tell Claude: "Use DECODE_PROJECT_STATE.md as the authoritative source for the DECODE ambassador feature"
3. All decisions, schema, and design specs are locked here

---

## Brand & terminology

- **Brand name:** DECODE (NEVER use "WLD" — that was chat-only shorthand)
- **Feature name:** Ambassador feature (or "model" feature internally — matches existing user role)
- **User role:** `Model` (Title Case, already exists in `users.role`)
- **URL prefix:** `/model/*` for ambassador routes
- **Public URL pattern:** `welovedecode.com/{slug}` (e.g. `welovedecode.com/sarajohnson`)
- **Table prefix:** `model_*` (drop = feature gone)

---

# PHASE 1 — ARCHITECTURAL DECISIONS (LOCKED)

| # | Decision | Locked Value |
|---|---|---|
| 1 | Platform commission | **20% deducted from ambassador's earnings** |
| 2 | Stripe Connect | **No Connect** — DECODE platform Stripe + manual payouts |
| 3 | Payouts | **Manual** — admin clicks "Pay" on Wednesdays |
| 4 | Crossmint (crypto) | **Not included** — Stripe-only |
| 5 | Realtime | **Off** — page loads + user actions only |
| 6 | PayPal payouts | **Bank only V1**, PayPal V2 |
| 7 | Domain | `app.welovedecode.com` for now; relative paths in code so apex migration is trivial later |
| 8 | URL prefix | `/model/` (matches existing `Model` role) |
| 9 | Table prefix | `model_` |
| 10 | Auth | Reuse existing Supabase auth + AUTHKey patterns. Don't rebuild. |
| 11 | Email | Allow `users.email = NULL` for new ambassador auth flow (no fake @whatsapp.decode.local emails) |
| 12 | Stripe integration | Stripe Payment Intents + Stripe Elements (custom modal, NOT hosted Checkout) |
| 13 | Video storage | **Supabase Storage only** (bucket `model-media`). NO transcoding service for V1. Accept that iPhone HEVC videos may not play on Firefox / older Android (95%+ of beauty industry users on iPhone Safari + Chrome where HEVC plays fine). Revisit if visitor complaints arise — can add Cloudflare Stream later. |
| 14 | Image processing | **2-stage compression:** (1) Client-side resize via `<canvas>` BEFORE upload using `browser-image-compression` library — max 1500x750 (cover), 1080x1080 (listing photos), 400x400 (professional avatar). (2) Server-side delivery via Next.js `<Image>` — Vercel automatically serves WebP/AVIF based on visitor's browser. Net result: phone 5MB photo → ~300KB stored → ~150KB delivered. |
| 15 | Video processing | **NO compression / NO transcoding.** Stored as-is on Supabase Storage. Strict limits enforced client-side BEFORE upload: **max 15 seconds duration, max 15MB file size**. Matches TikTok/Reels standard. Files larger or longer rejected with friendly error. Allowed formats: MP4, MOV, WebM (HEVC accepted but flagged as "may not play on Firefox"). |
| 16 | Storage bucket security | Bucket `model-media` RLS policies: **SELECT** = public (anyone can view). **INSERT** = authenticated users only, path must contain `auth.uid()` (e.g. `{uid}/cover.jpg`). **UPDATE** = owner only (path contains `auth.uid()`). **DELETE** = owner only. Prevents public upload of arbitrary files. |
| 17 | Bot protection | **Cloudflare Turnstile** (free invisible CAPTCHA) on (1) both checkout pages (`/{slug}/listing/{token}` and `/{slug}/wish/{token}`) and (2) auth pages that trigger sending costs — WhatsApp OTP (`/model/auth`) and email magic link (`/model/auth`). Verifies visitor is human BEFORE sensitive actions. Prevents wish-locking griefing AND prevents OTP spam that would drain AUTHKey credits. Combined with rate limiting: max 3 lock attempts per IP per 10 min on checkout; max 3 OTP per phone per hour + 10 per IP per hour on auth. |
| 18 | Notifications architecture | **Email via Resend + WhatsApp via AUTHKey.** Stripe Dashboard admin emails for payment/refund alerts (to admin only — no code). 3 custom Resend emails: (1) professional payment receipt, (2) gifter wish receipt, (3) professional listing-expiring-7-days reminder. 4 WhatsApp UTILITY templates (configured in AUTHKey dashboard, category=UTILITY not AUTHENTICATION): listing paid (to ambassador), wish gifted (to ambassador), listing expiring (to ambassador + to professional). All templates submitted for Meta pre-approval via AUTHKey. Code calls AUTHKey API with template ID (`wid`) + variables — same pattern as existing OTP flow. |

---

# PHASE 2 — FEE DISPLAY STRATEGY (LOCKED)

The 20% platform fee is displayed selectively across DECODE pages:

| Page | Shows | Reason |
|---|---|---|
| `/model` Dashboard | **Gross (100%)** | "What I made happen" — vibe / motivation |
| `/model/analytics` | **Gross (100%)** | Performance view |
| `/model/listings` | **Gross (100%)** | What was paid by professionals |
| `/model/wishlist` | **Gross (100%)** | What was paid by gifters |
| `/model/payouts` (list) | **Net (80%)** | What hits the bank |
| `/model/payouts/[id]` (statement) | **Net (80%) + Gross (100%)** | Audit/reconciliation — only place both appear |
| `/wish/confirmation/{pi_xxx}` receipt | Gross (100%) | What gifter paid |
| `/listing/confirmation/{pi_xxx}` receipt | Gross (100%) | What professional paid |
| `/model/settings` | Nothing about fees | Clean UI |
| Terms of Service | Disclosure (legal text only) | Legal compliance |

**CRITICAL RULES for Claude Code:**
- Platform fee is **never explicitly displayed as "20%"** anywhere except in Terms
- The word "fee" is **never shown to ambassadors** in the UI
- Server stores `gross_amount` (100%), `platform_fee` (20%), `net_amount` (80%) per transaction — calculated ONCE at payment, never recalculated
- **Never derive net from a "current fee %" at display time** — historical transactions must always show the fee that applied AT THE TIME of the transaction

---

# PHASE 3 — RACE CONDITION HANDLING (LOCKED)

Wishes are one-time purchases (only one gifter wins). Race protection:

```
1. Gifter taps "Pay $75" (FIRST pay button on checkout page)
2. Server: atomic UPDATE model_wishes SET status='taken' WHERE id=X AND status='available'
3. Success (1 row updated) → create Stripe PaymentIntent + open modal (10-min timer starts)
   Failure (0 rows updated) → redirect to "/wish/taken" page

4. Gifter enters card in modal → taps inner Pay → stripe.confirmPayment()
5a. Payment success → status STAYS 'taken' forever ✓
5b. Payment fail / cancel / abandon / 10-min timer expires → status reverts to 'available'
```

Industry standard pattern (Eventbrite, StubHub, Shopify limited drops, Airbnb).
No reservations needed. **No refunds for race conditions.**

`model_wishes.payment_attempt_expires_at` (timestamptz nullable) tracks the 10-min lock timer.

**Stripe integration:** custom modal + Stripe Payment Intents (NOT Stripe-hosted Checkout). Full timing control owned by DECODE.

---

# PHASE 4 — TRIAL / PAYMENT EXTENSION RULES (LOCKED)

**Universal rule:** New paid period ALWAYS starts at `MAX(now(), MAX(paid_until, free_trial_ends_at))`. Never overlaps. Never overwrites unused time.

**Trial → Paid (early upgrade — trial STACKED, not absorbed):**
```
Day 1:  Trial starts → free_trial_ends_at = Day 31
Day 11: Salon pays $50 for 60 days
        → period_start = Day 31 (after trial ends)
        → period_end = Day 91
        → status = 'active', is_free_trial = false
        → Trial days 11-31 remain valid (free)
```

**Active → Renewal (paid before expiry):**
```
Day 1:   Salon paid for 60 days → paid_until = Day 60
Day 40:  Salon renews early, pays $50 for 60 more days
         → period_start = Day 60 (extends from previous end)
         → period_end = Day 120
         → No double-charging, no overlap, no lost time
```

**Why STACKED not absorbed:** users hate losing trial days. Free trial = free trial. Customers paying early should be rewarded, not punished.

---

# PHASE 5 — DATABASE SCHEMA (FINAL)

## Tables overview

| # | Table | Columns | Purpose |
|---|---|---|---|
| 1 | model_profiles | 14 | Ambassador setup data (one per user) |
| 2 | model_professionals | 9 | Deduped salons/clinics (shared across ambassadors) |
| 3 | model_listings | 21 | Paid listing slots |
| 4 | model_wishes | 16 | Gift wish slots (incl. professional location) |
| 5 | model_listing_payments | 21 | Listing transactions (incl. refunds + presentment) |
| 6 | model_wish_payments | 18 | Wish gift transactions (incl. refunds + presentment) |
| 7 | model_payouts | 17 | Wednesday payout records |
| 8 | model_analytics_events | 11 | Public page events (immutable) |
| 9 | model_categories | 7 | Predefined category dropdown options |

**Total: 9 tables, 134 columns.**

**Reused existing tables:** `users`, `user_bank_accounts` (PLURAL — 18 cols, NOT singular), `webhook_events`
**NOT reused:** `payouts`, `transactions`, `payment_links`, `user_paypal_account`

---

## Table 1 — `model_profiles` (14 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | |
| 2 | user_id | uuid FK UNIQUE NOT NULL | — | → users.id ON DELETE CASCADE |
| 3 | slug | text UNIQUE NOT NULL | — | URL: /sarajohnson; lowercase regex `^[a-z0-9_]{3,30}$` |
| 4 | first_name | text NOT NULL | — | from onboarding |
| 5 | last_name | text NOT NULL | — | from onboarding |
| 6 | cover_photo_url | text nullable | — | Supabase Storage URL (optional at signup) |
| 7 | cover_photo_position_y | int | 50 | drag offset 0–100 |
| 8 | currency | text NOT NULL | 'usd' | ISO 4217 lowercase (display uppercase via `.toUpperCase()`), **LOCKED at signup, no change in Settings** |
| 9 | tagline | text nullable | — | set in Settings |
| 10 | gifts_enabled | bool NOT NULL | false | toggle in Settings |
| 11 | is_published | bool NOT NULL | true | controls public page visibility (toggle in Settings; false → /{slug} returns 404) |
| 12 | dashboard_first_seen_at | timestamptz nullable | — | NULL = first visit (show celebration greeting "Sara, you're live! 🎉") |
| 13 | created_at | timestamptz NOT NULL | now() | |
| 14 | updated_at | timestamptz NOT NULL | now() | auto-trigger via `set_updated_at()` |

**Reused from `users` table:** email, instagram_handle (mandatory), phone_number, role
**Indexes:** unique on slug, on user_id, partial on gifts_enabled=true
**RLS:** public read (only when is_published=true), owner+Model insert/update/**delete**, admin all
**Self-delete:** Ambassador CAN self-delete profile (3-step modal). Hard delete cascades.

---

## Table 2 — `model_professionals` (9 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | |
| 2 | instagram_handle | text UNIQUE NOT NULL | — | dedup key, lowercase |
| 3 | name | text NOT NULL | — | "Salon de Luxe" |
| 4 | city | text NOT NULL | — | |
| 5 | country | text NOT NULL | — | full name (e.g. "United Arab Emirates") |
| 6 | avatar_photo_url | text NOT NULL | — | round 200px photo (mandatory per Add Listing form) |
| 7 | created_by | uuid FK NOT NULL | — | → users.id (first ambassador to add them) |
| 8 | created_at | timestamptz NOT NULL | now() | |
| 9 | updated_at | timestamptz NOT NULL | now() | auto-trigger |

**Indexes:** unique on instagram_handle, on city
**RLS:** public read, Model can INSERT (when adding listing), Model UPDATE only own (created_by), Admin all
**Smart-match flow:** NOT a separate UX overlay. Server checks Instagram uniqueness on Create Listing submit. If duplicate → error: "This Instagram is already linked to {existing.name}. Use that one instead."

---

## Table 3 — `model_listings` (21 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | |
| 2 | model_id | uuid FK NOT NULL | — | → model_profiles.id ON DELETE CASCADE |
| 3 | professional_id | uuid FK NOT NULL | — | → model_professionals.id |
| 4 | category_id | uuid FK nullable | — | → model_categories.id (XOR with category_custom) |
| 5 | category_custom | text nullable | — | XOR with category_id via CHECK constraint |
| 6 | media_type | text nullable | — | 'video' / 'photos' / NULL |
| 7 | video_url | text nullable | — | when media_type='video' |
| 8 | photo_url_1 | text nullable | — | 1st photo |
| 9 | photo_url_2 | text nullable | — | 2nd photo |
| 10 | photo_url_3 | text nullable | — | 3rd photo |
| 11 | price_30 | decimal(10,2) nullable | — | NULL if free trial |
| 12 | price_60 | decimal(10,2) nullable | — | |
| 13 | price_90 | decimal(10,2) nullable | — | |
| 14 | currency | text NOT NULL | — | snapshot from model_profiles |
| 15 | payment_link_token | text UNIQUE NOT NULL | — | 8-char public code (e.g. `a8Kx3mP2`) — increased from 5 per security review |
| 16 | status | text NOT NULL | 'pending_payment' | free_trial / pending_payment / active / expired |
| 17 | is_free_trial | bool NOT NULL | false | |
| 18 | free_trial_ends_at | timestamptz nullable | — | 30 days from creation if trial; KEEP set even after trial→paid conversion (audit trail) |
| 19 | paid_until | timestamptz nullable | — | latest period_end (updates on each renewal) |
| 20 | created_at | timestamptz NOT NULL | now() | |
| 21 | updated_at | timestamptz NOT NULL | now() | auto-trigger via `set_updated_at()` |

**Removals:** Hard DELETE for manual removals (no `removed` status). Active listings = blocked modal "Cannot delete until expires".
**Stacking:** Each renewal = NEW row in `model_listing_payments`, this table just updates `paid_until` to latest `period_end`.
**Category:** Either `category_id` (FK) OR `category_custom` (text) — never both
**Prices on this table are MUTABLE** (ambassador edits anytime on Send Payment Link page). Payment row snapshots are immutable.

---

## Table 4 — `model_wishes` (17 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | |
| 2 | model_id | uuid FK NOT NULL | — | → model_profiles.id ON DELETE CASCADE |
| 3 | service_name | text NOT NULL | — | from dropdown or custom input (text only, no FK) |
| 4 | professional_name | text nullable | — | free text (no FK to model_professionals) |
| 5 | professional_city | text nullable | — | from Add Wish form |
| 6 | professional_country | text nullable | — | from Add Wish form (full name) |
| 7 | price | decimal(10,2) NOT NULL | — | gross (what gifter pays) |
| 8 | currency | text NOT NULL | — | snapshot from model_profiles |
| 9 | status | text NOT NULL | 'available' | available / taken |
| 10 | taken_at | timestamptz nullable | — | when gifted |
| 11 | payment_attempt_expires_at | timestamptz nullable | — | NOW+10min when locked; NULL after success or revert |
| 12 | gifter_name | text nullable | — | from checkout form |
| 13 | gifter_instagram | text nullable | — | from checkout form |
| 14 | gifter_is_anonymous | bool NOT NULL | false | gifter chose to hide |
| 15 | payment_link_token | text UNIQUE NOT NULL | — | 8-char public code (e.g. `a8Kx3mP2`) — used in `/{slug}/wish/{token}` URL. Prevents enumeration. |
| 16 | created_at | timestamptz NOT NULL | now() | |
| 17 | updated_at | timestamptz NOT NULL | now() | auto-trigger |

**Deletion rule:** Available wishes = hard DELETE OK. Taken wishes = cannot delete.
**No `gifter_email`** — that lives only on `model_wish_payments` (single source of truth)
**Wishes are casual** — no FK to `model_categories` or `model_professionals` (snapshots only)

---

## Table 5 — `model_listing_payments` (21 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | internal |
| 2 | payment_reference | text UNIQUE NOT NULL | — | `L` + 7 digits (display only) |
| 3 | listing_id | uuid FK NOT NULL | — | → model_listings.id |
| 4 | model_id | uuid FK NOT NULL | — | → model_profiles.id |
| 5 | gross_amount | decimal(10,2) NOT NULL | — | 100% (what professional paid) |
| 6 | platform_fee | decimal(10,2) NOT NULL | — | 20% (DECODE's cut) |
| 7 | net_amount | decimal(10,2) NOT NULL | — | 80% (ambassador's share) |
| 8 | currency | text NOT NULL | — | snapshot, lowercase ISO 4217 (display uppercase) |
| 9 | package_days | int NOT NULL | — | 30 / 60 / 90 |
| 10 | period_start | timestamptz NOT NULL | — | when paid period begins |
| 11 | period_end | timestamptz NOT NULL | — | when it expires |
| 12 | payer_email | text nullable | — | from Stripe Payment Intent's receipt_email or charge.billing_details.email |
| 13 | stripe_payment_intent_id | text UNIQUE nullable | — | pi_xxx (Payment Intents flow, NOT Checkout Sessions) |
| 14 | status | text NOT NULL | 'pending' | pending / completed / failed / refunded / partial_refund |
| 15 | payout_id | uuid FK nullable | — | → model_payouts.id (NULL until paid out) |
| 16 | refunded_at | timestamptz nullable | — | when refund happened |
| 17 | refund_amount | decimal(10,2) nullable | — | partial or full refund |
| 18 | presentment_amount | decimal(10,2) nullable | — | what professional's card was charged |
| 19 | presentment_currency | text nullable | — | their card's currency, lowercase ISO 4217 |
| 20 | created_at | timestamptz NOT NULL | now() | |
| 21 | updated_at | timestamptz NOT NULL | now() | auto-trigger |

**Receipt URL:** `/listing/confirmation/{stripe_payment_intent_id}` (uses pi_xxx, not L8758745)
**No snapshot columns** — receipt always reads live data; if Sara deletes account, receipt 404s (acceptable)
**Rows are IMMUTABLE** (except status flips and refund fields)
**No `stripe_session_id`** — we use Stripe Payment Intents (custom modal), NOT Stripe Checkout Sessions

---

## Table 6 — `model_wish_payments` (18 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | internal |
| 2 | payment_reference | text UNIQUE NOT NULL | — | `W` + 7 digits (display only) |
| 3 | wish_id | uuid FK NOT NULL | — | → model_wishes.id |
| 4 | model_id | uuid FK NOT NULL | — | → model_profiles.id |
| 5 | gross_amount | decimal(10,2) NOT NULL | — | 100% |
| 6 | platform_fee | decimal(10,2) NOT NULL | — | 20% |
| 7 | net_amount | decimal(10,2) NOT NULL | — | 80% |
| 8 | currency | text NOT NULL | — | snapshot, lowercase ISO 4217 |
| 9 | gifter_email | text nullable | — | from Stripe Payment Intent's receipt_email |
| 10 | stripe_payment_intent_id | text UNIQUE nullable | — | pi_xxx (Payment Intents flow, NOT Checkout Sessions) |
| 11 | status | text NOT NULL | 'pending' | pending / completed / failed / refunded / partial_refund |
| 12 | payout_id | uuid FK nullable | — | → model_payouts.id |
| 13 | refunded_at | timestamptz nullable | — | |
| 14 | refund_amount | decimal(10,2) nullable | — | |
| 15 | presentment_amount | decimal(10,2) nullable | — | |
| 16 | presentment_currency | text nullable | — | lowercase ISO 4217 |
| 17 | created_at | timestamptz NOT NULL | now() | |
| 18 | updated_at | timestamptz NOT NULL | now() | auto-trigger |

**Receipt URL:** `/wish/confirmation/{stripe_payment_intent_id}`
**Differences from listing payments:** No package_days/period (one-time gift), no payer_email (uses gifter_email)
**No `stripe_session_id`** — we use Stripe Payment Intents (custom modal), NOT Stripe Checkout Sessions

---

## Table 7 — `model_payouts` (17 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | internal |
| 2 | payout_reference | text UNIQUE NOT NULL | — | `P` + 7 digits (display only) |
| 3 | model_id | uuid FK NOT NULL | — | → model_profiles.id |
| 4 | gross_total | decimal(10,2) NOT NULL | — | sum of gross in batch |
| 5 | platform_fee_total | decimal(10,2) NOT NULL | — | sum of fees |
| 6 | net_total | decimal(10,2) NOT NULL | — | what hits the bank |
| 7 | currency | text NOT NULL | — | ambassador's currency |
| 8 | listings_count | int NOT NULL | 0 | listing payments in batch |
| 9 | wishes_count | int NOT NULL | 0 | wish payments in batch |
| 10 | bank_name | text NOT NULL | — | snapshot from user_bank_accounts at payout time |
| 11 | bank_last4 | text NOT NULL | — | snapshot IBAN last 4 |
| 12 | bank_account_id | uuid FK nullable | — | → user_bank_accounts.id |
| 13 | status | text NOT NULL | 'pending' | pending / processing / paid / failed |
| 14 | paid_at | timestamptz nullable | — | when admin clicked "Pay" |
| 15 | admin_notes | text nullable | — | optional |
| 16 | created_at | timestamptz NOT NULL | now() | |
| 17 | updated_at | timestamptz NOT NULL | now() | auto-trigger |

**No period_start/period_end** — admin batches all unpaid payments (where `payout_id IS NULL`) every Wednesday
**Bank snapshot:** `bank_name` + `bank_last4` saved at payout time (survives if bank account deleted)
**Linked payments via:** `model_listing_payments.payout_id` + `model_wish_payments.payout_id`

---

## Table 8 — `model_analytics_events` (11 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | |
| 2 | model_id | uuid FK NOT NULL | — | → model_profiles.id ON DELETE CASCADE |
| 3 | event_type | text NOT NULL | — | 7 types (see below) |
| 4 | target_id | uuid nullable | — | listing/wish/payment ID (see mapping) |
| 5 | ip_hash | text nullable | — | dedup (privacy-safe SHA256) |
| 6 | user_agent | text nullable | — | full UA string |
| 7 | device_type | text nullable | — | mobile / tablet / desktop |
| 8 | referrer | text nullable | — | source URL |
| 9 | country | text nullable | — | from IP |
| 10 | utm_params | jsonb nullable | — | {source, campaign, medium} |
| 11 | created_at | timestamptz NOT NULL | now() | immutable (no updated_at) |

### Event types (7) and target_id mapping

| Event type | Triggered when | target_id |
|---|---|---|
| public_page_view | Visitor opens `/{slug}` | NULL |
| listing_instagram_click | Tapped IG link on listing card (image OR text — same event) | model_listings.id |
| listing_media_click | Tapped video/photo on listing card | model_listings.id |
| wish_giftit_click | Tapped "Gift it" on a wish | model_wishes.id |
| wish_instagram_click | Tapped IG link on a wish (professional) | model_wishes.id |
| public_page_share_click | Tapped share button | NULL |
| wall_of_love_instagram_click | Tapped a gifter's IG on Wall of Love | model_wish_payments.id |

---

## Table 9 — `model_categories` (7 columns)

| # | Column | Type | Default | Notes |
|---|---|---|---|---|
| 1 | id | uuid PK | gen_random_uuid() | |
| 2 | label | text UNIQUE NOT NULL | — | "Hair", "Botox", etc. |
| 3 | slug | text UNIQUE NOT NULL | — | "hair", "botox" (for API/URL) |
| 4 | display_order | int NOT NULL | 0 | (UI sorts ABC anyway) |
| 5 | is_active | bool NOT NULL | true | admin can deactivate |
| 6 | created_at | timestamptz NOT NULL | now() | |
| 7 | updated_at | timestamptz NOT NULL | now() | auto-trigger |

### Seed data — 26 categories (ABC sorted)

```
1. Body contouring
2. Botox
3. Brows
4. Chemical peel
5. Cool sculpting
6. Fillers
7. Hair
8. Hair extensions
9. Hair removal
10. Henna
11. HydraFacial
12. IV therapy
13. Laser
14. Lashes
15. Lip blush
16. Makeup
17. Massage
18. Microblading
19. Microneedling
20. Nails
21. PRP
22. Skin Booster
23. Teeth whitening
24. Threads
25. Veneers
26. Waxing
```

**UI sorts ABC.** Custom entries land in `model_listings.category_custom` — admin promotes popular customs to formal categories monthly.

---

# PHASE 6 — URL ARCHITECTURE (LOCKED)

## Final URL list (28 routes)

### Public (11)
- `/{slug}` — Public ambassador page
- (lightbox is overlay on `/{slug}`)
- `/{slug}/wish/{token}` — Wish gift checkout (8-char token)
- `/{slug}/listing/{token}` — Listing checkout (8-char token)
- `/wish/confirmation/{pi_xxx}` — Gift receipt (Stripe pi_xxx)
- `/listing/confirmation/{pi_xxx}` — Listing receipt (Stripe pi_xxx)
- `/wish/taken` — Edge case: wish already gifted
- `/listing/paid` — Edge case: listing already paid
- `/expired` — Generic expired/invalid link page
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy

### Ambassador (10, login required)
- `/model` — Dashboard
- `/model/listings` — Listings page
- `/model/listings/new` — Add listing form
- `/model/listings/[id]/send-link` — Share payment link
- `/model/wishlist` — Wishlist page
- `/model/wishlist/new` — Add wish form
- `/model/analytics` — Analytics
- `/model/payouts` — Payouts list
- `/model/payouts/[id]` — Payout statement
- `/model/settings` — Settings

### Auth (6)
- `/model/auth` — Main auth page
- `/model/auth/verify` — WhatsApp OTP verify
- `/model/auth/sent` — Magic link email sent
- `/model/auth/email-changed` — Email change confirmation
- `/model/auth/email-error` — Email error page
- `/model/setup` — Onboarding

### Catch-all (1)
- 404 page

### URL conventions
- Collections plural, single items singular (`/listings`, `/wish/`)
- `/new` for create pages
- 8-char tokens for branded checkouts (`payment_link_token`)
- References shown in receipts: `L8758745` (listings), `W8473921` (wishes), `P8473921` (payouts) — INSIDE receipt body, NEVER in URLs
- Receipt URLs use Stripe `pi_xxx`

---

# PHASE 7 — DESIGN TOKENS (LOCKED)

| Token | Value |
|---|---|
| Page bg (outer) | `#111` |
| Frame bg | `#000` |
| Frame border | `2px solid #1a1a1a` |
| Card bg | `#1c1c1c` |
| Row hover | `#262626` (LIGHTER than card — surfaces the row) |
| Pink accent (CTA) | `#e91e8c` |
| Green (status/success) | `#34d399` (or `#4ade80` for toast) |
| Body text | `#ccc` / `#fff` |
| Secondary | `#888` / `#777` / `#666` |
| Title | 22px / weight 700 |
| Body | 13px / line-height 1.65 |
| Micro text | 9–11px |
| Frame width | 375px (will use `max-width: 500px` + centered for iPad/desktop) |

**CSS strategy:** inline `<style>` per page, no global CSS to inherit baggage from old app.
**Route groups:** `app/(ambassador)/` for new feature, `app/(legacy)/` for old code.

---

# PHASE 8 — WORKFLOW (LOCKED)

```
1. Chat (Claude here): build/edit HTML mockup + UI spec
2. Save HTML + spec to /design/source-html/ and /design/ui-specs/ in repo
3. Hand to Claude Code: "Implement this page using design/X.html. Wire to API Y."
4. Claude Code does ONLY integration (API wiring, DB, deployment)
5. Visual changes go BACK to chat → never to Claude Code
```

---

# PHASE 9 — PAGE-BY-PAGE AUDIT (✅ ALL 21 DONE)

## Page 1 — Public ambassador page (`/{slug}`)
**File:** `public_page_final.html`

- Section titles ("My Beauty Squad", "My Beauty Wishlist", "My Wall of Love") = hardcoded in app
- Tagline shown on public page below display name
- Anonymous gifter → display "Anonymous", hide Instagram link
- Wall of Love → all completed gifts, newest first, no limit

## Page 2 — Public Media Lightbox (overlay)
**File:** `public_media_lightbox_final.html`
**Status:** No gaps.

## Page 3 — Listing Checkout (`/{slug}/listing/{token}`)
**File:** `checkout_for_listing-professional_final.html`

- Tap profile URL → opens Sara's actual public page in overlay (not customized preview)
- "Followers/Listings/Gifts" stats removed from design
- **No presentment subtitle on checkout** — shown only on receipt (industry standard)

## Page 4 — Wish Gift Checkout (`/{slug}/wish/{token}`)
**File:** `checkout_for_wish-gifter_final.html`

- Gifter data saved AFTER Stripe payment confirms (via webhook)
- Server-side guard checks wish status before creating Stripe session (race condition prevention via atomic claim)
- Removed `gifter_email` from `model_wishes` — kept only on `model_wish_payments`
- Added `payment_attempt_expires_at` (10-min lock timer) to `model_wishes`
- **No presentment subtitle on checkout** — shown only on receipt

## Page 5 — Listing Payment Confirmation (`/listing/confirmation/{pi_xxx}`)
**File:** `listing_payment_confirmation_final.html`

- URL uses Stripe `pi_xxx`, reference `L8758745` shown only in body
- "Contact Sara" is informational text, not link — no change needed
- Skip ambassador snapshot columns (live read from FK; deleted account = receipt 404)
- Added 4 columns: `refunded_at`, `refund_amount`, `presentment_amount`, `presentment_currency`
- Presentment shown when card currency differs (e.g. "Charged as INR 1,580 on your card")

## Page 6 — Wish Gift Confirmation (`/wish/confirmation/{pi_xxx}`)
**File:** `wish-gift_payment_confirmation_for_gifter_final.html`

- Anonymous gifter CTA = "See your gift on Sara's page →"
- Non-anonymous gifter CTA = "See your name on Sara's page →"
- Share text already correct: "I just gifted Sara a beauty wish ❤️ {url}"
- URL shared = ambassador's public page
- Same 4 columns added to `model_wish_payments` (refunds + presentment)

## Page 7 — Dashboard (`/model`)
**File:** `dashboard_final.html`

- Added `dashboard_first_seen_at` for first-visit greeting
- "Expiring soon" alert threshold = 7 days
- Only Listings nav row shows alerts (Wishlist/Analytics/Settings = no alerts in V1)
- "Top clicks" = combine `listing_instagram_click` + `listing_media_click` per category

## Page 8 — Listings (`/model/listings`)
**File:** `listings_final.html`

- Country display: JS map for common abbreviations (UAE/UK/US), no schema change
- Share icon: shares the listing's payment link `/{slug}/listing/{token}`
- Delete rules: Active = blocked modal; Trial/Pending/Expired = hard DELETE
- Click count: combines `listing_instagram_click` + `listing_media_click`
- Expired listings: shown indefinitely, manual delete only

## Page 9 — Wishlist (`/model/wishlist`)
**File:** `wishlist_incl_wish_delete_modal_final.html`

- Added `professional_city` + `professional_country` columns to `model_wishes`
- Updated Add Wish form to capture city + country (HTML + spec already updated)
- [Open] button uses `stripe_payment_intent_id` from `model_wish_payments` → `/wish/confirmation/{pi_xxx}`
- API endpoint: `/api/model/wishes` (auth via session)

## Page 10 — Analytics (`/model/analytics`)
**File:** `analytics_final.html`

- Top gifter ranked by total $ gifted (sum of gross_amount). **Anonymous gifters EXCLUDED from named ranking** (their gifts still count in total earnings, just not in top-gifter list). SQL pattern: `WHERE mw.gifter_is_anonymous = false GROUP BY mw.gifter_name ORDER BY SUM(mwp.gross_amount) DESC`
- Fee display = gross (already locked)
- Pull to refresh = UX only
- Period boundaries = rolling (last 7 / 30 days)
- Trend comparison = vs previous equivalent period

## Page 11 — Settings (`/model/settings`)
**File:** `settings.html`

- Added `is_published` (bool default true) to `model_profiles`. Toggle OFF → public page returns 404 (reuses 404 template)
- Ambassador can self-delete (REVISES earlier "admin only" decision); 3-step modal already designed
- No profile photo (correctly omitted)
- Copy URL — clipboard
- **Currency LOCKED at signup, displayed with 🔒 icon, no change in Settings**

## Page 12 — Add listing form (`/model/listings/new`)
**File:** `add_listing_final.html`

- NO smart-match overlay — Instagram is the LAST field; uniqueness check on submit (server)
- `model_professionals.avatar_photo_url` changed from nullable to **NOT NULL** (form requires it)
- Free trial saves: `status='free_trial'`, `is_free_trial=true`, `free_trial_ends_at=now()+30d`, prices NULL
- Post-create redirects: trial → `/model/listings`, paid → `/model/listings/[id]/send-link`
- Currency read-only from profile

## Page 13 — Add wish form (`/model/wishlist/new`)
**File:** `add_wish_final.html` (UPDATED — city + country added)

- Service column = text only (`service_name`) — no FK to categories
- Post-create redirect: `/model/wishlist?created={wish_id}` for celebration toast
- All fields required: service, professional name, city, country, price
- Currency locked from profile

## Page 14 — Send Payment Link (`/model/listings/[id]/send-link`)
**File:** `send_payment_link_after_listing.html`

- **Editable prices** are mutable on `model_listings`; payment row snapshots are immutable. Same payment link reflects current prices.
- URL format updated to `/{slug}/listing/{token}` (8-char) — match schema during integration
- WhatsApp pre-filled message: ambassador first name + pro name + link
- All entry points correct
- **Trial → Paid conversion (STACKED, not absorbed):** trial days remain valid; paid period starts when trial ends (Day 31), not at payment date

## Page 15 — Onboarding (`/model/setup`)
**File:** `onboarding_register_model_final.html`

- After auth with no profile → `/model/setup`
- Post-onboarding → `/model` (dashboard with celebration greeting)
- Slug check: debounced API call to `/api/model/profiles/check-slug`
- Instagram prefill from `users.instagram_handle` if available
- Currency LOCKED at signup
- Cover photo OPTIONAL (public page shows placeholder if missing)

## Page 16 — Auth Main Page (`/model/auth`)
**File:** `auth_page_final.html`

- WhatsApp OTP via **AUTHKey** (existing app integration; Claude Code reads AUTHKey docs)
- Unified flow: server detects new vs existing user
- Reuse existing Supabase patterns
- Emoji flags (renders correctly across all platforms incl. Windows)
- Rate limiting: 3/phone/hour, 10/IP/hour

## Page 17 — Auth WhatsApp Verify (`/model/auth/verify`)
**File:** `auth_whatsapp_code_verify_final.html`

- Phone persistence: server session
- Auto-submit on 6th digit
- 30-second resend cooldown
- Wrong code: inline error, keep digits, force resend after 3 fails
- Code expiry: show error + clear boxes + force resend (Claude Code implements if not existing)
- Browser back: allow back to `/model/auth`

## Page 18 — Auth Magic Link Sent (`/model/auth/sent`)
**File:** `auth_magic_link_email_sent_final.html`

- Email persistence: server session
- 30-second resend cooldown
- **Magic link expiry: 15 minutes** (set in Supabase, update HTML "10 minutes" → "15 minutes")
- Standard Supabase tab/device flexibility
- Browser back: allow back to `/model/auth`
- "Open email" tracker = visual only, no mail-app button

## Page 19 — Change Email Confirmation (`/model/auth/email-changed`)
**File:** `change_email_confirmation_final.html`

- Emails in URL query (minimal risk, helpful UX)
- Standard Supabase `updateUser({email})` flow
- Standard Supabase logged-out redirect
- No audit trail for V1
- Errors handled by `/model/auth/email-error`

## Page 20 — Wish Already Gifted (`/wish/taken`)
**File:** `payment_gift_taken_already_final.html` (UPDATED — "Back to" → "Go to")

- URL query params (slug + first name — public data)
- History replace (prevents back-button loop)
- Standard 404 for non-existent wish (vs locked-but-not-paid)
- Single page for locked vs completed (keep simple)
- No try-again retry for V1

## Page 21 — Listing Payment Link Expired (`/expired`)
**File:** `payment_link_no_longer_active_final.html` (UPDATED — added "Go to WeLoveDecode" button + subtitle)

- Button text: **"Go to WeLoveDecode"** → `/` (matches Pages 20 + 404)
- No professional name shown (keep simple)
- `<meta name="robots" content="noindex">` + HTTP 410 Gone (industry standard)
- Expired/deleted → this page; Invalid token → 404
- No retry path

---

# PHASE 10 — KEY FILES IN /mnt/user-data/uploads/

Reference HTMLs (21):
- `add_listing_final.html` (+ spec)
- `add_wish_final.html` (+ spec) — UPDATED with city+country fields
- `analytics_final.html`
- `auth_magic_link_email_sent_final.html` (+ spec)
- `auth_page_final.html` (+ spec)
- `auth_whatsapp_code_verify_final.html`
- `change_email_confirmation_final.html`
- `checkout_for_listing-professional_final.html` (+ spec)
- `checkout_for_wish-gifter_final.html` (+ spec)
- `dashboard_final.html`
- `listing_payment_confirmation_final.html` (+ spec)
- `listings_final.html`
- `onboarding_register_model_final.html`
- `payment_gift_taken_already_final.html` (+ spec) — UPDATED button text
- `payment_link_no_longer_active_final.html` (+ spec) — UPDATED with button
- `public_media_lightbox_final.html`
- `public_page_final.html`
- `send_payment_link_after_listing.html`
- `settings.html` (+ spec)
- `wish-gift_payment_confirmation_for_gifter_final.html` (+ spec)
- `wishlist_incl_wish_delete_modal_final.html`

Plus support pages:
- `not_found_final.html` (+ spec) — UPDATED button text
- `email_error_final.html` (+ spec)
- `payouts_list_final.html` (+ spec)
- `payout_statement_final.html` (+ spec)
- `terms_final.html` (+ spec)
- `privacy_final.html` (+ spec)
- `listing_paid_final.html` (+ spec)

Plus legal docs:
- `terms_upload.docx` (will be updated to include ambassador feature)
- `privacy_upload.docx`

Plus architecture:
- `Current_App_Architecture_2026-04-04.docx` (current arch, accurate, hand to Claude Code)
- `beauty-ambassador-implementation-plan_4.docx` (OLD plan — DELETE; salvage only: RLS patterns, RPC for atomic claim, media compression specs, webhook idempotency)

---

# PHASE 11 — EXISTING SUPABASE SCHEMA NOTES

19 existing tables in production. Key reused ones:

**`users`** (22 cols, REUSE)
- Roles: Admin / Staff / Model / Buyer
- CHECK constraint already allows email OR phone_number nullable
- Has: email, phone_number, instagram_handle (UNIQUE), role, user_name, profile_photo_url

**`user_bank_accounts`** (18 cols, USE THIS — plural version)
- Has: bank_name, beneficiary_name, iban_number, swift_code, is_primary, is_verified, status
- Note: `user_bank_account` (singular, 10 cols) is duplicate — DO NOT USE

**`webhook_events`** (11 cols, REUSE)
- Has event_id (Stripe idempotency), event_type, event_data (jsonb), status

**Existing RLS pattern to copy:**
```sql
EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Model')
EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin')
```

**Existing trigger pattern:** `set_updated_at()` function (use for all new tables)

**Known security bug to flag (NOT in our scope but worth fixing):**
`payment_links [SELECT] Public can view active payment links USING((is_active = true))` — public read of all active payment links. Major existing hole.

---

# PHASE 12 — INSTRUCTIONS FOR CLAUDE CODE HANDOFF (PHASE C)

When the schema + audit phases are done, the final Claude Code prompt must include:

1. **All 9 SQL CREATE TABLE statements** with indexes, RLS, triggers, CHECK constraints
2. **Seed data** for `model_categories` (26 rows)
3. **Reused tables list** — do not create new versions of these
4. **Stripe Payment Intents flow** (NOT Stripe Checkout — custom modal UI)
5. **Atomic claim pattern** for wish payment race protection
6. **Fee math** — server splits 80/20 ONCE at payment, stores explicitly, never recalculates
7. **No fake emails** in new ambassador auth flow (allow `users.email = NULL`)
8. **Storage bucket** — `model-media` for cover photos, listing media, professional avatars
9. **Auth bypass** — new auth pages call existing Supabase patterns; don't rebuild auth
10. **Route groups** — put new feature in `app/(ambassador)/` to isolate from `app/(legacy)/`. Each group has its own layout. Old app keeps its current bundling, zero contamination.
11. **Trial-stacking rule** — new paid period = MAX(now, MAX(paid_until, free_trial_ends_at))
12. **Magic link expiry** — set Supabase to 15 minutes (900 seconds)
13. **AUTHKey integration** for WhatsApp OTP — Claude Code reads AUTHKey docs and matches existing app implementation
14. **Stripe presentment** — capture `presentment_amount` + `presentment_currency` from `paymentIntent.latest_charge`, store on payment row, display on receipt only
15. **HTTP status codes** — 410 Gone for expired payment links, 404 for non-existent slugs/tokens, `noindex` meta on terminal pages

## Performance & bundling rules (CRITICAL)

16. **Per-page imports only** — NO monolithic bundles. Each page imports only what it needs. Let Next.js code-split naturally per route. Do NOT create a global wrapper that loads everything upfront.

17. **Lazy-load heavy libraries** — Use `next/dynamic` to load these ONLY when their page is visited:
    - **Chart.js** → only on `/model/analytics`
    - **Stripe.js + Stripe Elements** → only on checkout pages (`/{slug}/listing/{token}`, `/{slug}/wish/{token}`)
    - **Supabase Storage SDK** (upload-related code) → only on Settings, Onboarding, Add Listing
    - **Country picker dataset** (135 currencies, 250 countries) → lazy import, not in main bundle
    - Any other 50KB+ library → lazy by default

18. **Static generation (SSG) for terminal/static pages** — Pre-render at build time, serve from CDN. No server work at runtime:
    - `/terms` — static
    - `/privacy` — static
    - `/expired` — static
    - `/wish/taken` — static (URL params parsed client-side)
    - `/listing/paid` — static
    - 404 page — static
    - `/model/auth/sent` — static (email param read client-side)
    - `/model/auth/email-changed` — static (params read client-side)
    - `/model/auth/email-error` — static
    
    Use Next.js `export const dynamic = 'force-static'` or default static generation. These pages have ZERO database queries.

19. **Old app preservation** — Existing auctions / offers / pay pages keep their current styling and bundling. Do NOT refactor old code. Do NOT extract shared components from old → new. Treat the two route groups as independent applications that share a Next.js root.

**Expected bundle size:**
- Static pages: ~20KB
- Most ambassador pages: ~120KB
- Analytics page: ~250KB (with Chart.js)
- Checkout pages: ~200KB (with Stripe.js)

Without these rules: every page loads 800KB+. With them: 6x faster, especially on mobile networks.

## HTML mockup cleanup rules (CRITICAL — read carefully before stripping anything)

20. **HTML mockup cleanup** — Each `*_final.html` file in `/design/source-html/` is a self-contained design mockup. Convert to production by following these rules EXACTLY. Be conservative: when in doubt, KEEP it. Do NOT aggressively strip code.

### ✅ ALWAYS KEEP (do not remove)

- ALL HTML structure and markup
- ALL inline `<style>` blocks (visual reference)
- ALL CSS class names, IDs, and attributes
- ALL real JavaScript logic that handles user interactions: form validation, dropdown toggles, modal opens/closes, input formatting, debounced lookups, animation timing, OTP auto-submit, drag-to-reposition, Stripe Element initialization, share button handlers, copy-to-clipboard, country picker filtering, slug availability checks, etc.
- ALL regex patterns used for validation (e.g. `/^pi_[A-Za-z0-9]{20,40}$/`, slug regex, name sanitization)
- ALL XSS protection patterns (`textContent` usage, `history.replaceState()`, regex validation before fetch)
- ALL business logic comments that document behavior (look for blocks labeled `ENTRY POINTS`, `DATA VALIDATION`, `HISTORY HANDLING`, `SECURITY`, `Field usage`, server contract examples, endpoint references)
- The `<meta name="robots" content="noindex">` tags on terminal pages
- The `<meta charset>` and viewport tags
- HTTP status code requirements (404, 410 Gone) noted in comments

### ❌ REMOVE (mockup-only — safe to strip)

These are explicitly labeled in the files and ONLY exist for design preview:

- **Hardcoded sample data shown as defaults:**
  - `'Sara Johnson'`, `'sarajohnson'`, `'Salon de Luxe'`, `'salonluxe'` etc. as fallback default values
  - Sample arrays of fake listings/wishes/payments used for design preview
  - Hardcoded sample chart data
  - Sample bar chart percentages

- **Demo mode infrastructure** (search for and remove):
  - The entire `applyDemoMode()` function in any file
  - Code that reads `?demo=expired`, `?demo=refunded`, `?demo=presentment`, `?demo=anonymous`, `?demo=notfound` URL params
  - Comment blocks marked `MOCKUP-ONLY:` or `MOCKUP PATH` or `// MOCKUP fallback`
  - "Preview greeting" buttons (`btnFirst`, `btnReturn`) used to toggle dashboard greeting states for design review
  - `isMockup` checks (e.g. `window.location.protocol === 'file:'`)
  - Demo state toggle buttons in `_demoToggle` divs

- **Sample data initializations:**
  - `var tx = { reference: 'L8473921', amount: 70, ...mockData }` blocks that exist as fallback before real fetch — keep the FETCH logic, remove the hardcoded fallback object

### 🔄 REPLACE (transform from mockup to production)

- Hardcoded data displays → bind to real data from API endpoints documented in the inline comments and UI spec files
- Sample API response objects in comments are REFERENCES for the contract — the actual fetch must return data in that shape
- File paths in mockup code (e.g. `welovedecode.com/sarajohnson`) → use the real domain via env var or relative path

### Example — what cleanup looks like in practice

```javascript
// BEFORE (mockup):
var tx = {
  reference: 'L8473921',
  amount: 70,
  currency: 'AED',
  ambassador: { name: 'Sara Johnson', slug: 'sarajohnson' }
};
applyDemoMode(tx);  // checks ?demo= params
renderReceipt(tx);

// AFTER (production):
const pi = parsePaymentIntentFromURL();
if (!PI_REGEX.test(pi)) return showNotFound();
const tx = await fetch(`/api/listings/by-payment-intent/${pi}`).then(r => r.json());
renderReceipt(tx);
```

Notice what was kept: the regex validation, the fetch logic, the render function, the URL parsing.
What was removed: the hardcoded `tx` object and the `applyDemoMode()` call.

### Final reminder

The HTML files are FULL of intentional, well-tested business logic. Strip only the items explicitly marked as mockup. If a comment doesn't say "MOCKUP-ONLY" or "demo", assume it's important. **A mockup with sample data left in production is bad. A production app with critical validation logic accidentally removed is worse.**

## Auth integration — scope reminder (CRITICAL — do NOT over-engineer)

21. **Auth pages are THIN integration layers, not from-scratch rebuilds.** The existing app already has working Supabase auth + AUTHKey for WhatsApp OTP. The new auth pages (`/model/auth`, `/model/auth/verify`, `/model/auth/sent`, `/model/auth/email-changed`, `/model/auth/email-error`, `/model/setup`) are 10–20 lines of code each that wire the new UI to the existing auth infrastructure.

### Auth page implementation rules

- **DO import the existing Supabase client** from wherever the legacy app instantiates it (`lib/supabase.ts` or similar). Do NOT create a new client.
- **DO use existing AUTHKey integration** for WhatsApp OTP send + verify. Match the same endpoint patterns the legacy app uses.
- **DO call the correct Supabase function on form submit:**
  - Email path: `supabase.auth.signInWithOtp({ email })` for magic link send
  - Magic link callback: Supabase handles automatically via `/auth/callback` route
  - Email change: `supabase.auth.updateUser({ email: newEmail })`
- **DO handle responses simply:**
  - Success → redirect (`/model/setup` for new users, `/model` for existing)
  - Error → show toast or inline message
- **DO NOT touch session cookies, JWT handling, or token refresh logic.** Supabase manages these. Just call the SDK and trust it.
- **DO NOT write custom OTP storage, hashing, magic link generation, or session management.** All of this exists.
- **DO NOT add password authentication.** Email magic link + WhatsApp OTP are the only paths.
- **DO NOT create new auth-related database tables.** Supabase Auth schema is already in place.

### Per-page expected code size

| Page | Expected LOC |
|---|---|
| `/model/auth` | 30–40 lines (UI + 2 SDK calls: WhatsApp send, magic link send) |
| `/model/auth/verify` | 25–35 lines (OTP boxes + AUTHKey verify call) |
| `/model/auth/sent` | 15–20 lines (mostly static) |
| `/model/auth/email-changed` | 15–20 lines (mostly static) |
| `/model/auth/email-error` | 10 lines (static page) |
| `/model/setup` | 60–80 lines (form + slug check + profile insert) |

**Total auth-page code: ~150–200 lines.** If Claude Code writes 500+ lines of auth code, something has gone wrong — review and simplify.

### What "thin integration" looks like

```typescript
// /model/auth — email magic link path
async function continueWithEmail() {
  const email = emailInput.value.trim();
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) return showToast(error.message);
  router.push(`/model/auth/sent?email=${encodeURIComponent(email)}`);
}
```

That's it. ~5 lines of actual auth logic. The rest of the page is UI + validation + toast handling.

## Stripe integration — isolation from legacy payment flows (CRITICAL)

22. **Stripe must be ISOLATED from existing auction/offer payment code.** Same Stripe account (one company = one Stripe account), but new code paths, new webhook endpoint, new metadata tags. Zero contamination.

### Stripe account & keys

- **Same Stripe account** as the legacy app (auctions, offers, etc.)
- **Same API keys** read from existing env vars (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- Do NOT create new test/prod accounts or new key pairs

### NEW webhook endpoint

- Create a NEW webhook URL: `/api/webhooks/ambassador-stripe`
- Configure this URL in Stripe Dashboard (separate from existing legacy webhook URL)
- This endpoint handles ONLY the events for the DECODE ambassador feature:
  - `payment_intent.succeeded` (listing or wish payment completed)
  - `payment_intent.payment_failed` (revert wish status to 'available')
  - `charge.refunded` (mark payment as refunded, notify ambassador)
- Use the existing `webhook_events` table for idempotency (`event_id` UNIQUE)
- Old auction/offer webhooks keep their existing endpoint, untouched

### PaymentIntent metadata tagging (REQUIRED)

Every PaymentIntent created by DECODE feature MUST include metadata to identify it:

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: grossAmount,
  currency: ambassadorCurrency,
  metadata: {
    feature: 'ambassador',           // namespace this feature
    type: 'listing' | 'wish',    // which kind of payment
    listing_id: '...',           // OR wish_id, depending on type
    model_id: '...',             // ambassador internal ID
    payment_reference: 'L8473921' // human-readable reference
  }
});
```

The webhook handler routes events by `metadata.feature === 'ambassador'`. Old code paths ignore these. New code path ignores legacy events without this metadata. **Total isolation.**

### What Claude Code MUST NOT do

- Do NOT touch the existing webhook endpoint or its handlers
- Do NOT modify legacy PaymentIntent creation code (auctions, offers)
- Do NOT consolidate "shared Stripe utility" with legacy code — they're independent on purpose
- Do NOT create Stripe Products / Prices objects (we use dynamic PaymentIntents with custom amounts)
- Do NOT use Stripe Checkout (hosted page) — we use Stripe Payment Intents + Stripe Elements (custom modal in our UI)

### Stripe Connect status

**Not used.** All payments collect into the DECODE platform's Stripe balance. Manual payouts to ambassadors via bank transfer (Wednesdays). See Phase 1 architectural decisions.

## Loop prevention (CRITICAL — prevents browser freezes and lockouts)

23. **Two simple rules to prevent endless loops:**

### A. Bounded retries on webhook polling

Pages that wait for a webhook (listing receipt, wish receipt) MUST follow this exact pattern:
- Retry every 1 second
- **Maximum 5 retries (5 seconds total)**
- After max retries, render optimistic state (e.g. "You're live!") — NEVER keep retrying

This pattern is already specified in `listing_payment_confirmation_final_UI_Spec.md` and `wish-gift_payment_confirmation_for_gifter_final_UI_Spec.md`. Apply the same bound to ANY future polling — no exceptions.

```javascript
// CORRECT pattern
let attempts = 0;
const MAX_ATTEMPTS = 5;
async function poll() {
  const data = await fetch(...);
  if (data.status === 'pending' && attempts < MAX_ATTEMPTS) {
    attempts++;
    setTimeout(poll, 1000);
  } else {
    render(data); // either real data OR optimistic fallback
  }
}
```

### B. Auth redirect loop prevention

When redirecting between auth-related pages, follow these rules to prevent infinite loops:

- `/{slug}` where `is_published=false` → **render 404**, do NOT redirect
- `/model/auth` → if user already has session → `router.replace('/model')` (use replace, not push)
- `/model/setup` → if profile already exists → `router.replace('/model')`
- `/model/*` (any logged-in route) → if no session → `router.replace('/model/auth')`

**Always use `router.replace()` for redirects** (not `router.push()`). Replace removes the page from history, preventing back-button traps and redirect chains.

**Test for loops:** open dev tools → Network tab → if you see same URLs repeating, there's a loop. Fix immediately.

## Loading pattern — skeleton screens (LOCKED)

24. **Use skeleton screens for ALL data-fetching pages.** Do NOT use full-screen blocking spinners. Do NOT use staggered card reveals (the staggered animations in the mockup HTML are demo-only — REMOVE in production).

### Pattern

1. Page structure renders instantly (header, frame, navigation, section labels)
2. Data-loading sections show as grey placeholder rectangles (skeletons)
3. Data fetches in background
4. When data arrives: skeletons fade out, real content fades in — **single transition, all at once** (no staggered reveals)

### Skeleton style (matches DECODE design tokens)

- **Background:** `#1c1c1c` (same as card bg — looks like an empty card)
- **Shimmer:** subtle gradient sweep via CSS animation (no JS)
  ```css
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .skeleton {
    background: linear-gradient(90deg, #1c1c1c 0%, #262626 50%, #1c1c1c 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 12px;
  }
  ```
- **Dimensions:** match the real content exactly (no layout shift when data loads)
- **Border radius:** matches the real card (12px)
- **Transition:** 200ms fade between skeleton and content

### Where skeletons apply (data-fetching pages)

Dashboard, Listings, Wishlist, Analytics, Public page `/{slug}`, Listing receipt, Wish receipt, Send Payment Link, Payouts list, Payout statement.

### Where skeletons do NOT apply (instant render)

Auth pages, Onboarding form, Add Listing/Wish forms (empty inputs), static pages (Terms, Privacy, 404, Expired), edge case pages (wish taken, listing paid), Settings (uses pre-loaded user data).

### What to REMOVE from mockup HTMLs

The mockup HTML files contain demo animations like:
- Cards appearing one-by-one with staggered `setTimeout` delays
- Counter animations on stat numbers
- Bar fill animations triggered after page load

In production: render data instantly when fetched. No staggered reveals. The animations make the mockup feel "alive" for design review but are jarring in production. Skeletons handle the loading state — once data is ready, just show it.

Plus reference docs:
- This master document
- All `*_final.html` files (in `/design/source-html/`)
- All `*_UI_Spec.md` files (in `/design/ui-specs/`)
- The current architecture docx

---

## Pre-launch checklist

Values intentionally set to dev/testing defaults during slice work that
MUST be reset before launch. This is the canonical list — Claude Code
updates it as entries are added or resolved.

| # | Item | Current state | Required before launch | Added in slice |
|---|------|---------------|------------------------|----------------|
| 1 | `authPhoneLimiter` rate limit | 20/hr (loose for testing) | Reset to 3/hr | Slice 1 |
| 2 | Cloudflare Turnstile | Non-blocking mode (token-loading bug, deferred) | Fix token loading, re-enable blocking verification | Slice 1 |

**Format for new entries:** Item name, current state with reason, what
"resolved" looks like, and which slice added the item. Append only;
don't renumber existing rows when adding new ones.

**When an item is resolved:** Strike through the row (or move to a
"Resolved" subsection below) with the commit hash and date.

---

# RESUME INSTRUCTIONS (if chat dies)

If you're a fresh chat reading this, the user wants to continue with:

**"Phase B is complete. All 21 pages are audited and locked. Schema is final (9 tables, 135 columns). Now move to Phase C — write the comprehensive Claude Code handoff prompt for actual implementation. Use this DECODE_PROJECT_STATE.md + all final HTML files + UI specs as authoritative source."**

The handoff prompt should be a complete, standalone brief that Claude Code can use to implement the entire feature without needing to ask questions back.
