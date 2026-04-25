# DECODE — Ambassador Feature Project State

**Last updated:** 2026-04-25 (Slice 5A closed — shipped 8478427 wishlist page server + GET API + DELETE API + WishlistClient + DeleteWishModal + dashboard nav-card wire + open-wish count badge, 86292c0 Add Wish form (`/model/wishlist/new`) + POST `/api/ambassador/model/wishes` with `payment_link_token` generator (8-char base64url, 5-retry on 23505) + `gifts_enabled` server-side gate, 1cf463f wishlist visual polish (card layouts + two distinct toasts + age progress bar + share-icon WhatsApp wiring + delete-modal preview row replica), 7a28f16 Add Wish first polish iteration (8 visual gaps closed), aadb808 Add Wish second polish — pixel-fidelity rewrite (full `#cwPage`-scoped CSS port: focus rings on text inputs, `.cwFw:focus-within`, placeholder color, CTA `.ready/.working/.success` !important class pattern, custom-input auto-focus 50ms, `priceTouched` reset on focus, chevron `rotate(0deg)` close transition, `padding:0` on price input, `font-family: system-ui` on root). 8 source files, ~1450 LOC for the slice. Live proof: ambassador can create wishes (with city + country), list them with filter tabs (All/Open/Gifted), delete unbacked wishes (gifted cards hide the icon via `removable=false` projection), dashboard wishlist nav card shows `{N} open` badge. `gifts_enabled` toggle live (pre-shipped Slice 1.5; gates `/model/wishlist/new` server-side). Spec drift superseded in both wishlist + add-wish UI specs (status terminology `open/gifted/deleted` → `available/taken`, table names `wishes/gifts` → `model_wishes/model_wish_payments`, §11.1 schema `category_id` FK + `category_custom` → single `service_name` text field, §11.4 pull-to-refresh dropped, Instagram + avatar fields removed from scope, §6 soft-delete → hard-delete with FK `ON DELETE RESTRICT` preserving audit). 1 new hardening item (25) logged: ambassador-side list/form Client LOC ceiling re-evaluation — `WishlistClient.tsx` 457 + `AddWishClient.tsx` 376 + `ListingsClient.tsx` 484 all past G12 #8 350-LOC threshold; pick decompose-on-touch vs. raise-threshold-to-500 at start of Slice 5C. Closeout retro locked: visual fidelity needs explicit per-element verification — first 5A-2 polish (`7a28f16`) shipped with generic "matches mockup" claim but live page still drifted; second polish (`aadb808`) required strict mockup-line-by-line comparison surfacing 10 discrete gaps. Future visual polish commits MUST list before/after per element (sizes, colors, spacing, animation timings, CSS rule names) in the post-commit report. Slice 5B opens next: Principle I extractions (`<TurnstileWidget/>`, `getClientIp` → `lib/server/ip.ts`, `PaymentModalShell` + `StripeElementsForm` parameterization for wish-checkout) before 5C wish-gifter paid flow lands. Previously: 2026-04-25 Slice 4D closed — shipped 2ecd90f doctrine commit (Patterns 1-3 + pre-flight inputs added to PROJECT_STATE + HANDOFF G12 addendum), 262c0ac Turnstile + Upstash rate-limit on `/api/checkout/listing` POST + Cloudflare widget on `CheckoutClient` + env-validation hardening with Stripe key prefix regex + cross-key mode consistency check (closes hardening items 14 + 16), d5d1530 `/api/analytics/track` POST endpoint with bot UA filter (`isbot`) + cookie session dedup + IP-hash + ambassador self-view skip + 4 client instrumentation sites (PublicPageClient view, SquadRow IG + media clicks, ShareButton share click) + spec §2.4/§2.5 supersession + `lib/analytics/session.ts` helpers + `ANALYTICS_IP_SALT` env var, aaf9977 ListingsClient send-link entry-point button on trial/pending/active cards + PATCH route trial-pricing relax (allow price writes on `is_free_trial=true` listings; flag itself remains immutable via `EDITABLE_KEYS` whitelist). 17 files touched, +552 / -48 (net +504 LOC). All files under 300-LOC alarm. Live proof: 2 `public_page_view` rows in `model_analytics_events`, payment flow with Turnstile invisible-mode verifies clean, S2 trial → send-link → blur-PATCH succeeds. Slice 4 fully complete (4A ✅ + 4B+4C ✅ + 4D ✅). Milestone review passed: 8-item security audit clean — rate-limit IP-keyed (not client-resettable session), Turnstile fail-open is intentional graceful degradation, `/api/analytics/track` defense-in-depth (whitelist enum + isbot + rate-limit + service-role insert + spoof-proof self-view skip via auth.uid()), `is_free_trial` immutability preserved through 3 layers of PATCH defense (EDITABLE_KEYS whitelist + unknown-key gate at line 190 + pricing block never touches the flag), Stripe Sandbox keys accepted by the new prefix regex. Patterns 1-3 ratified into doctrine (no webhook rate-limit, client-side analytics POST, single multi-event endpoint). 4 new hardening items (21-24) logged: analytics URL-blocker resilience, TurnstileWidget rule-of-three watch, `getClientIp` extraction trigger, `ANALYTICS_IP_SALT` entropy validation. Closeout retro locked: pre-flight infrastructure-grep paid off (~180 LOC of work avoided by discovering pre-built `rate-limit.ts` + `turnstile.ts` + auth widget pattern + `model_analytics_events` schema + S1/S2/S3 state machine + `model_listings_live` view + `isInAppWebView`). Previously: 2026-04-24 Slice 4B+4C closed — shipped 390437c checkout spec supersession, 378ee3b `STRIPE_AMBASSADOR_WEBHOOK_SECRET` env registration, 05aa90b `/api/checkout/listing` POST + `/api/listings/by-payment-intent/[pi_id]` GET, 5e692cd `/pay/[token]` dispatch rewrite + `CheckoutClient`/`PackagePicker`/`UrlOverlay`/`PaymentModal` components + `PAYMENT_BASE` env-aware (closes hardening item 7), 3487474 base64url regex bugfix for 8-char token pattern, 45166d0 checkout mobile-framed layout, cc110bd `/listing/confirmation/[pi_id]` + `/expired` pages + `/pay` dispatch expired-redirect, 19638f7 `/expired` heading centering, 44e04bf `/api/webhooks/ambassador-stripe` atomic handler + `payout-math` + `notification-stubs` + `webhook-handlers` (3 event types — `payment_intent.succeeded` + `payment_intent.payment_failed` + `charge.refunded` — with dual-layer idempotency), a34b6a5 single-screen Elements flow polish (reverted in next commit), 5a93c59 two-screen UX restore + `PaymentModal` decomposition into `PaymentModalShell` + `StripeElementsForm` per G12 item #8. 16 source files, 2,359 LOC. Live proof: payment `L-400-5194` (AED 50.00, 20% flat platform fee = AED 10.00, net AED 40.00, 30-day package, DB CHECK `gross_amount = platform_fee + net_amount` holds). Milestone review passed: 10-item security audit clean (no placeholder-bypass copied from legacy, dual-layer idempotency via `webhook_events.event_id` + `model_listing_payments.stripe_event_id`, service-role throughout, amount re-derived server-side at both PI create + webhook processing layers, metadata routing by `feature='ambassador'` + `kind='listing'`). 9 new hardening items (12-20) logged including Vercel env prefix validation (item 16), Apple Pay domain registration (item 15), shared `webhook_events` table concern (item 18), Slice 5 Principle I watch on `PaymentModalShell`/`StripeElementsForm` reuse (item 19). Closeout retro locked: fix direct bug before re-evaluating architecture — commit `a34b6a5` → `5a93c59` two-screen revert arc cost one full revert + ~2h of rework because a Pay-button disabled-state bug was conflated with an architectural spec deviation. Previously: 2026-04-24 Slice 4A closed — shipped aaa9c8e + f9276ce public page `/{slug}` with 10 components + ISR + metadata, 023fb0a public page spec V1 supersession (listings-only; Wishlist + Wall of Love deferred to Slice 5), ade05ae Slice 4 locked decisions (pre-flight), a3d061c hardening items 7-8 + S2/S3 trial-conversion pre-flight input. Previously: 2026-04-23 Slice 3C closed — shipped 49c00e0 send-link spec supersession, 7f8c4b4 locked decisions, fed7600 PATCH listings API, 5e8729e AddListing helper extraction, 8c85532 Edit Listing page + mode prop on AddListingClient + card edit icon, 08418d6 ProgressTracker N-step generalization, 12ec72a Send Payment Link page + paid-path redirect + ListingsClient cleanup + inert pricing wrapper. Guardrail 13 partner-mode protocol formalized + Guardrail 12 item #8 (File-size planning) locked in the Phase 4 closeout commit. Previously: 2026-04-23 Slice 3B closed — shipped 08bf4f0 spec supersession, 9a17e78 locked decisions, 2710b51 browser-image-compression install, e692f63 Phase 2 cropper + verifier, 59ee24e cropper rewrite against authoritative spec, ece37a8 closeout reminder, a3ef037 POST professionals, b11f0ec POST listings, 304c66d form scaffold, 3408196 uploads + dedup + submit wired, bf10c0b full-viewport dim + paid emoji; plus session-hygiene commits e16e2dd Guardrail 11 and e1b0e29 Guardrail 12 between 3A and 3B. Previously: 2026-04-23 Slice 3A closed — 1ceaa28 rules-of-hooks re-upgrade, a3a9e79 opening doc, 47409d3 GET+DELETE API, f121ef3 Listings page + dashboard wire-up, 4e86c2c delete modals + toast, de5c862 optimistic UI, 98bd60c toast animation per spec §7.9, 8a28410 Principle I lock. Previously: 2026-04-22 Slice 2 closed — d8468d8 + f6c3201 + 81d5f1a; 2.5 3ae5ffe; 2.7 545e485; H1 b1284eb; H2 1dfa086; H3 8fc50c4+925c815.)
**Project:** DECODE (welovedecode.com) — Ambassador feature
**Current subdomain:** `app.welovedecode.com` (apex still on Carrd, migration later)
**Status:** Slice 1.5 shipped. Slices 2/3/4 replace the old mega-Slice-2 (completeness / listings CRUD / payment).

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
| 11 | Email | ~~Allow `users.email = NULL` for new ambassador auth flow (no fake @whatsapp.decode.local emails)~~ **SUPERSEDED by decisions #19–21 in Slice 1.5.** Initial implementation used synthetic `wa_{hash}@auth.internal` emails via `generateLink({type:'magiclink'})` — this auto-created duplicate auth.users rows per human. Slice 1.5 Path B fixes this by populating `auth.users.phone` natively via `auth.admin.createUser({ phone, phone_confirm: true })` so phone is the authoritative identity (deterministic synthetic email is retained only as a session-mint fixture, hidden from UI by `isInternalEmail` filter). |
| 12 | Stripe integration | Stripe Payment Intents + Stripe Elements (custom modal, NOT hosted Checkout) |
| 13 | Video storage | **Supabase Storage only** (bucket `model-media`). NO transcoding service for V1. Accept that iPhone HEVC videos may not play on Firefox / older Android (95%+ of beauty industry users on iPhone Safari + Chrome where HEVC plays fine). Revisit if visitor complaints arise — can add Cloudflare Stream later. |
| 14 | Image processing | **2-stage compression:** (1) Client-side resize via `<canvas>` BEFORE upload using `browser-image-compression` library — max 1500x750 (cover), 1080x1080 (listing photos), 400x400 (professional avatar). (2) Server-side delivery via Next.js `<Image>` — Vercel automatically serves WebP/AVIF based on visitor's browser. Net result: phone 5MB photo → ~300KB stored → ~150KB delivered. |
| 15 | Video processing | **NO compression / NO transcoding.** Stored as-is on Supabase Storage. Strict limits enforced client-side BEFORE upload: **max 15 seconds duration, max 15MB file size**. Matches TikTok/Reels standard. Files larger or longer rejected with friendly error. Allowed formats: MP4, MOV, WebM (HEVC accepted but flagged as "may not play on Firefox"). |
| 16 | Storage bucket security | Bucket `model-media` RLS policies: **SELECT** = public (anyone can view). **INSERT** = authenticated users only, path must contain `auth.uid()` (e.g. `{uid}/cover.jpg`). **UPDATE** = owner only (path contains `auth.uid()`). **DELETE** = owner only. Prevents public upload of arbitrary files. |
| 17 | Bot protection | **Cloudflare Turnstile** (free invisible CAPTCHA) on (1) both checkout pages (`/{slug}/listing/{token}` and `/{slug}/wish/{token}`) and (2) auth pages that trigger sending costs — WhatsApp OTP (`/model/auth`) and email magic link (`/model/auth`). Verifies visitor is human BEFORE sensitive actions. Prevents wish-locking griefing AND prevents OTP spam that would drain AUTHKey credits. Combined with rate limiting: max 3 lock attempts per IP per 10 min on checkout; max 3 OTP per phone per hour + 10 per IP per hour on auth. |
| 18 | Notifications architecture | **Email via Resend + WhatsApp via AUTHKey.** Stripe Dashboard admin emails for payment/refund alerts (to admin only — no code). 3 custom Resend emails: (1) professional payment receipt, (2) gifter wish receipt, (3) professional listing-expiring-7-days reminder. 4 WhatsApp UTILITY templates (configured in AUTHKey dashboard, category=UTILITY not AUTHENTICATION): listing paid (to ambassador), wish gifted (to ambassador), listing expiring (to ambassador + to professional). All templates submitted for Meta pre-approval via AUTHKey. Code calls AUTHKey API with template ID (`wid`) + variables — same pattern as existing OTP flow. |
| 19 | Auth primacy | **WhatsApp is the primary sign-in method. Email is a secondary fallback only.** The `/model/auth` page leads with WhatsApp; email access is via "No WhatsApp?" link. Never equal-weight the two methods in UI. Email's role is account recovery and cross-device sign-in, not primary identity. (Locked 2026-04-19) |
| 20 | One human = one `auth.users` row | **Phone is the authoritative identity for WhatsApp signups; `auth.users.phone` is populated natively via `auth.admin.createUser({ phone, phone_confirm: true })`.** Email signups populate `email`; adding the other method later populates the empty column on the SAME row via `supabase.auth.updateUser()`. **Path B amendment (2026-04-19):** Path A (Supabase native `signInWithOtp({ phone })`) was attempted but blocked because the dashboard's Phone provider configuration form does not accept input in any browser, so the provider cannot be enabled. As a workaround, new WhatsApp users are created with **both** a populated `phone` column AND a deterministic synthetic `wa_{sha256(phone).slice(0,12)}@auth.internal` email — the synthetic email exists solely as a `generateLink` session-mint fixture and is hidden from all UI by `isInternalEmail()` (settings page filter). This is the B1 hybrid; identity remains the phone column. |
| 21 | Signup method determines Settings row order | In Settings Login methods card, the user's signup method always appears first; the added method appears second. Persisted as `public.users.signup_method TEXT` (`'whatsapp' | 'email'`) set at account creation and never flipped. Respects the user's mental model of "my account." (Locked 2026-04-19) |

---

# PHASE 1.5 — ARCHITECTURE PRINCIPLES (LOCKED)

Forward-looking engineering principles that all future slices must follow. Each principle captures a specific failure mode encountered in a prior slice, with the rule derived from it. Violations require explicit justification in the plan before implementation.

### Principle A — Identity field must be unmutable

Phone is the authoritative dedupe key for WhatsApp users. Never dedupe by email, synthetic email, or any field a user can mutate later.

**Origin:** Slice 1.5 phantom-row bug (commit `f3e886e`). Email-based dedupe broke as soon as Add Email overwrote the synthetic email.

### Principle B — One email pipeline: direct Resend with repo templates

ALL user-facing transactional and auth-flow emails go through direct Resend API with HTML templates in the repo (`lib/ambassador/email-templates.ts` or `components/emails/*.tsx`). Supabase dashboard-managed email templates are FORBIDDEN. One sender identity, one template source, one code-owned pipeline, no dashboard drift, no vendor lock.

**Origin:** Slice 1.5 Add Email flow initially used `supabase.auth.updateUser({ email })` which triggered Supabase's default email exposing synthetic `wa_*@auth.internal` addresses to users.

### Principle C — Opaque DB-owned tokens for confirmation links

Any confirmation link that may be clicked from a different browser/device than the one that requested it MUST use opaque DB-owned tokens, NOT Supabase's `admin.generateLink` output. Supabase's PKCE-bound tokens invalidate when clicked cross-browser. Pattern: app-owned table with `token`, `user_id`, `expires_at`, `consumed_at`, atomic-consume-and-apply via admin API.

**Origin:** Slice 1.5 Add Email flow returned `otp_expired` when user sent from phone and clicked from laptop.

### Principle D — auth.users writes must pair with public.users shadow writes in the same code path

Any code path that creates, modifies, or replaces `auth.users` rows MUST also write the shadow row in `public.users` atomically (same request). Shadow-ensure in callback is a self-heal net, not a replacement for write-time pairing.

**Origin:** Slice 1.5 Phase A shipped an FK violation on setup submit because the `public.users` row was never created on WhatsApp signup.

### Principle E — Match existing patterns before inventing new ones

Before building a feature, grep the codebase for existing patterns that solve similar problems. Match the pattern or explicitly justify why a new pattern is required in the plan.

**Origin:** Slice 1.5 Phase C built a new email architecture (Supabase `updateUser` path) while `send-magic-link/route.ts` already demonstrated the correct pattern (direct Resend). Architecture drift resulted.

### Principle F — TypeScript narrowing must survive the Next.js build pipeline

Local `npx tsc --noEmit` and Vercel's `next build` typecheck can produce different results for the same code, especially for discriminated-union narrowing. For Supabase SDK returns that use `{ data, error }` discriminated unions, destructure `{ data: X, error: Y }` up-front rather than keeping a combined variable; use `(param: any) =>` in `.find()` / `.filter()` callbacks for `listUsers`-style returns. Matches existing patterns in `check-email/route.ts`, `proxy-user-lookup/route.ts`, `users/invite/route.ts`.

**Origin:** Slice 1.5 commit `b9fbc79` — Vercel collapsed `User[] | []` to `never[]` while local tsc preserved the union.

### Principle G — End-to-end cross-browser smoke tests catch what same-browser tests miss

Paired with Guardrail 6 in CLAUDE_CODE_HANDOFF.md. Any flow that involves email confirmation links must be smoke-tested with request and click happening in DIFFERENT browser sessions (or incognito + regular) before that flow is declared verified.

**Origin:** Slice 1.5 Phase C Add Email worked in single-browser testing but failed cross-browser.

### Principle H — Slice scope discipline

Each slice targets ~1 to 1.5 days of focused work with a single, testable end-to-end outcome. If the scope breakdown shows >2 days or >3 phases, split into smaller slices before starting. Shorter slices = earlier drift detection = less rework.

**Origin:** Slice 1.5 at 3 days produced architectural drift (duplicate email pipeline, dedupe-by-email bug) because multiple concerns compounded. Added 2026-04-21 after proposing a 5-phase mega-Slice-2 that violated this rule — the split into Slices 2/3/4 was the corrective action.

**Addendum 2026-04-22 — Pre-flight UX-lock gate (Slice 2 session lesson).** Pre-flight audit caught 5/5 code surprises this session but missed two UX-churn cases: B3→2.5 (action sheet superseded by direct-edit within hours) and 2.6→2.7 (onboarding mode branch added then deleted within ~30 min). Root cause: UX-churn isn't a code surprise, it's an un-locked upstream decision. For UI-heavy slices, pre-flight must add a "UX pattern locked?" gate — a 10-minute sketch review before any code is written. Net progress in both cases was still real (B3→2.5 delivered direct-edit; 2.6→2.7 delivered -90 lines of duplicate drag/position logic in `setup/page.tsx`), so neither is retrospectively regrettable — but both were avoidable with an earlier UX lock. Pre-flight process formalized as Guardrail 12 in CLAUDE_CODE_HANDOFF.md (2026-04-23).

**Addendum 2026-04-23 — Partner-mode protocol (Guardrail 13).** Partner-mode cadence formalized during Slice 3C Phase 3. Default: ship by typecheck+lint green, no pre-commit proposal gate. UI commits verified via live spot-check instead of pre-commit diff review. Pre-commit diff review reserved for high-risk work (scope-guard trips, Principle A/D/I flags, security-adjacent endpoints, schema/RLS changes, or genuine implementation uncertainty). Code review lands at slice boundaries (3A, 3B, 3C, 4), not phase boundaries. Full text in CLAUDE_CODE_HANDOFF.md Guardrail 13.

### Principle I — Generic UI primitives must be defined once and reused everywhere

Generic interaction primitives (toasts, modals, buttons, inputs, loading states, transitions, skeleton screens) must have one canonical implementation shared across all pages. When a slice needs a primitive that doesn't exist yet, the slice defines the canonical version once — shared location, shared styles, shared animation, shared timing — and all current and future instances use that one implementation.

Per-slice invention of generic primitives (pop-in on page A, fade on page B, slide on page C) is a Principle I violation. User experience consistency is architectural, not cosmetic.

Trigger: if a slice introduces a new toast/modal/button/animation behavior, the slice MUST either (a) reuse an existing canonical implementation, or (b) define the canonical version in a shared location AND add a hardening backlog item to retrofit any existing divergent instances to match.

**Origin:** Slice 3A toast animation divergence. Seven existing ambassador toasts had no entrance animation; the Listings spec defined a slide-up/fade animation that shipped on Listings only. Principle locked after user feedback that per-slice UI invention is the exact architectural drift the principles exist to prevent. Retrofit completed in `e2095e4` — all 7 divergent toasts now use the canonical animation.

### Architecture patterns

Cross-cutting patterns documented after locked decisions in prior slices. These are DEFAULTS for future work — applicable without re-litigation unless a slice-specific locked decision overrides.

#### Pattern 1 — No rate-limiting on webhook endpoints

Stripe (and similar webhook sources) retries on 5xx/429 with exponential backoff over days. Rate-limiting a webhook endpoint turns legitimate burst traffic (e.g. multiple payments in quick succession on a launch day) into retry storms and delivery delays. The threat model for webhooks is authenticity (signature verification) and idempotency (unique `event_id` dedupe at the DB level), not volume.

**Rule:** webhook endpoints rely on signature verification + dual-layer idempotency; they do NOT use Upstash rate-limit.

**Origin:** Slice 4D pre-flight locked decision #2 (2026-04-24). Verified against Slice 4B+4C webhook design: `/api/webhooks/ambassador-stripe` at `44e04bf` uses `webhook_events.event_id` UNIQUE (outer) + `model_listing_payments.stripe_event_id` UNIQUE (inner) — no abuse vector that rate-limiting would close.

#### Pattern 2 — Public-page analytics: client-side POST from browser useEffect

Public ambassador pages use ISR caching (`revalidate = 60` at `app/(public)/[slug]/page.tsx`). Server-side view-tracking on render undercounts because most visits hit the ISR cache, not the server, and adding `Set-Cookie` to an ISR'd response poisons the cache. Industry-standard pattern (Google Analytics, Plausible, Mixpanel, Fathom) is client-side POST after hydration.

**Rule:** analytics for ISR'd public pages fires from the client via `fetch` POST to a single `/api/analytics/track` endpoint. Server handles bot filtering + session dedup + insertion.

**Origin:** Slice 4D pre-flight locked decision #4 (2026-04-24). Supersedes `public_page_final_UI_Spec.md` §2.4 server-side-on-render language (which predated Slice 4A's ISR lock).

#### Pattern 3 — Single multi-event analytics endpoint

One `POST /api/analytics/track` accepts any `event_type` from the `model_analytics_events.event_type` DB CHECK enum. Server validates `event_type` against the enum, inserts with the discriminator. NOT one endpoint per event type.

**Rule:** analytics instrumentation uses one multi-event endpoint, discriminated server-side by `event_type` field against the DB enum.

**Origin:** Slice 4D pre-flight locked decision #5 (2026-04-24). Supersedes `public_page_final_UI_Spec.md` §2.5's two-endpoint (`/api/public/track-click` + implicit view endpoint) design. Single endpoint simplifies client instrumentation + server auth/rate-limit wiring; DB CHECK enum is the single source of truth for valid events.

---

# PHASE 1.6 — FEATURE COMPLETENESS GAP (acknowledged, deferred)

Every editable profile/account field and whether Add/Change/Delete flows are specced.

| Field | Add | Change | Delete | Status |
|---|---|---|---|---|
| Email | Slice 1.5 ✓ | Slice 2 ✓ shipped (d8468d8) | Via delete profile | Complete |
| WhatsApp phone | Slice 1.5 ✓ | Slice 2 ✓ shipped (f6c3201) | Via delete profile | Complete |
| First/last name | Slice 1 ✓ | Slice 1 ✓ | Via delete profile | Complete |
| Slug | Slice 1 ✓ | Slice 1 ✓ | Via delete profile | Complete |
| Tagline | Slice 1 ✓ | Slice 1 ✓ | Not specced | Minor |
| Instagram handle | Slice 1 ✓ | Slice 1 ✓ (assumed) | — | VERIFY |
| Currency | Slice 1 ✓ | LOCKED (intentional) | — | Complete |
| Cover photo | Slice 1 ✓ (upload + reposition) | Slice 1 ✓ (reposition) | Slice 2 ✓ shipped (81d5f1a); Slice 2.5 ✓ reposition UX + shared `<CoverPhoto>` (3ae5ffe); Slice 2.7 ✓ onboarding unified with Settings edit UX (545e485) | Complete |
| Beauty Wishlist toggle | Slice 5 | n/a | n/a | Deferred |

Slice 2 shipped the Change modals for Email + WhatsApp and the Cover photo Remove action (B1 `d8468d8`, B2 `f6c3201`, B3 `81d5f1a`). The previously-listed "Profile photo / avatar" row was a phantom gap from an outdated read of the schema — the ambassador has no round avatar; the round avatar field (`avatar_photo_url`) belongs to `model_professionals` and is built in Slice 3's Add Listing form.

---

# PHASE 1.7 — EMAIL TEMPLATE CATALOG (single source of truth)

Every email the app sends. Reviewed per Principle B.

| # | Trigger | Subject | From | Pipeline | Repo location | Template shape |
|---|---|---|---|---|---|---|
| 1 | Email magic-link sign-in | Your Secure Login Link | WeLoveDecode `<noreply@welovedecode.com>` | Resend direct | `send-magic-link/route.ts` inline HTML | WeLoveDecode wordmark + pink button |
| 2 | Add email confirmation | Add this email to your WeLoveDecode account (flow='add' branch) | WeLoveDecode `<noreply@welovedecode.com>` | Resend direct | `add-email/route.ts` via `renderButtonEmail` helper | WeLoveDecode wordmark + pink button |
| 2b | Change email confirmation | Confirm your new email for WeLoveDecode | WeLoveDecode `<noreply@welovedecode.com>` | Resend direct | `add-email/route.ts` via `renderButtonEmail` (flow='change' branch) | WeLoveDecode wordmark + pink button |
| 3 | Payment receipt (professional) | — | — | Resend via `lib/email-service.ts` | `components/emails/PaymentReceipt.tsx` (React template) | Existing transactional |
| 4 | Payment confirmation (gifter) | — | — | Resend via `lib/email-service.ts` | `components/emails/PaymentConfirmation.tsx` | Existing |
| 5 | Payment failed | — | — | Resend via `lib/email-service.ts` | `components/emails/PaymentFailed.tsx` | Existing |
| 6 | Listing expiring reminder (7d) | TBD | — | Resend | TBD Slice 2/5 | Not yet built |
| 7 | Stripe Dashboard admin alerts | Stripe default | Stripe | Stripe-native | n/a | Admin only |

**Rule:** ALL new email triggers added in future slices MUST be added to this table BEFORE implementation. Any email sent without a matching row here is a violation of Principle B.

---

# PHASE 1.8 — SLICE 2 ARCHITECTURE DECISIONS (Change modals + Cover remove)

Slice 2 closes three gaps deferred from Slice 1.5 Phase C (Principle H — scope discipline): Change Email modal, Change WhatsApp modal, Cover photo Remove action. All wiring mirrors Slice 1.5 patterns (Principle E).

### Q1 — Reuse `email_change_requests` table: **REUSE**
Add Email and Change Email are the same semantic operation ("apply a new email to `auth.users` after user-confirmed link"). Two additive columns:
- `old_email text NULL` — snapshotted at request-creation time so the confirmation page can render Old → New without URL params (per `change_email_confirmation_final_UI_Spec.md` §3). NULL for legacy Add Email rows, populated from Slice 2 onward.
- `flow text NOT NULL DEFAULT 'add' CHECK (flow IN ('add','change'))` — discriminator so the callback can branch its redirect, and so the email subject/body can differ per flow.

### Q2 — Reuse `/model/auth/confirm-email` callback route: **REUSE**
One new branch: after successful `updateUserById` + shadow update, select redirect URL by `flow`:
- `flow='add'` → `/model/settings` (unchanged).
- `flow='change'` → `/model/auth/email-changed?ref={token}` (new).
The `ref={token}` is the already-consumed token, reused as a DB lookup key. The page is a **server component** that requires `consumed_at IS NOT NULL` AND `consumed_at > now() - interval '15 minutes'`. Satisfies UI Spec §3 "server-render, no URL params for emails".

### Q3 — Cross-browser behavior (Principle G): no new work
The opaque-token callback is session-independent by construction. Verified via smoke test (Browser A request, Browser B click).

### Q4 — Routing after email confirmation: **split by flow**
- Add Email "old" is the synthetic `wa_…@auth.internal` (meaningless / would leak internal fixture) → stay at `/model/settings`.
- Change Email has a real "old" that matters → show Old→New cards at `/model/auth/email-changed`.

### Q5 — Change WhatsApp confirmation UI: **self-contained in the modal**
Step 3 of the Change WhatsApp modal shows "WhatsApp changed!" with Old→New cards per `settings.html:247–285`. No separate page needed — modal closes on Done and Settings re-reads from refreshed session/profile.

### Reuse summary (Principle E evidence)
- `/api/ambassador/auth/add-email` — extended, not forked (flow detection via `isInternalEmail(sessionUser.email)`).
- `/model/auth/confirm-email` — extended with one flow-branch redirect.
- `/api/ambassador/auth/send-otp` + `/api/ambassador/auth/add-phone` — reused unchanged (idempotent).
- `email_change_requests` table — extended with two additive columns.
- `renderButtonEmail`, `ProgressTracker`, `CountryPicker`, `OtpInput` — reused unchanged.
- `extractCoverObjectPath` + `storage.from(COVER_BUCKET).remove([…])` pattern — reused for cover remove.

### Migration (Phase B1)
```sql
ALTER TABLE public.email_change_requests
  ADD COLUMN old_email text NULL,
  ADD COLUMN flow text NOT NULL DEFAULT 'add' CHECK (flow IN ('add','change'));
```

### Scope (Principle H)
5 deliverables, ≤1.5 days, 1 Phase A doc commit + 3 Phase B code commits (B1 Email, B2 WhatsApp, B3 Cover).

### Close-out
Slice 2 shipped d8468d8 + f6c3201 + 81d5f1a, verified on Vercel, all Q1–Q5 decisions honored in code.

Slice 2.5 (cover reposition UX + shared `<CoverPhoto>` component) shipped 3ae5ffe: scroll-hijack eliminated via direct-edit pattern (tap camera → edit mode → Drag pill + Upload/Remove/Done), `CoverPhotoActionSheet` (B3) superseded and deleted, `CoverCameraButton` viewBox centering fixed. `/model/setup/page.tsx` cover drag intentionally not migrated — distinct absolute-positioned `<img>` implementation, logged in CLAUDE_CODE_HANDOFF.md hardening backlog.

Slice 2.7 (545e485) removed `mode='onboarding'` from `<CoverPhoto>`; both Settings and `/model/setup` now use the identical `'fixed'`/`'editing'` tap-to-edit pattern. Supersedes `onboarding_register_model_final_UI_Spec.md §5` (fade-on-drag pill). Slice 2.6 (cdab6c1) completed the underlying `/model/setup` migration to the shared component, closing the hardening-backlog item logged after 2.5.

Slice H1 (b1284eb) completed the partial ESLint flat-config migration that was blocking `npm run lint`. Restored `next lint`'s implicit ignores (`.next/`, `tests/e2e/`, `aws-lambda/`, `scripts/`, `node_modules/`), scoped `@typescript-eslint/*` rules to `**/*.{ts,tsx}` so the plugin loads via the `next/typescript` compat block, and downgraded 4 noisy rules to `warn` (`no-explicit-any`, `no-require-imports`, `no-html-link-for-pages`, `react-hooks/rules-of-hooks`) to unblock without hiding genuine issues. Auto-fixed 8 `prefer-const` occurrences across 7 files; inline-disabled two legitimate exceptions (`lib/stripe-client.ts:26` intentional Stripe CDN preload; `app/api/beauty-businesses/create/route.ts:36` mixed-destructure pattern). Logged 2 deferred React Rules-of-Hooks bugs in auction components for a dedicated bug-fix slice. Result: `npm run lint` exit 0 with 2,357 warnings (down from 22,727 problems).

Slice H2 (1dfa086) flipped `model_payouts.model_id` FK from NO ACTION to CASCADE — latent bug fix on an empty table; matches `auction_payouts.model_id` semantics; prevents a broken pointer when `model_profiles` cascade-deletes from a `users` deletion. Full audit via `pg_constraint` revealed 42 FKs in the public schema (1 to `auth.users.id` on `email_change_requests`, 16 to `public.users.id`, 25 intra-schema). `beauty_offers.created_by` + `beauty_purchases.buyer_id` intentionally deferred — both are NOT NULL, so SET NULL requires dropping NOT NULL + a grep audit of downstream code for NULL handling. Logged as a hardening-backlog item.

Slice H3 (8fc50c4 + 925c815) bundled two small hardening fixes. Part 1 (`8fc50c4`) fixed React Rules-of-Hooks violations in `components/auctions/BiddingInterface.tsx` (debug-only `useEffect` + `activeClientSecret` const lifted above the "Bidding is closed" early return) and `components/auctions/VideoUploadCountdown.tsx` (`useVideoUploadTimer` lifted above the null-return early exit); lint warnings 2,357 → 2,355. Part 2 (`925c815`) dropped the duplicate singular `user_bank_account` table — 0 rows, 0 code references, 10-col stub, no inbound FKs, no triggers, no view refs (4 RLS policies cascade-dropped with the table). Canonical `user_bank_accounts` (plural, 18-col, referenced by `model_payouts.bank_account_id`, 17+ code consumers) untouched.

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

## Table 3 — `model_listings` (22 columns)

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
| 20 | expiry_notification_sent_at | timestamptz nullable | — | tracking field for Slice 7 expiring-soon reminder; consumed by `model_listings_live` view |
| 21 | created_at | timestamptz NOT NULL | now() | |
| 22 | updated_at | timestamptz NOT NULL | now() | auto-trigger via `set_updated_at()` |

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

# PHASE 5A — SLICE 1.5 SCHEMA ADDITIONS (LOCKED)

## Overview

Slice 1.5 adds one optional column to `public.users` and cleans up phantom rows created by the Slice 1 synthetic-email bug. No new tables. No changes to `model_*` tables.

## Column addition

```sql
ALTER TABLE public.users
ADD COLUMN signup_method TEXT CHECK (signup_method IN ('whatsapp', 'email'));
```

- **Nullable** — backfilled from existing rows at migration time
- Set at account creation based on which Supabase auth method was used first
- Never updated after creation (even when the second method is added)
- Consumed by Settings Login methods card for dynamic row ordering (decision #21)

## Backfill strategy

For existing ambassadors at migration time:

```sql
UPDATE public.users SET signup_method = 'whatsapp'
WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\';

UPDATE public.users SET signup_method = 'email'
WHERE email NOT LIKE 'wa\_%@auth.internal' ESCAPE '\'
  AND signup_method IS NULL;
```

Order matters — WhatsApp-pattern rows get classified first; remaining rows with real emails get classified as email-primary.

## Phantom user cleanup (one-off migration)

The Slice 1 auth bug created duplicate `auth.users` rows for users who tried both WhatsApp and email sign-in. One-off cleanup migration:

```sql
-- Delete auth users that were created by the synthetic-email pattern
-- but have no corresponding model_profiles (orphans only — preserve real accounts).
DELETE FROM auth.users
WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\'
  AND id NOT IN (SELECT user_id FROM model_profiles);
```

Expected count in current dev DB: 1-5 rows. In production: 0 (launching clean).

## Ongoing phantom guard (`cleanup_phantom_auth_users()`)

Even after Slice 1.5 ships the auth-architecture fix, defensive cleanup is wired in case future regressions or manual data anomalies re-introduce phantom synthetic-email rows. The one-off DELETE above is supplemented by a SECURITY DEFINER function callable by `service_role`:

```sql
CREATE OR REPLACE FUNCTION cleanup_phantom_auth_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\'
      AND id NOT IN (SELECT user_id FROM public.model_profiles)
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_phantom_auth_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_phantom_auth_users() TO service_role;
```

Invocation: scheduled via `pg_cron` (e.g. nightly) OR exposed through a service-role admin endpoint that an operator can hit on demand. Exact wiring TBD during Slice 1.5 implementation; the function itself ships with the schema migration so it's always available.

## No changes to auth.users

The `auth.users` table is Supabase-managed. We do not alter its schema. We use:
- `auth.users.phone` (already exists, TEXT, nullable) — populated on WhatsApp signup
- `auth.users.email` (already exists, TEXT, nullable) — populated on email signup
- `auth.users.phone_confirmed_at` — set by Supabase after OTP verify
- `auth.users.email_confirmed_at` — set by Supabase after magic-link click

Both columns may be NULL at the same time momentarily during signup; exactly one will be populated after first confirmation.

---

# PHASE 6 — URL ARCHITECTURE (LOCKED)

## Final URL list (30 routes)

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

### Auth (8)
- `/model/auth` — Main auth page (WhatsApp-primary per Slice 1.5)
- `/model/auth/email` — Email fallback entry (Slice 1.5 — secondary entry, "No WhatsApp?" link)
- `/model/auth/verify` — WhatsApp OTP verify
- `/model/auth/sent` — Magic link email sent
- `/model/auth/email-changed` — Email change confirmation
- `/model/auth/email-confirmed` — Post-confirm redirect after Add email flow (Slice 1.5)
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

**Slice 1.5 additions:**
- Settings nav card shows `Settings · Email missing` pink hint when `auth.users.email IS NULL` (simple `!user.email` server-side check — no dismissal, no throttling, no login-count logic)
- Hint disappears automatically when email is added (next render has `auth.users.email` populated)
- Reuses existing `navAlertWrap`/`navDot`/`navAlert` CSS from Listings `1 expiring soon` pattern — zero new CSS
- UI spec: `dashboard_settings_hint_final_UI_Spec.md`
- Mockup: `dashboard_settings_hint_final.html`

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
**File:** `settings.html` (existing) + `settings_login_methods_final.html` + `settings_add_modals.html` (Slice 1.5)

- Added `is_published` (bool default true) to `model_profiles`. Toggle OFF → public page returns 404 (reuses 404 template)
- Ambassador can self-delete (REVISES earlier "admin only" decision); 3-step modal already designed
- No profile photo (correctly omitted)
- Copy URL — clipboard
- **Currency LOCKED at signup, displayed with 🔒 icon, no change in Settings**

**Slice 1.5 additions:**
- Contact card renamed to **Login methods** card (HTML comment only; no visible section header — matches the no-header style of all other Settings cards)
- Two rows: WhatsApp + Email. Row order dynamic: signup method first, added method second (per decision #21)
- Empty-state row (method not linked): pink `Add email` / `Add WhatsApp` label with pink chevron → opens new Add modal
- Filled-state row: white value with grey chevron → opens existing Change modal (unchanged behavior)
- **Add email modal:** 2 steps (Enter email → Check your email), calls `supabase.auth.updateUser({ email })`. Subtitle: *"Add an email to recover your account."*
- **Add WhatsApp modal:** 3 steps (Enter number → Enter OTP → WhatsApp added!), calls AUTHKey send/verify then `supabase.auth.updateUser({ phone })`. Subtitle: *"Add WhatsApp for faster access."* Step 3 shows single centered "ADDED" card (not Old→New comparison like Change flow)
- Account card: "Log out" row label → **"Logout"** (single word, one-word-change)
- UI specs: `settings_login_methods_final_UI_Spec.md` + `settings_add_modals_UI_Spec.md`

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
**File:** `auth_page_final.html` (redesigned in Slice 1.5)

- WhatsApp OTP via **AUTHKey** called directly from our edge (Path B — see Slice 1.5 handoff Phase A; Supabase native phone provider blocked by broken dashboard form, so no Send SMS Hook)
- **WhatsApp-primary** per decision #19. Page leads with country picker + phone input + "Continue with WhatsApp" button.
- "No WhatsApp? **Continue with email →**" fallback link at bottom, routes to `/model/auth/email` (see Page 16b)
- Calls `POST /api/ambassador/auth/send-otp` (Turnstile + rate-limit + `otp_verifications` insert + AUTHKey send); verify route then mints session via `auth.admin.createUser({ phone, phone_confirm: true, email: synthetic, email_confirm: true })` + `generateLink`
- **Synthetic `wa_*@auth.internal` email is a session-mint fixture only** — hidden from UI by `isInternalEmail` filter (per decision #20 Path B amendment)
- Single pink accent line below wordmark (animates scaleX 0→1 on mount)
- No status bar chrome (OS renders it), no "Enter your number" pretext
- Emoji flags (renders correctly across all platforms incl. Windows)
- Rate limiting: 3/phone/hour, 10/IP/hour
- Legal footer: Terms → `welovedecode.com/#terms`, Privacy → `welovedecode.com/#privacy`, both open in new tab
- UI spec: `auth_page_final_UI_Spec.md`

## Page 16b — Auth Email Fallback (`/model/auth/email`)
**File:** `auth_email_page_final.html` (Slice 1.5)

- Secondary entry for users without WhatsApp (lost phone, different device, no WhatsApp account)
- Only entry point: "No WhatsApp?" link from `/model/auth`
- Single email input + "Continue with Email" button
- Calls `supabase.auth.signInWithOtp({ email })` for magic-link delivery
- Magic link routes to `/model/auth/sent` (existing Page 18) for "check your email" confirmation
- Fallback link at bottom: `← Use WhatsApp instead` returns to `/model/auth`
- Same wordmark, accent line, legal footer as `/model/auth` — brand consistency
- No password field anywhere (passwordless flow)
- `autocomplete="email"` on input for mobile keyboard suggestions
- UI spec: `auth_email_page_final_UI_Spec.md`

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
| 2 | Cloudflare Turnstile protection | (a) `/model/auth` (OTP + magic link): non-blocking mode — `verifyTurnstile` is called but fail-open on empty token (token-loading bug, deferred). Resend path also relies on rate limits (per-email + per-IP) as the bot-protection floor — **accepted risk** (Slice 1 Phase 1 review, 2026-04-19). (b) `/api/ambassador/model/setup`: NOT IMPLEMENTED — any logged-in user can automate profile creation. | (a) Flip auth routes to blocking verification (resend bypass acceptable). (b) Add client widget + server-side `verifyTurnstile` to the setup route. | Slice 1 |
| 3 | Dashboard week-boundary timezone | UTC (no `users.timezone` column) | Acceptable for v1. Revisit if ambassadors in UTC±8 or beyond report wrong "this week" counts | Slice 1 |
| 4 | iOS 26 Safari browser chrome color | Shows default blue instead of #000001 (themeColor in ambassador layout). Platform-level WebKit bug in iOS 26.0/26.1 affecting all websites using theme-color meta. Code is correct. | Monitor iOS 26.2 release (expected to ship WebKit fix). If not fixed there, accept as platform limitation. | Slice 1 |
| 5 | Orphan `model_professionals` cleanup | Cascade-delete when an ambassador deletes their account intentionally skips `model_professionals` because rows are shared across ambassadors (one row can be referenced by multiple ambassadors' listings/wishes). Orphaned rows with zero remaining references stay in the table indefinitely. | Build a periodic cleanup job that deletes `model_professionals` rows with no remaining references in `model_listings` or `model_wishes` — OR accept as inert garbage and skip. | Slice 1 |
| 6 | ~~Send SMS Hook secret~~ | **OBSOLETE (Slice 1.5 Path B):** Send SMS Hook is no longer used; OTP delivery is AUTHKey-direct from our edge. The `SUPABASE_SEND_SMS_HOOK_SECRET` env var should be removed from Vercel and the Send SMS Hook disabled in the Supabase dashboard. | Confirm env var removed and dashboard hook disabled. | Slice 1.5 |
| 7 | AUTHKey WhatsApp UTILITY template for OTP | Dev environment uses UTILITY template (shared with Slice 0 OTP send) | Confirm Meta-approved template still in good standing at launch; fallback plan documented | Slice 1.5 |
| 8 | FK cascade `auth.users` ↔ `public.users` | Unverified. `public.users` has no FK to `auth.users`, so `DELETE FROM auth.users` does NOT cascade to `public.users` and the row is left orphaned (15+ tables FK to `public.users`, so a stale row keeps domain data alive too). Mirror direction (delete public → auth) also undefined. Discovered during Slice 1.5 Phase A smoke testing while cleaning up failed signup test rows. | Verify required cascade direction(s) and either (a) add explicit FK `public.users.id REFERENCES auth.users(id) ON DELETE CASCADE`, or (b) implement an app-level "Delete profile" route that deletes both rows transactionally. Delete-profile UX relies on this working before launch. | Slice 1.5 |
| 9 | Phone-dedupe scalability in verify-otp | `app/api/ambassador/auth/verify-otp/route.ts` finds the existing `auth.users` row via `admin.listUsers({ page: 1, perPage: 1000 })` and filters client-side by `phone`. Works today (small user base) but silently misses users 1001+ — reintroducing the phantom-row bug that commit `f3e886e` fixed. | Replace `listUsers({ perPage: 1000 })` with a `public.find_auth_user_by_phone(phone text) RETURNS TABLE(id uuid, email text)` SECURITY DEFINER RPC (indexed lookup, O(1)) when user count exceeds 500. | Slice 1.5 |

**Format for new entries:** Item name, current state with reason, what
"resolved" looks like, and which slice added the item. Append only;
don't renumber existing rows when adding new ones.

**When an item is resolved:** Strike through the row (or move to a
"Resolved" subsection below) with the commit hash and date.

---

## Slice 1 polish footnote

Slice 1 polish landed in commits `0bbd3e6`, `4fdb374`, `3c12096`, `4207d3b` — see commit messages for cover-photo upload fixes (unique-path Storage keys + delete-old-cover) and Phase 2 hardening details (dropped dead `Model insert own profile` RLS policy, `crypto.randomInt` for OTP, magic-link route cleanup, shared `maskEmail` + `isValidInstagramHandle` helpers, narrowed file-input `accept` attribute, ProgressTracker `step=4` extraction).

---

# RESUME INSTRUCTIONS (if chat dies)

If you're a fresh chat reading this, the user wants to continue with:

**"Phase B is complete. All 21 pages are audited and locked. Schema is final (9 tables, 135 columns). Now move to Phase C — write the comprehensive Claude Code handoff prompt for actual implementation. Use this DECODE_PROJECT_STATE.md + all final HTML files + UI specs as authoritative source."**

The handoff prompt should be a complete, standalone brief that Claude Code can use to implement the entire feature without needing to ask questions back.
