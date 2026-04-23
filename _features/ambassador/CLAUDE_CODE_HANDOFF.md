# DECODE Ambassador Feature — Claude Code Implementation Brief

**Project:** DECODE (welovedecode.com) — Beauty Ambassador Feature
**Stack:** Next.js (App Router) + Supabase + Stripe Payment Intents + Vercel
**Domain:** `app.welovedecode.com` (apex `welovedecode.com` migrates later)
**Goal:** Implement the entire ambassador feature based on the locked architecture, schema, and 21 design mockups.

---

## ⚠️ READ FIRST — How to use this brief

1. **`DECODE_PROJECT_STATE.md`** is the single source of truth. Read it FULLY before writing code. Every decision is locked there.
2. **`/design/source-html/*_final.html`** files are the visual reference. Strip mockup-only data per Phase 12 #20 in the master doc.
3. **`/design/ui-specs/*_UI_Spec.md`** files document each page's behavior in detail.
4. **`Current_App_Architecture_2026-04-04.docx`** describes the existing app — DO NOT modify it.
5. **`beauty-ambassador-implementation-plan_4.docx`** is OUTDATED — only salvage RLS patterns, atomic claim RPC pattern, and webhook idempotency code.

If anything in this brief contradicts the master doc → **the master doc wins.**

---

## 🛡️ Process guardrails (mandatory, every slice)

These guardrails were added after Slice 1. They exist because Slice 1 saw
real problems — column-name drift, auth rewrites, design drift, mobile
overflow — that all trace back to Claude Code working from interpretation
rather than from ground truth. These five rules prevent that.

**Read this section before every slice. It overrides anything elsewhere
in this document that contradicts it.**

### Guardrail 1 — MCP Supabase connection is step 0

Every slice begins with Claude Code connecting to the Supabase project via
MCP. This is not optional. The handoff doc's schema references are
supplementary; **the live Supabase schema is the source of truth**.

If MCP is not available in the session, Claude Code must stop and flag
this before writing any code that touches the database.

### Guardrail 2 — Verify schema before referencing columns

Before writing any code that references a table (SELECT, INSERT, UPDATE,
DELETE, or FK relationships), Claude Code queries the live schema via MCP
to confirm real column names, types, and nullability.

If the handoff doc and the live schema disagree:
- **Schema wins.**
- Claude Code updates this handoff doc in the same commit, so the doc
  reflects reality going forward.

Slice 1 saw 6+ column-name mismatches (`professional_id`, `model_profile_id`,
`user.id` instead of real names `model_id`, `profile.id`). That was all
preventable by running one schema query first.

### Guardrail 3 — Read mockups in full before building mockup-driven pages

For any page that has a `*_final.html` mockup and/or `*_UI_Spec.md` file,
Claude Code reads BOTH files in full before writing code. No skimming,
no summarizing.

Before writing the first line of code for the page, Claude Code writes a
short confirmation in chat listing:
- What the page does
- Key behaviors from the UI spec (modals, validation, optimistic vs.
  pessimistic writes, error states)
- Any decisions the mockup defers to the spec

User approves the confirmation, then code is written.

Auth pages are NOT from-scratch builds. Per Project State decision #21,
they are thin integration layers that wire existing Supabase auth +
AUTHKey to the new UI.

### Guardrail 4 — Design review checkpoint mid-slice

Each slice has a design review checkpoint after UI pages render correctly
against live data, but BEFORE advanced flows (payments, webhooks,
notifications) are wired.

At the checkpoint:
1. Claude Code lists the pages built so far and deploys them
2. User reviews each page on live URL against the mockup
3. Design drift is fixed before continuing

This catches drift when it's cheap to fix. Slice 1 shipped the design
polish as a post-hoc pass, which worked but cost time. Slice 2+ bakes
the checkpoint in.

### Guardrail 5 — Global layout is set once, at route group start

Global layout constraints for a route group (max-width, overflow,
theme-color, viewport, safe-center alignment) are set in the route
group's top-level layout (`app/(ambassador)/layout.tsx`) at the start
of the first slice that touches that group. Not as a polish pass.

For the ambassador route group, these are now set:
- `max-width: 420px` (phone-frame pattern)
- `align-items: safe center` (prevents top-clipping on long forms)
- `overflow-x: hidden` (scoped to ambassador wrapper, not globals.css)
- `theme-color: #000000` (black mobile browser chrome)
- Viewport meta hardening (no user scaling)

Any future route group Claude Code creates (e.g., `app/(admin)/`) must
set its own global layout on day one.

### Guardrail 6 — Cross-browser/cross-device smoke test required for all link-based flows

For any feature involving email links or magic-link-style confirmations, the verify checklist MUST include a test where the request is made in Browser A (incognito or mobile) and the link is clicked in Browser B (desktop or different session). Same-browser tests alone are insufficient.

Added after Slice 1.5 Add Email cross-browser bug. Paired with Principle G in DECODE_PROJECT_STATE.md.

### Guardrail 7 — Audit existing code pattern before building similar feature

Before Claude Code writes a new feature that involves email delivery, auth flows, or any pattern that likely has prior art in the codebase, Claude Code MUST grep for the 2-3 closest existing implementations and report them in the plan. The plan must either (a) match the pattern, or (b) explicitly justify the architectural divergence. No silent new architectures.

Added after Slice 1.5 Phase C built a second email pipeline instead of reusing the one already in `send-magic-link/route.ts`. Paired with Principle E.

### Guardrail 8 — Stop on bug recurrence within the same slice

If a bug surfaces whose root cause matches a root cause fixed earlier in the SAME slice, stop. Do not patch the symptom. Revisit the architectural decision that caused both bugs.

Added after Slice 1.5 Phase C phantom-row regression was a repeat of the Phase A phantom-row bug.

### Guardrail 9 — RLS policy must ship with every `ENABLE ROW LEVEL SECURITY`

If a migration sets `ENABLE ROW LEVEL SECURITY` on a new table, at least one explicit policy must land in the same migration — even if the posture is service-role-only. "RLS enabled + zero policies" is functionally default-deny but reads as incomplete to any future `pg_policies` auditor, and makes cross-table posture comparisons ambiguous. For service-role-only tables, ship the explicit `Service role full access` policy mirroring the `otp_verifications` shape. Do not add a self-read policy until a self-read caller exists (Principle E applied to RLS).

Added after Slice 2 code review surfaced that `email_change_requests` (created in Slice 1.5) had `ENABLE ROW LEVEL SECURITY` with zero policies. Functionally safe throughout — all callsites used service-role — but caught during review and backfilled in Slice 2 closeout.

### Guardrail 10 — Principle I check (generic UI primitives)

**Principle I check — generic UI primitives:** For every user-visible primitive this slice touches (toasts, modals, buttons, inputs, loading states, transitions, skeletons), report whether a canonical implementation exists in the codebase. If yes, the slice reuses it. If no, the slice proposes a canonical implementation + shared location + adds a retrofit item to the hardening backlog for any divergent existing instances. Report this BEFORE any code is written.

Added after Slice 3A toast-animation divergence: seven existing ambassador toasts had no entrance animation; the Listings spec prescribed one; shipping it only on Listings created the exact per-page invention pattern Principle I forbids. Pairs with Principle I in DECODE_PROJECT_STATE.md.

### Pre-launch checklist

Temporary dev/testing values that must be reset before launch are
tracked in **DECODE_PROJECT_STATE.md** (the single source of truth for
locked decisions and commitments). Do not duplicate the list here.

Before any slice's "launch readiness" verification, open Project State's
Pre-launch checklist and confirm every entry is resolved.

---

## 🎯 Implementation order — vertical slices (build in this sequence)

**Principle:** Build ONE complete feature end-to-end, verify it works, then build the next. Each slice is independently testable and shippable. Do NOT move to the next slice until the current one passes all verification steps.

This is called "vertical slice development" or "walking skeleton" — industry standard used by Shopify, Stripe, Spotify, YC startups. It's the opposite of "build all the schema first, then all the auth, then all the UI."

---

### 🧱 Slice 0 — Foundation (one-time setup, no UI)

Schema and infrastructure must exist before anything else because FKs interlock (you can't build listings without profiles, etc.). This is the only "horizontal" step.

1. **Database migrations** — Run all 9 SQL CREATE TABLE statements (see Stage 1.1 below)
2. **DB views** — Create `model_wishes_live` and `model_listings_live` (see Stage 1.2 below)
3. **Seed data** — Insert 26 categories into `model_categories`
4. **RLS policies** — Apply per-table
5. **Storage bucket** — Create `model-media` bucket with RLS (public SELECT, authenticated INSERT/UPDATE/DELETE with `auth.uid()` path)
6. **Route groups** — Set up `app/(ambassador)/` and `app/(legacy)/` structure
7. **Stripe webhook endpoint** — `/api/webhooks/ambassador-stripe` (empty stub initially). After deploying, register this URL in Stripe Dashboard and get the signing secret → `STRIPE_AMBASSADOR_WEBHOOK_SECRET`
8. **Cloudflare Turnstile** — Create site, add env vars `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
9. **Upstash Redis** (rate limiting backend) — Sign up at upstash.com (free tier: 10K req/day), create Redis DB, add env vars `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Install `@upstash/ratelimit` npm package. Required because serverless functions on Vercel have no shared memory — without Redis, rate limiting doesn't actually work.
10. **Resend email service** — Sign up at resend.com (free tier: 3,000/month), verify `welovedecode.com` domain (DNS records), create API key → env var `RESEND_API_KEY`. Install `resend` npm package.
11. **Stripe Dashboard admin emails** — Enable in Stripe Dashboard → Settings → Emails → toggle on "Business notifications" for payment succeeded + refunds. No code needed, just a toggle.
12. **Atomic wish claim RPC** — Deploy `claim_wish_for_payment()` + `revert_expired_wish_locks()` functions

**✅ VERIFY before next slice:**
- [ ] All 9 tables exist, can query them via Supabase SQL editor
- [ ] 26 categories seeded
- [ ] Both views return results (even if empty)
- [ ] RLS active — try to read another user's data fails
- [ ] `model-media` bucket exists, can upload a test file via Supabase Studio
- [ ] `(ambassador)` and `(legacy)` folders exist in `app/`
- [ ] Webhook endpoint returns 200 on test POST

---

### 👤 Slice 1 — Ambassador onboarding flow

**Goal:** An ambassador can sign up, log in, complete their profile, and see an empty dashboard.

**Scope (pages to build):**
- `/model/auth` — Main auth page (WhatsApp + email)
- `/model/auth/verify` — WhatsApp OTP verify
- `/model/auth/sent` — Magic link sent confirmation
- `/model/auth/email-changed` — Email change confirmation
- `/model/auth/email-error` — Email error page
- `/model/setup` — Onboarding form (creates `model_profiles` row)
- `/model` — Dashboard (EMPTY STATE ONLY — no listing/wish cards yet)
- `/model/settings` — Settings page (basic fields, no advanced features)

**API routes:**
- `/api/model/setup` — POST to create profile + check slug uniqueness
- `/api/model/settings` — PATCH for updating profile fields
- `/api/auth/send-otp` — POST (Turnstile-verified, rate-limited) to trigger AUTHKey WhatsApp OTP
- `/api/auth/send-magic-link` — POST (Turnstile-verified, rate-limited) to trigger Supabase magic link email

**Bot protection:**
- Cloudflare Turnstile on `/model/auth` page (invisible CAPTCHA) — prevents bots from spamming OTP/magic-link endpoints and draining AUTHKey credits
- Rate limit: max 3 OTP per phone per hour; max 10 OTP per IP per hour

**Out of scope (will be added in later slices):**
- Listing/wish sections on dashboard (placeholder empty state only)
- Analytics alerts on dashboard
- "Beauty Wishlist" toggle in settings (comes with Slice 5)

**✅ VERIFY before next slice:**
- [ ] Sign up with WhatsApp OTP → receives code → verifies → enters setup
- [ ] Sign up with email → receives magic link → clicks → enters setup
- [ ] Setup form creates `model_profiles` row with correct data
- [ ] Slug collision detection works (try `sara` twice)
- [ ] Dashboard shows empty state "No listings yet"
- [ ] Settings: update tagline, toggle is_published → DB updates
- [ ] Log out, log back in → sees dashboard
- [ ] Second ambassador can sign up (no data collision)

---

### 🔧 Slice 1.5 — Auth architecture fix (WhatsApp-primary)

**Context:** Slice 1 shipped with a synthetic-email pattern (`wa_{sha256(phone).slice(0,12)}@auth.internal`) that mis-used `supabase.auth.admin.generateLink({type:'magiclink'})`. `generateLink` auto-creates a new `auth.users` row when none matches the email — producing TWO auth users per human (one keyed to real email, one keyed to synthetic). This slice replaces that pattern with Supabase's native multi-identity model and adds UX for users to manage both login methods from Settings.

**Reference:** See `DECODE_PROJECT_STATE.md` decisions #19 (WhatsApp-primary), #20 (one auth.users row per human), #21 (signup method row order). Decision #11 is SUPERSEDED.

**Goal:** Existing user who signs in via WhatsApp lands on `/model`, not `/model/setup`. New WhatsApp users still land on `/model/setup`. Users without WhatsApp can use email fallback. Users in Settings can add the method they don't have. Dashboard shows "Email missing" hint until email is added.

---

#### 🎯 Scope

**Auth backend (Phase A — Path B, admin-API hybrid):**
- Keep AUTHKey-direct OTP flow on our edge (Turnstile + rate limiters + `otp_verifications` storage), restoring `app/api/ambassador/auth/send-otp/route.ts` and `app/api/ambassador/auth/verify-otp/route.ts` to their pre-flip shape.
- Phone-first dedupe via `auth.users.phone` (populated natively going forward). When the verify-otp route mints a session, new users are created with `auth.admin.createUser({ phone, phone_confirm: true, email: phoneToInternalEmail(phone), email_confirm: true, ... })` — phone column is the identity, the synthetic `wa_*@auth.internal` email is a session-mint fixture only (never surfaced in UI; `isInternalEmail` filter on settings page hides it).
- Sessions minted via `auth.admin.generateLink({ type: 'magiclink', email: synthetic })` → client calls `verifyOtp({ token_hash, type: 'email' })`.
- **No Supabase Send SMS Hook, no `signInWithOtp({ phone })`.** Path A (native phone provider) was attempted in commit `0bb0b42` and reverted because the Supabase dashboard's Phone provider configuration form does not accept input in Firefox or Chrome — provider cannot be enabled.

**UI — new screens (Phase B):**
- `/model/auth` — redesigned WhatsApp-primary (existing route, new design)
- `/model/auth/email` — NEW email fallback page (Supabase magic link)

**UI — Settings (Phase C):**
- Rename existing "Contact" card to **Login methods** card (HTML comment only — no visible header)
- Empty-state row design ("Add email" / "Add WhatsApp" in pink when method not linked)
- Add email modal (2 steps) — uses `supabase.auth.updateUser({ email })`
- Add WhatsApp modal (3 steps) — uses AUTHKey + `supabase.auth.updateUser({ phone })`
- Dynamic row order based on `public.users.signup_method`
- "Log out" → "Logout" copy change on Account card row label only

**UI — Dashboard (Phase D):**
- Settings nav card shows `Settings · Email missing` pink hint when `auth.users.email IS NULL`
- Reuses existing `navAlertWrap` / `navDot` / `navAlert` pattern from Listings card — zero new CSS

**Schema (Phase E):**
- Add `public.users.signup_method TEXT CHECK (signup_method IN ('whatsapp', 'email'))`, nullable
- Backfill existing rows: WhatsApp-pattern → 'whatsapp', rest → 'email'
- Delete phantom auth.users rows with synthetic emails that have no corresponding `model_profiles`
- Ship `cleanup_phantom_auth_users()` SECURITY DEFINER function as ongoing guard (see PHASE 5A in state doc)

**Out of scope (explicitly):**
- Passkeys / Face ID — deferred to future sprint (Supabase doesn't natively support passkeys as of 2026-04; needs SimpleWebAuthn or external provider)
- Setup page email field — NOT ADDED. Signup stays WhatsApp-only (maximum low-friction conversion per product decision)
- Changing any existing Change email / Change WhatsApp modals — those stay exactly as they are
- Any `model_*` table modifications

---

#### 🛡️ Re-assert process guardrails

All 5 process guardrails from the top of this file apply to Slice 1.5 in full. Specifically:

- **Guardrail 1 (MCP Supabase step 0):** Before writing any SQL migration, verify current schema via MCP. Confirm `auth.users.phone` exists as a column and is populated for test users. Confirm `public.users.signup_method` does NOT exist before adding it.
- **Guardrail 2 (verify schema before referencing):** The `auth.users.phone_confirmed_at` column is Supabase-managed — do not write migrations that add or alter columns in the `auth` schema. Any column named in this slice must first be verified in MCP.
- **Guardrail 3 (read mockups in full):** All 5 Slice 1.5 HTML mockups MUST be read top-to-bottom BEFORE writing any code for their corresponding pages. Implementation is line-by-line translation of the mockup into production code — no interpretation, no "improvements."
- **Guardrail 4 (mid-slice design review):** After Phase B (auth pages) is built and before proceeding to Phase C (Settings), run a design review session with the user comparing live site to the mockups. Catch drift early.
- **Guardrail 5 (global layout set once):** The `(ambassador)` route group layout is already in place from Slice 1. Do not add layout logic to individual pages. Auth pages already use the correct layout — don't re-wire.

---

#### 📦 Design files (READ THESE FIRST)

All 10 files live alongside other Slice mockups (same folder as `auth_page_final.html` from Slice 1).

| # | Mockup | UI Spec |
|---|---|---|
| 1 | `auth_page_final.html` | `auth_page_final_UI_Spec.md` |
| 2 | `auth_email_page_final.html` | `auth_email_page_final_UI_Spec.md` |
| 3 | `settings_login_methods_final.html` | `settings_login_methods_final_UI_Spec.md` |
| 4 | `settings_add_modals.html` | `settings_add_modals_UI_Spec.md` |
| 5 | `dashboard_settings_hint_final.html` | `dashboard_settings_hint_final_UI_Spec.md` |

For each page Claude Code builds, open the mockup + spec together, follow spec instructions verbatim, confirm visual match against mockup.

---

#### 🚀 Execution phases

Execute phases in order. Do not skip ahead. Mid-slice design review happens at the boundary between Phase B and Phase C per Guardrail 4.

##### Phase A — Auth backend (AUTHKey-direct + admin-API hybrid)

**Goal:** Phone is the authoritative identity; one `auth.users` row per human. AUTHKey delivers OTP, our edge owns OTP storage and verification, the Supabase Admin API mints the session.

**Background:** Path A (Supabase native `signInWithOtp({ phone })` + Send SMS Hook → AUTHKey) was implemented in commit `0bb0b42` and reverted because the Supabase dashboard's Phone provider configuration form will not accept input in Firefox or Chrome — provider cannot be enabled. Re-implementation below uses `auth.admin.createUser({ phone, ... })` instead, which does not require the Phone provider to be enabled.

**Prerequisites:** None beyond AUTHKey credentials. The Supabase Phone provider stays **disabled**. There is no Send SMS Hook.

1. **`POST /api/ambassador/auth/send-otp`** (AUTHKey-direct)
   - Turnstile verify (non-blocking) → phone + IP rate limiters → `crypto.randomInt(100000, 1000000)` → insert into `otp_verifications` (10-minute expiry) → `authkeyWhatsAppService.sendOTP(phone, code)`.
   - All chokepoints stay on our edge.

2. **`POST /api/ambassador/auth/verify-otp`** (admin-API session mint)
   - Validate against `otp_verifications`: brute-force lock check (5 attempts → 1 hour lock), expiry check, used-flag check, code match → mark used.
   - Compute `internalEmail = phoneToInternalEmail(phone)` (deterministic `wa_{sha256(phone).slice(0,12)}@auth.internal`).
   - Try `auth.admin.generateLink({ type: 'magiclink', email: internalEmail })` first — succeeds for existing users (deterministic email = same row), returns `hashed_token`.
   - On miss, `auth.admin.createUser({ phone: e164, phone_confirm: true, email: internalEmail, email_confirm: true, user_metadata: { phone_number, auth_method: 'whatsapp_otp', phone_verified: true } })` — populates `auth.users.phone` natively AND the synthetic email — then `generateLink` again.
   - Look up `model_profiles` for the user.id; return `{ success, hashed_token, hasProfile }`.

3. **`/model/auth/verify` page**
   - POST `{ phoneNumber, otpCode }` to `/api/ambassador/auth/verify-otp`.
   - On success, `supabase.auth.verifyOtp({ token_hash, type: 'email' })` → `refreshSession` → branch on `hasProfile`: true → `/model`, false → `/model/setup`.

4. **Keep, don't delete**
   - `lib/ambassador/auth.ts` exports `phoneToInternalEmail` (session-mint fixture) and `isInternalEmail` (UI safety filter — synthetic emails must never surface in settings).
   - `isInternalEmail` filter stays in `app/(ambassador)/model/settings/page.tsx` so users only see their real (post-Add-email) email, never the synthetic.

**✅ Verify before Phase B:**
- [x] Existing WhatsApp user signs in via phone → lands on `/model` (NOT `/model/setup`).
- [x] New WhatsApp user signs in via phone → lands on `/model/setup`; resulting `auth.users` row has `phone` populated and `email` matches `wa_*@auth.internal`.
- [x] `auth.users` shows ONE row per test user, not two. (`cleanup_phantom_auth_users()` extended to also catch the legacy `@whatsapp.decode.local` pattern.)
- [x] Settings page does NOT display the synthetic `@auth.internal` email anywhere.
- [x] AUTHKey receives the exact OTP our edge generated (log verification).

##### Phase B — Auth pages UI

**Goal:** Build `/model/auth` (redesigned) and `/model/auth/email` (new) per mockups.

1. **Implement `/model/auth`**
   - Use `auth_page_final.html` as source of truth
   - Follow `auth_page_final_UI_Spec.md` for behavior
   - Reuse existing country picker / phone formatter / toast components — the mockup's inline code is a reference, production uses the extracted shared modules
   - Legal footer links go to marketing site (see spec)
   - "No WhatsApp?" link uses `<Link href="/model/auth/email">`

2. **Implement `/model/auth/email`** (new route)
   - Use `auth_email_page_final.html` as source of truth
   - Follow `auth_email_page_final_UI_Spec.md` for behavior
   - Magic-link send via `supabase.auth.signInWithOtp({ email })` — Supabase handles delivery
   - Post-send route to existing `/model/auth/sent` page (Page 18, no changes needed)
   - "Use WhatsApp instead" link uses `<Link href="/model/auth">`

3. **Design review checkpoint** (Guardrail 4)
   - Deploy Phases A + B to dev
   - User walks through: WhatsApp signup, WhatsApp sign-in (existing user), email fallback signup, email fallback sign-in
   - Fix any drift before Phase C

**✅ Verify before Phase C:**
- [x] `/model/auth` matches mockup pixel-close (spacing, colors, animations)
- [x] Country picker opens and scrolls correctly
- [x] Phone formatter applies masks live
- [x] "No WhatsApp?" link navigates to email page
- [x] `/model/auth/email` matches mockup
- [x] Email submit sends magic link, routes to `/model/auth/sent`
- [x] "Use WhatsApp instead" returns to `/model/auth`
- [x] Both pages work on iOS Safari, Chrome Android, desktop Chrome

##### Phase C — Settings Login methods card + Add modals

**Goal:** Wire up the redesigned Settings card + two new Add modals.

1. **Update existing Settings page**
   - Find the "Contact" card section in `/model/settings` component
   - Rename HTML comment from `<!-- Contact -->` to `<!-- Login methods -->`
   - No visible UI text says "Login methods" anywhere

2. **Implement row rendering logic**
   - Read `auth.users.email`, `auth.users.phone`, `public.users.signup_method` in server component
   - Determine row order: if `signup_method === 'whatsapp'` → `[whatsapp, email]`; else → `[email, whatsapp]`
   - For each row: if column populated, render filled state (current design); if null, render empty state (pink "Add email" / "Add WhatsApp")

3. **Wire tap handlers**
   - Filled row tap → opens existing Change modal (unchanged)
   - Empty row tap → opens new Add modal

4. **Implement Add email modal**
   - Use `settings_add_modals.html` for visual spec (Add email section, 2 steps)
   - Follow `settings_add_modals_UI_Spec.md` §4
   - Submit calls `supabase.auth.updateUser({ email })`
   - Step 2 tracker, reassurance block, resend link match existing Change email modal patterns
   - Confirmation happens out-of-band when user clicks link in email → `/model/auth/email-confirmed`

5. **Implement Add WhatsApp modal**
   - Use `settings_add_modals.html` for visual spec (Add WhatsApp section, 3 steps)
   - Follow `settings_add_modals_UI_Spec.md` §5
   - Step 1: country picker (reuse shared component), AUTHKey send on submit
   - Step 2: OTP cells (reuse shared component), AUTHKey verify on 6th digit
   - On successful verify (BEFORE Step 3): call `supabase.auth.updateUser({ phone })`
   - Step 3: single centered "ADDED" card (NOT Old→New like Change flow — this is a first-time add)

6. **Logout copy change**
   - In the Account card, change row label from "Log out" to "Logout" (one-word)
   - Do NOT change toast messages, button labels, or code comments

**✅ Verify before Phase D:**
- [x] WhatsApp-primary user sees: WhatsApp row (filled) + Email row (pink "Add email")
- [x] Email-primary user sees: Email row (filled) + WhatsApp row (pink "Add WhatsApp")
- [x] Dual-linked user sees: both rows filled, order matches signup_method
- [x] Add email modal: enter email → send → shows Step 2 with tracker + resend
- [x] Clicking magic link in email populates `auth.users.email` and next settings render shows filled row
- [x] Add WhatsApp modal: enter number → send → OTP cells → verify → Step 3 with single "ADDED" card
- [x] After Add WhatsApp, next settings render shows filled row
- [x] Logout row label shows "Logout" (no space)
- [x] Existing Change modals still work (don't regress)

##### Phase D — Dashboard Settings hint

**Goal:** Show "Email missing" hint on Settings nav card when user has no email.

1. **Update `/model` dashboard component**
   - Server component already reads user via `supabase.auth.getUser()`
   - Compute `const showEmailHint = !user?.email`
   - Pass to nav card render

2. **Conditional render in Settings nav card**
   - If `showEmailHint === true`:
     - Render `<div class="navAlertWrap"><span class="navLabel">Settings</span><span class="navDot"></span><span class="navAlert">Email missing</span></div>`
   - Else:
     - Render `<span class="navLabel">Settings</span>` (current behavior)
   - Reuse existing CSS classes — do NOT create new ones

**✅ Verify before Phase E:**
- [x] User with email → Settings nav card shows plain "Settings" (no hint)
- [x] User without email → Settings nav card shows "Settings · Email missing" with pink text
- [x] Tap on card (either state) navigates to `/model/settings`
- [x] After Add email flow completes, next dashboard visit shows no hint (hint self-dismisses)
- [x] Pink hint color matches Listings "1 expiring soon" hint exactly (same `#e91e8c`)

##### Phase E — Schema migration + phantom cleanup

**Goal:** Add `signup_method` column, backfill, clean up phantom auth users, ship ongoing guard.

1. **Add column migration**
   ```sql
   -- {timestamp}_add_signup_method.sql
   ALTER TABLE public.users
   ADD COLUMN signup_method TEXT CHECK (signup_method IN ('whatsapp', 'email'));
   ```

2. **Backfill migration**
   ```sql
   -- {timestamp}_backfill_signup_method.sql
   UPDATE public.users SET signup_method = 'whatsapp'
   WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\';

   UPDATE public.users SET signup_method = 'email'
   WHERE signup_method IS NULL;
   ```

3. **Phantom cleanup migration** (RUN ONLY AFTER Phase A deployed successfully)
   ```sql
   -- {timestamp}_delete_phantom_auth_users.sql
   DELETE FROM auth.users
   WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\'
     AND id NOT IN (SELECT user_id FROM model_profiles);
   ```

4. **Ongoing-guard function migration** (ships with the cleanup above so it's always available)
   - Create `cleanup_phantom_auth_users()` SECURITY DEFINER function (full SQL in PHASE 5A of state doc)
   - `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role`
   - Wire invocation: choose ONE of (a) `pg_cron` nightly job, or (b) service-role admin endpoint that an operator can hit on demand. Document choice in commit message.

5. **Set signup_method for new accounts**
   - In the sign-up completion code (wherever `model_profiles` is first created), write `signup_method` based on which of `auth.users.phone` / `auth.users.email` was populated first
   - Simplest: if `auth.users.phone IS NOT NULL` at profile-create time → `'whatsapp'`; else → `'email'`

**✅ Verify before closing Slice 1.5:**
- [x] `public.users.signup_method` column exists with CHECK constraint
- [x] All existing users have a non-null `signup_method` value
- [x] No `auth.users` row has email matching `wa_%@auth.internal` pattern
- [x] `cleanup_phantom_auth_users()` function exists, EXECUTE granted to `service_role` only
- [x] Invocation mechanism (pg_cron or admin endpoint) is wired and documented
- [x] New WhatsApp signup → `public.users.signup_method = 'whatsapp'` on profile create
- [x] New email signup → `public.users.signup_method = 'email'` on profile create
- [x] Pre-launch checklist updated with Slice 1.5 items #6 and #7

---

#### ✅ Final Slice 1.5 VERIFY checklist (all phases) — SHIPPED ✓ (2026-04-20)

Full end-to-end user-journey tests:

- [x] **Fresh WhatsApp signup:** new user → phone OTP → lands on `/model/setup` → completes → sees dashboard with "Email missing" hint
- [x] **Fresh email signup:** new user via fallback link → magic link → clicks → lands on `/model/setup` → completes → sees dashboard without hint
- [x] **Returning WhatsApp user:** existing user → phone OTP → lands on `/model` (NOT setup) — **the original bug is fixed**
- [x] **Cross-method sign-in:** WhatsApp user clicks email fallback, signs in via email → lands on `/model` (same auth.users row, no duplicate created)
- [x] **Add email from Settings:** WhatsApp-primary user → Settings → Login methods card → Email row "Add email" → modal → submit → clicks link in inbox → next Settings render shows filled email row → dashboard hint disappears
- [x] **Add WhatsApp from Settings:** email-primary user → Settings → Login methods card → WhatsApp row "Add WhatsApp" → modal → OTP → Step 3 "ADDED" card → Done → next Settings render shows filled WhatsApp row
- [x] **Row order honors signup method:** WhatsApp-primary user sees WhatsApp row first; email-primary user sees Email row first
- [x] **No phantom users:** after all testing, `auth.users` contains ONE row per test user
- [x] **No regressions:** existing Change email, Change WhatsApp, Change slug, delete profile flows still work

Slice 1.5 closed on 2026-04-20 — all items pass.

---

### 🧩 Slice 2 — Completeness gap + Settings Change modals

**Goal:** Close the feature gap surfaced in Slice 1.5 Phase C. User can change profile photo, delete profile photo, delete cover photo, change email, and change WhatsApp — all via Settings. Filled rows in the Login methods card open Change modals instead of the "coming soon" toast.

**Scope:**
- Profile photo Change modal + Delete action (unblocks PHASE 1.6 item)
- Cover photo Delete action (Change / reposition already exists from Slice 1)
- Change Email modal (2-step, reuses Add Email opaque-token pattern from Slice 1.5 — `email_change_requests` table, direct Resend, cross-browser safe per Principle C)
- Change WhatsApp modal (3-step, reuses Add WhatsApp AUTHKey OTP pattern from Slice 1.5)
- Wire filled rows in Settings Login methods card to these Change modals (replaces "coming soon" toast)

**Out of scope:**
- Anything listings or payments related (deferred to Slice 3/4)
- Change modals for name/slug/tagline/Instagram (already complete per PHASE 1.6)
- Currency change (LOCKED)

**Architecture preconditions:** All new email triggers in Slice 2 MUST follow Principles B–C (see PHASE 1.5 in DECODE_PROJECT_STATE.md). Specifically: (1) delivery via direct Resend, never Supabase Auth; (2) templates in repo; (3) any confirmation URL uses opaque tokens if cross-browser click is possible. Any new email trigger must be added to PHASE 1.7 Email Template Catalog BEFORE implementation.

**✅ VERIFY before next slice:**
- [ ] Profile photo Change modal opens from Settings → upload new photo → replaces existing avatar (storage + DB) — **N/A — ambassador has no round avatar; the `avatar_photo_url` field belongs to `model_professionals` and is built in Slice 3's Add Listing form.**
- [ ] Profile photo Delete action removes avatar → empty state fallback renders — **N/A — same reason as above.**
- [x] Cover photo Delete action removes cover → empty state fallback renders — **shipped B3 (81d5f1a)**
- [x] Change Email (same-browser): filled Email row opens modal → confirmation email lands → click in same browser → email updated in `auth.users` + `public.users`; old email no longer grants login — **shipped B1 (d8468d8)**
- [x] Change Email (cross-browser, Guardrail 6): request in Browser A, click confirmation link in Browser B → email still updated (opaque-token pattern holds across browsers) — **shipped B1 (d8468d8)**
- [x] Change WhatsApp: filled WhatsApp row opens modal → new number → OTP arrives → code verified → `auth.users.phone` updated; old phone no longer signs in — **shipped B2 (f6c3201)**
- [x] Settings Login methods card: filled rows open Change modals (no more "coming soon" toast) — **shipped B1 + B2**
- [ ] PHASE 1.6 updated: Profile photo row moves from BLOCKER to complete — **N/A — row removed in Slice 2 closeout. It was a phantom gap; ambassador has no round avatar.**

**Slice 2 shipped:**
- `d8468d8` — B1 Change Email end-to-end
- `f6c3201` — B2 Change WhatsApp end-to-end
- `81d5f1a` — B3 Cover photo action sheet + remove
- `3ae5ffe` — Slice 2.5 Cover photo reposition UX + shared `<CoverPhoto>` component (supersedes B3 action sheet)
  - Note: Case 5 (upload from edit mode stays in edit mode) initially reported failed during first test pass; passed on re-test without code changes. Possible transient issue, no code fix needed. If regression recurs, reproduce with console logs before attempting fix.
- `545e485` — Slice 2.7 Onboarding cover UX unified with Settings (`mode='onboarding'` removed, both consumers now use fixed/editing)
- `b1284eb` — Slice H1 ESLint v9 flat-config migration (unblocks `npm run lint`; deferred bugs logged below)
- `1dfa086` — Slice H2 `model_payouts` FK CASCADE fix (latent bug; `beauty_*` deferred)
- `8fc50c4` — Slice H3 Part 1 auction Rules-of-Hooks fixes (`BiddingInterface` + `VideoUploadCountdown`)
- `925c815` — Slice H3 Part 2 drop duplicate `user_bank_account` (singular) table

**Superseded specs:** `onboarding_register_model_final_UI_Spec.md §5` (fade-on-drag pill) superseded by Slice 2.7 decision — both cover consumers now use identical tap-to-edit chrome.

**Out-of-band commits landed between slice phases (not part of Slice 2 scope but in the working branch):**
- `a3660c3` — iOS Safari safe-area insets on route-group wrapper (partial safe-area fix).
- `2cd9145` — AmbSubmitButton extraction with send/verify/save/delete families; auth + settings rewiring.
- `156fca1` — Change Email confirmation: stack old/new cards on mobile to prevent overflow (follow-up to B1).

### Post-Slice 2 hardening candidates (consolidate into one focused slice, separate from Slice 3 feature work)

1. **WhatsApp OTP delivery to +49 (German) numbers** — investigate AUTHKey dashboard: check template approvals for DE, check delivery logs for failed messages. Not code; 15-min dashboard task. User to handle directly, no Claude Code involvement.
2. **Local dev setup — `.env.local`** — developer needs to create `.env.local` at repo root with 9 required env vars (Supabase URL + anon + service role keys, Stripe secret + publishable + webhook keys, app URL). Copy values from Vercel → Settings → Environment Variables. Without this, `npm run dev` won't work locally and `npm run test:env` (part of `npm run validate`) fails. One-time setup per developer machine. Not a code issue. File is gitignored (`.gitignore:34` — `.env*` pattern).
3. **BLOCKED: FK cascade — `beauty_*` tables** (deferred from Slice H2):
   - Blocked by: account-deletion flow not yet resolved (see item 4). Both items turn on the same product question — is account deletion hard-delete, soft-delete, or partial-preserve? — and that answer determines whether `SET NULL` vs `CASCADE` is the right policy here.
   - `beauty_offers.created_by` and `beauty_purchases.buyer_id` both NOT NULL with FK to `public.users(id)`, currently NO ACTION.
   - Blocks user deletion when user has real marketplace data (18 offers + 2 purchases in production as of H2).
   - `SET NULL` (preferred policy to preserve marketplace history) requires: (a) `DROP NOT NULL` on both columns, (b) grep audit of all code paths reading these columns to ensure NULL-safe handling.
   - Dedicated slice needed. Product decision: `SET NULL` preserves history; `CASCADE` destroys it. Decision deferred until user-deletion flow is actually built.
   - **Same structural pattern: `model_professionals.created_by` is NOT NULL + FK to `users(id)` with NO ACTION.** Surfaced during Slice 3 pre-flight. Bundle into same fix pass when item 4 unblocks.
4. **BLOCKED: Account-deletion flow — `admin.deleteUser()` not called** — blocked by: product decision on soft-delete vs hard-delete semantics (same upstream as item 3). The app's DELETE endpoint (`app/api/ambassador/model/settings/route.ts:254`) wipes model-side tables via `delete_model_profile_cascade` RPC, then `auth.signOut()`, but never calls `admin.deleteUser()`. Result: `auth.users` rows persist forever, `public.users` row persists forever. Either intentional soft-delete or a bug. Product decision needed.
5. ~~**Re-upgrade `react-hooks/rules-of-hooks` from `warn` to `error`** in `eslint.config.mjs:46`. Gated on: next hook-violation cleanup pass (no known violations remain post-H3, so this is safe to do once any new ones are cleared). Rule was downgraded in H1 (b1284eb) to unblock `npm run lint` with two known auction-side violations; those were fixed in H3 (8fc50c4). Re-upgrading now would make the repo exit-0 today but catch any future regression at CI rather than review.~~ **CLOSED by `1ceaa28` (Slice 3A opening).** Pre-flight verified zero violations; rule flipped to `error`; `npm run lint` still exit 0.
6. **Retrofit toast slide-up/fade animation to all ambassador toasts.** Currently 7 pop-in toasts across Dashboard (`app/(ambassador)/model/DashboardClient.tsx`), Settings (`app/(ambassador)/model/settings/page.tsx`), auth pages (`app/(ambassador)/model/auth/{page,email/page,verify/page}.tsx`), and the Add/Change Email & WhatsApp modals (`components/ambassador/{Add,Change}{Email,WhatsApp}Modal.tsx`) — all render via `{toast && <div style={{…}}>}` with no entrance or exit animation. Animation spec established in Slice 3A per `listings_final_UI_Spec.md` §7.9; reusable keyframes `amb-toast-in` / `amb-toast-out` already live in `app/(ambassador)/layout.tsx` (added alongside the existing `amb-dot-*` / `amb-submit-flash` family). Scope: identify each toast site, apply the shared animation (`1200ms cubic-bezier(.2,.7,.2,1) amb-toast-in + 4000ms-delayed 1200ms cubic-bezier(.5,.2,.8,.1) amb-toast-out`), bump dismiss timers to 5200ms lifecycle, add a `key={toastKey}` prop so back-to-back toasts replay the entrance. Not urgent — visual-consistency hygiene, not user-blocking.

### Slice 3 feature candidates (to be scoped separately, NOT to be conflated with hardening backlog)


---

### 🏗️ Slice 3 — Listings CRUD + uploads

**Goal:** Ambassador can create, edit, delete listings end-to-end inside their own dashboard. Professional creation via Instagram dedup. No public page or payment yet.

**Scope (pages to build):**
- `/model/listings` — Listings page (with real data)
- `/model/listings/new` — Add listing form (uploads + professional creation)
- `/model/listings/[id]/edit` — Edit listing
- `/model/listings/[id]/send-link` — Share payment link page

**API routes:**
- `/api/ambassador/model/listings` — GET / POST / PATCH / DELETE
- `/api/ambassador/model/professionals` — POST (dedup by Instagram)

> Normalized during Slice 3A pre-flight to match the `/api/ambassador/*` convention established in Slices 1 and 1.5 (Principle E). The pre-existing `/api/model/...` form in this doc was pre-Slice-1 planning drift.

**Uploads:**
- Supabase Storage with client-side compression
- Photos (1-3) + optional video (HEVC from iPhone must play on Safari)

**Dashboard update:**
- Show listing count + expiring alerts (remove listings empty state)

**Out of scope:**
- Public page, payments, webhooks, checkout (deferred to Slice 4)
- Wishes (deferred to Slice 5)

**✅ VERIFY before next slice:**
- [ ] Ambassador creates a listing with photos (1-3) successfully uploaded
- [ ] Ambassador creates a listing with a video (HEVC from iPhone) — plays on Safari
- [ ] Ambassador edits an existing listing (title, photos, professional)
- [ ] Professional dedup works — second listing linked to same IG finds existing professional
- [ ] Free trial listing: status=`free_trial`, `free_trial_ends_at` = 30 days out
- [ ] Paid listing (mocked paid_until): send-link page shows payment link with token
- [ ] Listings page shows listing status correctly (effective_status)
- [ ] Delete listing works for Trial/Pending/Expired, blocked for Active
- [ ] Dashboard shows correct listing count + expiring alerts

#### Slice 3 split (decided during 3A pre-flight, Principle H grounds)

- **Slice 3A** — `/model/listings` read surface + `GET` / `DELETE` API + dashboard nav wire-up. ~0.5–1 day.
  - Principle I (DECODE_PROJECT_STATE.md) locked during Slice 3A after toast animation surfaced the divergence pattern. Backlog item 6 (retrofit all ambassador toasts) is the corrective action.
- **Slice 3B** — `/model/listings/new` (Add form + photo/video uploads + professional dedup) + `POST` API. ~1 day.
- **Slice 3C** — `/model/listings/[id]/edit` (reuses Add form in edit mode) + `/model/listings/[id]/send-link` + `PATCH` API. ~0.5–1 day.

**Scope-split rationale:** original Slice 3 scope combined ~2.5 days of work into one slice, violating Principle H. Natural cut points at read-vs-write and create-vs-edit. The original scope text above is preserved as historical record; the VERIFY checklist covers the whole of Slice 3 end-to-end and will be ticked through across 3A/3B/3C.

---

### 💰 Slice 4 — Public page + Stripe payment end-to-end

**Goal:** Professional clicks link in WhatsApp → lands on public ambassador page → completes Stripe payment → receives receipt email → webhook updates paid_until.

**Scope (pages to build):**
- `/{slug}` — Public ambassador page (LISTINGS SECTION ONLY — no wishes yet)
- `/{slug}/listing/{token}` — Stripe checkout (Payment Intents + Elements, NOT Checkout Session)
- `/listing/confirmation/{pi_xxx}` — Listing receipt page

**API routes:**
- `/api/checkout/listing` — POST to create PaymentIntent
- `/api/webhooks/ambassador-stripe` — handle `payment_intent.succeeded` + `charge.refunded` for listings
- `/api/analytics/track` — basic event logging for listing interactions

**Email:**
- Payment receipt (professional) — subject + body from HANDOFF §1895-1934, direct Resend (Principles B+C). Must be added to PHASE 1.7 Email Template Catalog before implementation.

**Bot protection:**
- Cloudflare Turnstile on checkout (invisible)
- Upstash Redis rate limit on `/api/checkout/listing`

**Out of scope:**
- Wishes flow (deferred to Slice 5)
- Wall of Love on public page (deferred to Slice 5)
- Analytics viewer page (data is collected, viewer deferred to Slice 6)
- Payouts (deferred to Slice 6)

**✅ VERIFY before next slice:**
- [ ] Public page `/{slug}` loads, shows listing cards
- [ ] Lightbox opens on photo/video click
- [ ] Instagram link fires analytics event (check DB)
- [ ] Professional clicks payment link from WhatsApp → mobile Safari loads checkout
- [ ] Turnstile verifies silently (no visible CAPTCHA)
- [ ] Professional pays 30/60/90 pkg → Stripe modal works → receipt page shows
- [ ] Payment receipt email arrives, body matches HANDOFF §1895-1934 spec
- [ ] Webhook updates listing `paid_until` with trial-stacking math
- [ ] Refund via Stripe Dashboard → receipt updates within 1 minute
- [ ] End-to-end (Guardrail 6): WhatsApp link click → mobile Safari checkout → Stripe → payment success → receipt email arrives → webhook fires

---

### 🎁 Slice 5 — Wishlist flow (end-to-end gifting)

**Goal:** Ambassador creates wishes, gifters pay for them, they appear on Wall of Love. Race condition handled.

**Scope (pages to build):**
- `/model/wishlist` — Wishlist page
- `/model/wishlist/new` — Add wish form
- `/{slug}/wish/{token}` — Wish gift checkout
- `/wish/confirmation/{pi_xxx}` — Wish gift receipt
- `/wish/taken` — Already gifted error page

**Public page update:**
- Wishes section added
- Wall of Love section added

**Settings update:**
- "Beauty Wishlist" toggle (controls `gifts_enabled`)

**API routes:**
- `/api/model/wishes` — GET/POST/DELETE
- `/api/checkout/wish` — POST to claim + create PaymentIntent (with Turnstile + rate limit)
- `/api/webhooks/ambassador-stripe` — handle `payment_intent.succeeded` for wishes
- `/api/analytics/track` — track wish interactions (Gift It click, Wall of Love IG click)

**Dashboard update:**
- Show wishes count + latest wish

**Out of scope:**
- Analytics page
- Payouts

**✅ VERIFY before next slice:**
- [ ] Ambassador creates a wish with city + country
- [ ] Public page shows wishes section when `gifts_enabled=true`
- [ ] Public page HIDES wishes when `gifts_enabled=false`
- [ ] Gifter clicks "Gift It" → sees checkout with Turnstile
- [ ] **Race condition test:** open checkout in 2 tabs simultaneously, both tap Pay → second redirects to `/wish/taken`
- [ ] **Payment-in-flight test:** start payment, wait 11 min for lock to "expire", payment still completes (not reverted, thanks to pending check)
- [ ] Anonymous gift: receipt shows "See your gift on Sara's page", Wall of Love shows "Anonymous"
- [ ] Non-anonymous gift: shows name + Instagram on Wall of Love
- [ ] Rate limit: 4th attempt within 10 min blocked
- [ ] Payment failed: wish status reverts to `available` after next revert cycle
- [ ] Delete wish: available wishes can be deleted; taken wishes cannot
- [ ] Refund via Stripe → Wall of Love entry removed

---

### 📊 Slice 6 — Analytics + Payouts

**Goal:** Ambassador sees real analytics data. Admin can create and mark payouts as paid.

**Scope (pages to build):**
- `/model/analytics` — Analytics page with charts
- `/model/payouts` — Payouts list
- `/model/payouts/[id]` — Payout statement

**API routes:**
- `/api/model/analytics` — GET aggregated analytics data (with top gifter SQL)
- `/api/admin/payouts/create` — Admin-only endpoint for batching unpaid payments (atomic UPDATE pattern)
- `/api/admin/payouts/[id]/mark-paid` — Admin marks as paid

**Dashboard update:**
- Show real analytics summary (top clicks, expiring soon)

**✅ VERIFY before next slice:**
- [ ] Analytics page shows page views, listing clicks, wish clicks (real data from Slices 4 + 5)
- [ ] Top gifter ranking: anonymous gifts excluded from named list
- [ ] Trend comparison (vs previous 7/30 days) displays correctly
- [ ] Chart.js lazy-loads only on this page (check Network tab)
- [ ] Admin endpoint batches all unpaid completed payments atomically
- [ ] Payout row created with correct gross/fee/net totals + currency
- [ ] Ambassador sees payout with status `pending` in their payouts list
- [ ] Double-click admin "Pay" button test: no duplicate payouts
- [ ] Admin marks payout as paid → status = `paid`, `paid_at` set
- [ ] Payout statement shows all included payments with refs

---

### 🎨 Slice 7 — Polish + edge cases

**Goal:** All terminal pages, static content, error states, and launch-readiness polish.

**Scope (pages to build):**
- `/listing/paid` — Listing already paid (deduplication edge case)
- `/expired` — Generic expired link
- 404 page — Catch-all
- `/terms` — Terms of Service (static, load `terms_upload.docx` content)
- `/privacy` — Privacy Policy (static, load `privacy_upload.docx` content)

**Final polish:**
- All skeleton screens verified
- All loading states verified
- All error boundaries in place
- HTTP 410 Gone on terminal pages
- `noindex` meta on terminal pages
- Bundle size audit (check targets in master doc)
- Lighthouse audit on public pages

**✅ VERIFY — launch readiness:**
- [ ] All 28 URLs work end-to-end
- [ ] No console errors on any page
- [ ] No broken images
- [ ] No layout shifts (CLS score < 0.1)
- [ ] Bundle sizes meet targets (~120KB ambassador, ~250KB analytics)
- [ ] Terms and Privacy pages render correctly
- [ ] 404 catches invalid slugs
- [ ] Legacy app (auctions, offers) still works untouched
- [ ] Mobile browsing test on actual iPhone
- [ ] Complete user journey: sign up → create listing → share link → professional pays → creates wish → gifter pays → sees analytics → admin creates payout
- [ ] Auth redirect loops test: log in/out multiple times, no infinite redirects

---

## 🏁 Slice-based workflow rules

1. **Never move to the next slice with bugs in the current one.** If Slice 4's listing payment has a bug, DO NOT start Slice 5 until it's fixed.
2. **Each slice should be shippable.** After Slice 4, you could launch to a few beta users (no wishes yet, but real listings with payment work).
3. **Claude Code should PAUSE after each slice** and report: "Slice N complete. These are the test steps. Ready for Slice N+1?" — let the user verify manually before proceeding.
4. **Small commits within slices.** Each page, each API route = separate commit. Easier to review, revert, debug.
5. **Test in production-like environment.** Deploy to Vercel preview after each slice. Don't rely on `npm run dev` — real Stripe webhooks, real Supabase, real domains.

---

## 📦 Stage 1.1 — Complete SQL schema

Execute in this order (handles all foreign key dependencies):

```sql
-- ============================================
-- Trigger function (already exists in app — DO NOT recreate)
-- ============================================
-- set_updated_at() — confirm exists or create:
-- CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
-- BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;


-- ============================================
-- 1. model_categories (no FKs, create first for seed)
-- ============================================
CREATE TABLE model_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Public read on active categories
ALTER TABLE model_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active categories" ON model_categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admin all" ON model_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 2. model_profiles (FK to users)
-- ============================================
CREATE TABLE model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9_]{3,30}$'),
  first_name text NOT NULL,
  last_name text NOT NULL,
  cover_photo_url text,
  cover_photo_position_y int DEFAULT 50 CHECK (cover_photo_position_y BETWEEN 0 AND 100),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  tagline text,
  gifts_enabled boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  is_suspended boolean NOT NULL DEFAULT false,  -- admin-only flag (set via Supabase Studio for V1, admin UI Post-V1). When true: profile returns 404 publicly, all ambassador actions blocked. Ambassador cannot un-suspend themselves.
  dashboard_first_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_profiles_user_id ON model_profiles(user_id);
CREATE INDEX idx_model_profiles_slug ON model_profiles(slug);
CREATE INDEX idx_model_profiles_gifts_enabled ON model_profiles(gifts_enabled) WHERE gifts_enabled = true;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published non-suspended profiles" ON model_profiles
  FOR SELECT USING (is_published = true AND is_suspended = false);
CREATE POLICY "Owner read own profile" ON model_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Model insert own profile" ON model_profiles
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Model')
  );
CREATE POLICY "Owner update own profile" ON model_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Owner delete own profile" ON model_profiles
  FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admin all" ON model_profiles
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 3. model_professionals (FK to users)
-- ============================================
CREATE TABLE model_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_handle text UNIQUE NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  avatar_photo_url text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_professionals_ig ON model_professionals(instagram_handle);
CREATE INDEX idx_model_professionals_city ON model_professionals(city);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_professionals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read professionals" ON model_professionals
  FOR SELECT USING (true);
CREATE POLICY "Model insert professionals" ON model_professionals
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Model')
  );
CREATE POLICY "Model update own professionals" ON model_professionals
  FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Admin all" ON model_professionals
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 4. model_listings (FKs to model_profiles, model_professionals, model_categories)
-- ============================================
CREATE TABLE model_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES model_professionals(id),
  category_id uuid REFERENCES model_categories(id),
  category_custom text,
  media_type text CHECK (media_type IN ('video', 'photos') OR media_type IS NULL),
  video_url text,
  photo_url_1 text,
  photo_url_2 text,
  photo_url_3 text,
  price_30 decimal(10,2),
  price_60 decimal(10,2),
  price_90 decimal(10,2),
  currency text NOT NULL,
  payment_link_token text UNIQUE NOT NULL CHECK (length(payment_link_token) = 8),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('free_trial', 'pending_payment', 'active', 'expired')),
  is_free_trial boolean NOT NULL DEFAULT false,
  free_trial_ends_at timestamptz,
  paid_until timestamptz,
  expiry_notification_sent_at timestamptz,  -- when 7-day-before-expiry email+WhatsApp was fired. NULL = not sent. Reset to NULL on renewal.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((category_id IS NOT NULL AND category_custom IS NULL) OR
         (category_id IS NULL AND category_custom IS NOT NULL)),
  -- Media integrity: if media_type set, require the right url field populated
  CHECK (
    media_type IS NULL OR
    (media_type = 'video' AND video_url IS NOT NULL) OR
    (media_type = 'photos' AND photo_url_1 IS NOT NULL)
  )
);
CREATE INDEX idx_model_listings_model_id ON model_listings(model_id);
CREATE INDEX idx_model_listings_professional_id ON model_listings(professional_id);
CREATE INDEX idx_model_listings_payment_link_token ON model_listings(payment_link_token);
CREATE INDEX idx_model_listings_status ON model_listings(status);
CREATE INDEX idx_model_listings_paid_until ON model_listings(paid_until) WHERE paid_until IS NOT NULL;
CREATE INDEX idx_model_listings_trial_ends ON model_listings(free_trial_ends_at) WHERE free_trial_ends_at IS NOT NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active listings" ON model_listings
  FOR SELECT USING (
    status IN ('active', 'free_trial') AND
    model_id IN (SELECT id FROM model_profiles WHERE is_published = true AND is_suspended = false)
  );
CREATE POLICY "Owner all on own listings" ON model_listings
  FOR ALL USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all" ON model_listings
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 5. model_wishes (FK to model_profiles)
-- ============================================
CREATE TABLE model_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  professional_name text,
  professional_city text,
  professional_country text,
  price decimal(10,2) NOT NULL CHECK (price > 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'taken')),
  taken_at timestamptz,
  payment_attempt_expires_at timestamptz,
  gifter_name text,
  gifter_instagram text,
  gifter_is_anonymous boolean NOT NULL DEFAULT false,
  payment_link_token text UNIQUE NOT NULL CHECK (length(payment_link_token) = 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_wishes_model_id ON model_wishes(model_id);
CREATE INDEX idx_model_wishes_status ON model_wishes(status);
CREATE INDEX idx_model_wishes_taken_at ON model_wishes(taken_at) WHERE taken_at IS NOT NULL;
CREATE INDEX idx_model_wishes_payment_link_token ON model_wishes(payment_link_token);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_wishes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_wishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wishes for published profiles with gifts enabled" ON model_wishes
  FOR SELECT USING (
    model_id IN (
      SELECT id FROM model_profiles WHERE is_published = true AND gifts_enabled = true AND is_suspended = false
    )
  );
CREATE POLICY "Owner all on own wishes" ON model_wishes
  FOR ALL USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all" ON model_wishes
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 6. model_payouts (FK to user_bank_accounts — must exist first)
-- ============================================
CREATE TABLE model_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_reference text UNIQUE NOT NULL CHECK (payout_reference ~ '^P-\d{3}-\d{4}$'),
  model_id uuid NOT NULL REFERENCES model_profiles(id),
  gross_total decimal(10,2) NOT NULL,
  platform_fee_total decimal(10,2) NOT NULL,
  net_total decimal(10,2) NOT NULL,
  currency text NOT NULL,
  listings_count int NOT NULL DEFAULT 0,
  wishes_count int NOT NULL DEFAULT 0,
  bank_name text NOT NULL,
  bank_last4 text NOT NULL,
  bank_account_id uuid REFERENCES user_bank_accounts(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_payouts_model_id ON model_payouts(model_id);
CREATE INDEX idx_model_payouts_status ON model_payouts(status);
CREATE INDEX idx_model_payouts_paid_at ON model_payouts(paid_at) WHERE paid_at IS NOT NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read own payouts" ON model_payouts
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all" ON model_payouts
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 7. model_listing_payments (FKs to listings, profiles, payouts)
-- ============================================
CREATE TABLE model_listing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference text UNIQUE NOT NULL CHECK (payment_reference ~ '^L-\d{3}-\d{4}$'),
  listing_id uuid NOT NULL REFERENCES model_listings(id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE RESTRICT,
  gross_amount decimal(10,2) NOT NULL,  -- settlement amount in AMBASSADOR's currency (matches listing price). If professional paid in different currency, their bank handled FX conversion; DECODE only sees the final ambassador-currency amount.
  platform_fee decimal(10,2) NOT NULL,
  net_amount decimal(10,2) NOT NULL,
  currency text NOT NULL,  -- ambassador's currency, lowercase ISO 4217 (e.g. 'aed')
  package_days int NOT NULL CHECK (package_days IN (30, 60, 90)),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  payer_email text,
  stripe_payment_intent_id text UNIQUE,
  stripe_event_id text UNIQUE,  -- from webhook event.id (extra idempotency safety)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial_refund')),
  payout_id uuid REFERENCES model_payouts(id),
  refunded_at timestamptz,
  refund_amount decimal(10,2),
  presentment_amount decimal(10,2),
  presentment_currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_amount = platform_fee + net_amount)
);
CREATE INDEX idx_model_listing_payments_listing_id ON model_listing_payments(listing_id);
CREATE INDEX idx_model_listing_payments_model_id ON model_listing_payments(model_id);
CREATE INDEX idx_model_listing_payments_status ON model_listing_payments(status);
CREATE INDEX idx_model_listing_payments_payout_id ON model_listing_payments(payout_id);
CREATE INDEX idx_model_listing_payments_pi ON model_listing_payments(stripe_payment_intent_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_listing_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_listing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read own listing payments" ON model_listing_payments
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all" ON model_listing_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 8. model_wish_payments (FKs to wishes, profiles, payouts)
-- ============================================
CREATE TABLE model_wish_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference text UNIQUE NOT NULL CHECK (payment_reference ~ '^W-\d{3}-\d{4}$'),
  wish_id uuid NOT NULL REFERENCES model_wishes(id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE RESTRICT,
  gross_amount decimal(10,2) NOT NULL,  -- settlement amount in AMBASSADOR's currency
  platform_fee decimal(10,2) NOT NULL,
  net_amount decimal(10,2) NOT NULL,
  currency text NOT NULL,  -- ambassador's currency, lowercase ISO 4217
  gifter_email text,
  stripe_payment_intent_id text UNIQUE,
  stripe_event_id text UNIQUE,  -- from webhook event.id (extra idempotency safety)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial_refund')),
  payout_id uuid REFERENCES model_payouts(id),
  refunded_at timestamptz,
  refund_amount decimal(10,2),
  presentment_amount decimal(10,2),
  presentment_currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_amount = platform_fee + net_amount)
);
CREATE INDEX idx_model_wish_payments_wish_id ON model_wish_payments(wish_id);
CREATE INDEX idx_model_wish_payments_model_id ON model_wish_payments(model_id);
CREATE INDEX idx_model_wish_payments_status ON model_wish_payments(status);
CREATE INDEX idx_model_wish_payments_payout_id ON model_wish_payments(payout_id);
CREATE INDEX idx_model_wish_payments_pi ON model_wish_payments(stripe_payment_intent_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_wish_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE model_wish_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read completed wish payments for Wall of Love" ON model_wish_payments
  FOR SELECT USING (
    status = 'completed' AND
    model_id IN (SELECT id FROM model_profiles WHERE is_published = true)
  );
CREATE POLICY "Owner read own wish payments" ON model_wish_payments
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all" ON model_wish_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));


-- ============================================
-- 9. model_analytics_events (FK to model_profiles, append-only)
-- ============================================
CREATE TABLE model_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'public_page_view',
    'listing_instagram_click',
    'listing_media_click',
    'wish_giftit_click',
    'wish_instagram_click',
    'public_page_share_click',
    'wall_of_love_instagram_click'
  )),
  target_id uuid,
  ip_hash text,
  session_id text,  -- anonymous session UUID generated client-side (sessionStorage), enables funnel analysis across dynamic IPs (mobile networks)
  user_agent text,
  device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop') OR device_type IS NULL),
  referrer text,
  country text,
  utm_params jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_analytics_events_model_id ON model_analytics_events(model_id);
CREATE INDEX idx_model_analytics_events_event_type ON model_analytics_events(event_type);
CREATE INDEX idx_model_analytics_events_created_at ON model_analytics_events(created_at);
CREATE INDEX idx_model_analytics_events_target_id ON model_analytics_events(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_model_analytics_events_session_id ON model_analytics_events(session_id) WHERE session_id IS NOT NULL;

ALTER TABLE model_analytics_events ENABLE ROW LEVEL SECURITY;
-- NO public INSERT policy. Service role bypasses RLS, so server-side inserts work.
-- This prevents public clients from spamming fake analytics events (database-bloat DDoS).
CREATE POLICY "Owner read own analytics" ON model_analytics_events
  FOR SELECT USING (model_id IN (SELECT id FROM model_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin all" ON model_analytics_events
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'Admin'));
```

### Seed data — categories

```sql
INSERT INTO model_categories (label, slug, display_order) VALUES
  ('Body contouring', 'body_contouring', 1),
  ('Botox', 'botox', 2),
  ('Brows', 'brows', 3),
  ('Chemical peel', 'chemical_peel', 4),
  ('Cool sculpting', 'cool_sculpting', 5),
  ('Fillers', 'fillers', 6),
  ('Hair', 'hair', 7),
  ('Hair extensions', 'hair_extensions', 8),
  ('Hair removal', 'hair_removal', 9),
  ('Henna', 'henna', 10),
  ('HydraFacial', 'hydrafacial', 11),
  ('IV therapy', 'iv_therapy', 12),
  ('Laser', 'laser', 13),
  ('Lashes', 'lashes', 14),
  ('Lip blush', 'lip_blush', 15),
  ('Makeup', 'makeup', 16),
  ('Massage', 'massage', 17),
  ('Microblading', 'microblading', 18),
  ('Microneedling', 'microneedling', 19),
  ('Nails', 'nails', 20),
  ('PRP', 'prp', 21),
  ('Skin Booster', 'skin_booster', 22),
  ('Teeth whitening', 'teeth_whitening', 23),
  ('Threads', 'threads', 24),
  ('Veneers', 'veneers', 25),
  ('Waxing', 'waxing', 26);
```

---

## 🔄 Stage 1.2 — DB views for centralized state cleanup

Instead of "remember to call revert function before every query," use database views that always return clean state. Read from VIEW, write to TABLE.

### model_wishes_live view — auto-cleans expired locks

```sql
CREATE VIEW model_wishes_live AS
SELECT
  w.*,
  CASE
    WHEN w.status = 'taken'
      AND w.payment_attempt_expires_at IS NOT NULL
      AND w.payment_attempt_expires_at < now()
      AND NOT EXISTS (
        SELECT 1 FROM model_wish_payments
        WHERE wish_id = w.id AND status IN ('pending', 'completed')
      )
    THEN 'available'
    ELSE w.status
  END AS effective_status
FROM model_wishes w;

-- Grant same access as the underlying table
GRANT SELECT ON model_wishes_live TO authenticated, anon;
```

### model_listings_live view — auto-expires passed periods

```sql
CREATE VIEW model_listings_live AS
SELECT
  l.*,
  CASE
    WHEN l.status = 'active' AND l.paid_until IS NOT NULL AND l.paid_until < now() THEN 'expired'
    WHEN l.status = 'free_trial' AND l.free_trial_ends_at IS NOT NULL AND l.free_trial_ends_at < now() THEN 'expired'
    ELSE l.status
  END AS effective_status
FROM model_listings l;

GRANT SELECT ON model_listings_live TO authenticated, anon;
```

**Usage rule:**
- Read `effective_status` from `*_live` views everywhere in the UI
- Write directly to base tables (model_wishes, model_listings)
- The `revert_expired_wish_locks()` function still exists for actually updating the DB (call periodically or on writes that need fresh state)

---

## 🔒 Critical implementation patterns

### 1. Atomic wish claim (race condition prevention)

Create a Postgres RPC function:

```sql
CREATE OR REPLACE FUNCTION claim_wish_for_payment(p_wish_id uuid, p_lock_minutes int DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_wish_row record;
BEGIN
  -- Atomic claim: only succeeds if wish is currently 'available'
  UPDATE model_wishes
  SET status = 'taken',
      payment_attempt_expires_at = now() + (p_lock_minutes || ' minutes')::interval,
      updated_at = now()
  WHERE id = p_wish_id AND status = 'available'
  RETURNING * INTO v_wish_row;

  IF NOT FOUND THEN
    RETURN json_build_object('claimed', false);
  END IF;

  RETURN json_build_object(
    'claimed', true,
    'wish', row_to_json(v_wish_row)
  );
END;
$$;

-- Inline self-cleaning: call this BEFORE every wish query (no cron needed)
-- Reverts expired locks ONLY if no payment is in flight (prevents refund edge case)
CREATE OR REPLACE FUNCTION revert_expired_wish_locks()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  WITH reverted AS (
    UPDATE model_wishes
    SET status = 'available',
        payment_attempt_expires_at = NULL,
        updated_at = now()
    WHERE status = 'taken'
      AND payment_attempt_expires_at IS NOT NULL
      AND payment_attempt_expires_at < now()
      AND NOT EXISTS (
        -- CRITICAL: check BOTH 'pending' and 'completed'.
        -- If payment is still pending (slow card auth), keep wish locked.
        -- This eliminates the "payment succeeds after lock expired" edge case.
        SELECT 1 FROM model_wish_payments
        WHERE wish_id = model_wishes.id
          AND status IN ('pending', 'completed')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM reverted;
  RETURN v_count;
END;
$$;
```

**IMPORTANT — Inline revert pattern (no cron):**
Call `revert_expired_wish_locks()` at the START of every wish-related query:
- Public page loading wishes for `/{slug}`
- Wishlist page `/model/wishlist`
- Wish checkout page `/{slug}/wish/{token}`
This ensures expired locks are cleaned up before any wish data is read. No Vercel cron dependency.

**Usage in checkout flow:**
```typescript
// Server-side wish payment route

// Step 0: Clean up any expired locks first
await supabaseAdmin.rpc('revert_expired_wish_locks');

// Step 1: Verify Cloudflare Turnstile token (bot protection)
const turnstileToken = req.body.turnstileToken;
const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: turnstileToken
  })
});
const turnstileResult = await turnstileResponse.json();
if (!turnstileResult.success) {
  return res.status(403).json({ error: 'Bot detected' });
}

// Step 2: Rate limit (max 3 lock attempts per IP per 10 min)
// Use Vercel KV or in-memory store
const ip = req.headers['x-forwarded-for'];
if (await isRateLimited(ip, 'wish-claim', 3, 600)) {
  return res.status(429).json({ error: 'Too many attempts' });
}

// Step 3: Atomic claim
const { data, error } = await supabaseAdmin.rpc('claim_wish_for_payment', {
  p_wish_id: wishId,
  p_lock_minutes: 10
});

if (!data.claimed) {
  return res.redirect(`/wish/taken?slug=${slug}&first=${firstName}`);
}

// Step 4: Create Stripe PaymentIntent
// Currency-aware amount (handles zero-decimal currencies like JPY/KRW)
const ZERO_DECIMAL = ['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf'];
const stripeAmount = ZERO_DECIMAL.includes(data.wish.currency)
  ? Math.round(data.wish.price)       // zero-decimal: send as-is
  : Math.round(data.wish.price * 100); // fractional: convert to cents

const pi = await stripe.paymentIntents.create({
  amount: stripeAmount,
  currency: data.wish.currency,
  metadata: {
    feature: 'ambassador',
    type: 'wish',
    wish_id: wishId,
    model_id: data.wish.model_id
  }
});
```

### 2. Trial-stacking on payment success

```typescript
// In webhook handler when payment_intent.succeeded for a listing
const listing = await getListingById(metadata.listing_id);
const periodStart = new Date(Math.max(
  Date.now(),
  listing.paid_until?.getTime() || 0,
  listing.free_trial_ends_at?.getTime() || 0
));
const periodEnd = new Date(periodStart.getTime() + (packageDays * 24 * 60 * 60 * 1000));

// Insert payment row
// Currency-aware amount conversion (same ZERO_DECIMAL list as wish checkout)
const ZERO_DECIMAL = ['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf'];
const grossAmount = ZERO_DECIMAL.includes(pi.currency)
  ? pi.amount                  // zero-decimal: already in whole units
  : pi.amount / 100;           // fractional: convert cents to dollars

await db.from('model_listing_payments').insert({
  payment_reference: generateReference('L'),
  listing_id: listing.id,
  model_id: listing.model_id,
  gross_amount: grossAmount,
  platform_fee: grossAmount * 0.20,
  net_amount: grossAmount * 0.80,
  currency: pi.currency,
  package_days: packageDays,
  period_start: periodStart,
  period_end: periodEnd,
  // ... etc
});

// Update listing
await db.from('model_listings').update({
  status: 'active',
  is_free_trial: false,
  paid_until: periodEnd
}).eq('id', listing.id);
```

### 3. Reference number generation

```typescript
// Generate L-847-3921, W-291-8473, P-563-9204 (Stripe-style random)
function generateReference(prefix: 'L' | 'W' | 'P'): string {
  const part1 = Math.floor(100 + Math.random() * 900);   // 3 digits (100-999)
  const part2 = Math.floor(1000 + Math.random() * 9000); // 4 digits (1000-9999)
  return `${prefix}-${part1}-${part2}`;
}

// Retry on collision (UNIQUE constraint catches the ultra-rare collision)
async function generateUniqueReference(prefix: 'L' | 'W' | 'P', table: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = generateReference(prefix);
    const { data } = await db.from(table).select('id').eq('payment_reference', ref).maybeSingle();
    if (!data) return ref;
  }
  throw new Error('Could not generate unique reference after 5 attempts');
}
```

### 4. Skeleton screen pattern

```tsx
// /model/listings/page.tsx
export default function ListingsPage() {
  const { data: listings, isLoading } = useListings();

  if (isLoading) {
    return <ListingsSkeleton />;
  }

  return <ListingsList listings={listings} />;
}

function ListingsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-[120px] rounded-xl"
          style={{
            background: 'linear-gradient(90deg, #1c1c1c 0%, #262626 50%, #1c1c1c 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite'
          }}
        />
      ))}
    </div>
  );
}
```

### 5. Static page generation

```tsx
// app/(ambassador)/terms/page.tsx
export const dynamic = 'force-static';
export const revalidate = false; // never refetch

export default function TermsPage() {
  return <TermsContent />;
}
```

### 6. Stripe webhook handler skeleton

```typescript
// app/api/webhooks/ambassador-stripe/route.ts
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency check via existing webhook_events table
  const { data: existing } = await supabaseAdmin
    .from('webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (existing) return new Response('Already processed', { status: 200 });

  // Filter: only handle DECODE feature events
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    if (pi.metadata?.feature !== 'ambassador') return new Response('Not for ambassador feature', { status: 200 });

    if (pi.metadata.type === 'listing') {
      await handleListingPaymentSuccess(pi);
    } else if (pi.metadata.type === 'wish') {
      await handleWishPaymentSuccess(pi);
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    if (pi.metadata?.feature !== 'ambassador') return new Response('Not for ambassador feature', { status: 200 });

    if (pi.metadata.type === 'wish') {
      // Revert wish lock so others can attempt
      await supabaseAdmin.from('model_wishes')
        .update({ status: 'available', payment_attempt_expires_at: null })
        .eq('id', pi.metadata.wish_id);
    }
  } else if (event.type === 'charge.refunded') {
    // Handle refund with payout reconciliation (see handleRefund below)
    await handleRefund(event.data.object);
  }
  // ... end of main webhook handler

  // Record event for idempotency
  await supabaseAdmin.from('webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    event_data: event,
    status: 'processed'
  });

  return new Response('OK', { status: 200 });
}

// Refund handler — MUST reconcile payout totals if payment is already batched
async function handleRefund(charge) {
  const pi = charge.payment_intent;

  // Find our payment row (check both tables since we don't know which at this point)
  const listingResult = await supabaseAdmin
    .from('model_listing_payments')
    .select('*, payout:payout_id(id, status)')
    .eq('stripe_payment_intent_id', pi)
    .maybeSingle();

  const paymentRow = listingResult.data;
  const table = paymentRow ? 'model_listing_payments' : 'model_wish_payments';

  // If not found in listings, check wishes
  const finalRow = paymentRow || (await supabaseAdmin
    .from('model_wish_payments')
    .select('*, payout:payout_id(id, status)')
    .eq('stripe_payment_intent_id', pi)
    .single()).data;

  if (!finalRow) return;

  const refundAmount = charge.amount_refunded / 100;  // Stripe returns cents
  const isFullRefund = refundAmount >= finalRow.gross_amount;

  if (isFullRefund) {
    // Full refund: status='refunded', net_amount → 0
    await supabaseAdmin.from(table).update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refund_amount: refundAmount,
      net_amount: 0,
      platform_fee: 0
    }).eq('id', finalRow.id);
  } else {
    // Partial refund: recalculate fee/net based on remaining amount
    const remaining = finalRow.gross_amount - refundAmount;
    await supabaseAdmin.from(table).update({
      status: 'partial_refund',
      refunded_at: new Date().toISOString(),
      refund_amount: refundAmount,
      platform_fee: remaining * 0.20,
      net_amount: remaining * 0.80
    }).eq('id', finalRow.id);
  }

  // CRITICAL: reconcile payout totals if payment is in a pending payout
  if (finalRow.payout?.id && finalRow.payout.status === 'pending') {
    await reconcilePayoutTotals(finalRow.payout.id);
  } else if (finalRow.payout?.status === 'paid') {
    // Payout already processed — flag for admin manual reconciliation
    await supabaseAdmin.from('admin_alerts').insert({  // or log to Sentry
      type: 'refund_after_payout_paid',
      payout_id: finalRow.payout.id,
      payment_id: finalRow.id,
      refund_amount: refundAmount,
      notes: 'Refund received after payout already paid. Manual reconciliation required.'
    });
  }
}

// Recalculate payout totals by summing all assigned payments
async function reconcilePayoutTotals(payoutId) {
  const { data: listings } = await supabaseAdmin
    .from('model_listing_payments')
    .select('gross_amount, platform_fee, net_amount')
    .eq('payout_id', payoutId);

  const { data: wishes } = await supabaseAdmin
    .from('model_wish_payments')
    .select('gross_amount, platform_fee, net_amount')
    .eq('payout_id', payoutId);

  const totals = [...listings, ...wishes].reduce((acc, p) => ({
    gross: acc.gross + Number(p.gross_amount),
    fee: acc.fee + Number(p.platform_fee),
    net: acc.net + Number(p.net_amount)
  }), { gross: 0, fee: 0, net: 0 });

  await supabaseAdmin.from('model_payouts').update({
    gross_total: totals.gross,
    platform_fee_total: totals.fee,
    net_total: totals.net
  }).eq('id', payoutId);
}
```

**Critical: validate Stripe metadata against DB**

Don't trust `metadata.listing_id` blindly — someone could craft a fake webhook. The webhook handler must:

```typescript
async function handleListingPaymentSuccess(pi) {
  // Step 1: Find our DB record by stripe_payment_intent_id (not by metadata)
  const { data: paymentRow } = await supabaseAdmin
    .from('model_listing_payments')
    .select('*')
    .eq('stripe_payment_intent_id', pi.id)
    .single();

  if (!paymentRow) {
    console.error('No DB record for PI:', pi.id);
    return; // don't process orphan webhooks
  }

  // Step 2: Verify metadata matches what WE stored (not what the event claims)
  if (paymentRow.listing_id !== pi.metadata.listing_id) {
    console.error('Metadata mismatch — possible tampering');
    return;
  }

  // Step 3: Update status (idempotent via UNIQUE on stripe_payment_intent_id)
  await supabaseAdmin
    .from('model_listing_payments')
    .update({ status: 'completed', stripe_event_id: event.id })
    .eq('id', paymentRow.id);

  // Step 4: Update listing paid_until (trial-stacking logic)
  // ...
}
```

### 7. Atomic payout batching

Admin clicks "Pay" on Wednesday. Without a lock, double-clicks could include same payment in 2 payouts.

```typescript
// server-side admin endpoint: POST /api/admin/payouts/create
async function createPayoutForModel(modelId: string, adminId: string) {
  // Step 1: Create empty payout row first
  const { data: payout } = await supabaseAdmin
    .from('model_payouts')
    .insert({
      payout_reference: await generateUniqueReference('P', 'model_payouts'),
      model_id: modelId,
      status: 'pending',
      // totals filled below
      gross_total: 0, platform_fee_total: 0, net_total: 0,
      listings_count: 0, wishes_count: 0,
      currency: '', bank_name: '', bank_last4: ''
    })
    .select()
    .single();

  // Step 2: ATOMIC batch — claim all unpaid completed payments
  // WHERE payout_id IS NULL acts as the lock
  const { data: listings } = await supabaseAdmin
    .from('model_listing_payments')
    .update({ payout_id: payout.id })
    .match({ model_id: modelId, status: 'completed', payout_id: null })
    .select();

  const { data: wishes } = await supabaseAdmin
    .from('model_wish_payments')
    .update({ payout_id: payout.id })
    .match({ model_id: modelId, status: 'completed', payout_id: null })
    .select();

  // Step 3: Calculate totals and update payout
  const totals = [...listings, ...wishes].reduce((acc, p) => ({
    gross: acc.gross + Number(p.gross_amount),
    fee: acc.fee + Number(p.platform_fee),
    net: acc.net + Number(p.net_amount)
  }), { gross: 0, fee: 0, net: 0 });

  await supabaseAdmin
    .from('model_payouts')
    .update({
      gross_total: totals.gross,
      platform_fee_total: totals.fee,
      net_total: totals.net,
      listings_count: listings.length,
      wishes_count: wishes.length,
      currency: listings[0]?.currency || wishes[0]?.currency,
      // snapshot bank details from user_bank_accounts...
    })
    .eq('id', payout.id);

  return payout;
}
```

**Why this is safe:** `.match({ payout_id: null })` ensures only payments not yet assigned to a payout get claimed. A second concurrent call finds 0 rows and creates an empty payout (handle this edge case by deleting empty payouts after the fact).

### Payout state machine

The `status` enum has 4 states. Use them in sequence to track external bank transfer process:

```
pending (initial)
  → admin clicks "Start payout" → status='processing', recalculate totals from DB
  → admin makes bank transfer externally
  → success: admin clicks "Mark paid" → status='paid', paid_at=now()
  → failure: admin clicks "Mark failed" → status='failed', admin_notes='bank rejected: reason'
```

**If `failed`:** admin can retry. Payment rows keep their `payout_id` — don't unassign them, just update the payout status. If bank transfer is retried with a new attempt, keep the same payout row.

**Rollback scenarios:**
- Payout marked `paid` but transfer failed → admin manually unmarks (status back to `processing`), retries
- Refund arrives after `paid` → logged to `admin_alerts` for manual reconciliation (not auto-reversed)

---

### 8. Storage bucket configuration (Supabase Dashboard)

RLS policies protect WHO can upload, but don't limit WHAT they upload. A malicious authenticated user could bypass our API and upload 500MB files directly via Supabase Storage API. Enforce limits at the bucket level:

**Supabase Dashboard → Storage → model-media bucket → Configuration:**
- **File size limit:** `15 MB` (enforced by Supabase itself — cannot be bypassed)
- **Allowed MIME types:** `image/jpeg, image/png, image/webp, video/mp4, video/quicktime, video/webm`

These settings take effect immediately and apply to all uploads regardless of entry point. Pair with server-side MIME check for defense-in-depth.

---

### 9. Frontend idempotency keys (double-tap protection)

Problem: user double-taps "Create Listing" on slow network → 2 identical rows created.

**Solution:** client generates a UUID per user action, sends it in the request header. Server checks if that key was already processed in the last 60 seconds.

**Client pattern:**
```typescript
// When user clicks Create Listing
const idempotencyKey = crypto.randomUUID();

const response = await fetch('/api/model/listings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey
  },
  body: JSON.stringify(formData)
});
```

**Server pattern (using Upstash Redis):**
```typescript
// In API route
const key = req.headers.get('Idempotency-Key');
if (key) {
  const existing = await redis.get(`idem:${key}`);
  if (existing) {
    return Response.json(JSON.parse(existing));  // return cached result
  }
}

// ... do the work ...
const result = await createListing(...);

// Cache result for 60 seconds
if (key) {
  await redis.set(`idem:${key}`, JSON.stringify(result), { ex: 60 });
}

return Response.json(result);
```

**Apply to all write endpoints:** POST/PATCH/DELETE routes for listings, wishes, professionals, settings. Not needed on GET (idempotent by nature).

---

### 10. Pagination pattern (V1 simple, scale-ready)

For V1 all list queries use a hard `LIMIT 100` — prevents accidental full-table scans. Cursor-based pagination deferred to Post-V1.

**V1 query pattern:**
```typescript
// Listings page
const { data } = await supabase
  .from('model_listings_live')
  .select('*')
  .eq('model_id', modelId)
  .order('created_at', { ascending: false })
  .limit(100);

// If data.length === 100, show a "Showing first 100" note
// TODO: Post-V1 — add cursor pagination when 50+ ambassadors reach this threshold
```

**Apply to:**
- `/model/listings` list query
- `/model/wishlist` list query
- `/model/payouts` list query
- `/model/payouts/[id]` (listing + wish payments within a payout)
- `/model/analytics` event aggregation queries
- Public `/{slug}` (listings + wishes + Wall of Love entries)

**When to upgrade to cursor pagination:** when any ambassador approaches 80+ items in a single list. Add `?cursor=...&limit=50` query params and use `.lt('created_at', cursor)` filter.

---

## 📬 Notifications (emails + WhatsApp)

V1 fires a small set of transactional notifications. No marketing emails, no promo WhatsApp — just receipts and useful nudges.

### Channel split

| Who | Event | Channel | Service |
|---|---|---|---|
| Admin (you) | Any new payment | Email | Stripe built-in (Stripe Dashboard toggle, zero code) |
| Admin (you) | Refund issued | Email | Stripe built-in |
| Professional | Listing payment receipt | Email | **Resend** (custom branded template) |
| Professional | Listing expires in 7 days | Email | **Resend** (custom branded template) |
| Professional | Listing expires in 7 days | WhatsApp | **AUTHKey** (UTILITY template) |
| Gifter | Wish gift receipt | Email | **Resend** (custom branded template) |
| Ambassador | Listing just paid | WhatsApp | **AUTHKey** (UTILITY template) |
| Ambassador | Wish just gifted | WhatsApp | **AUTHKey** (UTILITY template) |
| Ambassador | Own listing expires in 7 days | WhatsApp | **AUTHKey** (UTILITY template) |

### 1. Stripe Dashboard admin emails (no code)

Enable in Stripe Dashboard: **Settings → Emails → Customer emails + Business notifications**. Stripe sends emails to your admin email for new payments, refunds, disputes. Zero integration needed.

### 2. Resend email service

Sign up at resend.com, verify `welovedecode.com` domain, get API key.

**New env var:** `RESEND_API_KEY`
**From address:** `DECODE <hello@welovedecode.com>`

Install: `npm install resend`

Helper:
```typescript
// /lib/notifications/email.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    await resend.emails.send({
      from: 'DECODE <hello@welovedecode.com>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Resend send failed:', err);
    // Don't throw — notification failures shouldn't break webhooks
  }
}
```

**3 templates needed** (plain text, with ━━ separator lines — see email template specs below for exact copy).

### 3. AUTHKey WhatsApp service

Already integrated for login OTP. Same API key, same pattern — just different template IDs.

**API endpoint:** `https://console.authkey.io/restapi/request.php`

**Template categories (configured when creating each template in AUTHKey dashboard):**
- `AUTHENTICATION` — existing OTP login template (don't touch)
- `UTILITY` — all 4 new notification templates (you create in AUTHKey dashboard, submit for Meta approval)

**The code doesn't handle categories.** It just calls AUTHKey with the template ID (`wid`) and variables. AUTHKey routes to Meta with the category that was set during template creation.

**New env vars** (template IDs from AUTHKey dashboard after templates are created + approved):
```
AUTHKEY_WID_OTP=101                      # existing — WhatsApp OTP (AUTHENTICATION)
AUTHKEY_WID_LISTING_PAID=...             # NEW — to ambassador when their listing gets paid (UTILITY)
AUTHKEY_WID_WISH_GIFTED=...              # NEW — to ambassador when someone gifts a wish (UTILITY)
AUTHKEY_WID_LISTING_EXPIRING_AMB=...     # NEW — to ambassador: listing expires in 7 days (UTILITY)
AUTHKEY_WID_LISTING_EXPIRING_PRO=...     # NEW — to professional: listing expires in 7 days (UTILITY)
```

Helper:
```typescript
// /lib/notifications/whatsapp.ts
export async function sendWhatsApp({
  phone,
  countryCode,
  templateId,
  variables,
}: {
  phone: string;
  countryCode: string;
  templateId: string;
  variables: Record<string, string>;
}) {
  const params = new URLSearchParams({
    authkey: process.env.AUTHKEY_API_KEY!,
    mobile: phone,
    country_code: countryCode,
    wid: templateId,
    ...variables,
  });
  try {
    const res = await fetch(`https://console.authkey.io/restapi/request.php?${params}`);
    return await res.json();
  } catch (err) {
    console.error('AUTHKey send failed:', err);
    // Don't throw — notification failures shouldn't break webhooks
  }
}

// Usage — listing paid notification to ambassador
await sendWhatsApp({
  phone: ambassador.phone_number,
  countryCode: ambassador.country_code,
  templateId: process.env.AUTHKEY_WID_LISTING_PAID!,
  variables: {
    first_name: ambassador.first_name,
    amount: String(payment.gross_amount),
    currency: payment.currency.toUpperCase(),
  },
});
```

### Trigger locations

| Notification | Fires from |
|---|---|
| Listing payment receipt (email to pro) | Webhook `payment_intent.succeeded` — after DB updates |
| Wish gift receipt (email to gifter) | Webhook `payment_intent.succeeded` — after DB updates |
| Listing paid WhatsApp (to ambassador) | Same webhook handler as above |
| Wish gifted WhatsApp (to ambassador) | Same webhook handler as above |
| Listing expiring emails + WhatsApp | Daily check (cron OR inline on dashboard query): `paid_until` in next 7 days AND `expiry_notification_sent_at IS NULL` |

### Schema addition

The `expiry_notification_sent_at timestamptz` column is ALREADY included in the `CREATE TABLE model_listings` SQL above (line 402). No separate ALTER needed.

```
-- Already in CREATE TABLE model_listings:
-- expiry_notification_sent_at timestamptz,  -- when 7-day-before-expiry notification was fired
-- NULL = not yet sent. Reset to NULL on renewal (new payment).
```

### Firing pattern — keep notifications non-blocking

```typescript
// Webhook handler pseudocode
await updatePaymentStatus(pi);
await updateListingPaidUntil(listing, periodEnd);

// Fire notifications AFTER DB is updated, WRAPPED in try/catch so they don't break webhook
try {
  await sendEmail({ to: payment.payer_email, subject: ..., html: ListingReceiptHTML(data) });
} catch (e) { console.error(e); }

try {
  await sendWhatsApp({ phone: ambassador.phone_number, ... });
} catch (e) { console.error(e); }

return new Response('OK', { status: 200 });
```

**Never block webhook acknowledgment on notification delivery.** Stripe will retry webhooks if we don't return 200 quickly. Notifications are best-effort.

### Email template specs

**Full templates are documented separately** (3 templates total). Each has:
- Plain text format (no HTML wrapper for V1)
- `━━` separator lines
- Header greeting with emoji
- Data block (labels + values)
- View URL section
- "Didn't make this payment?" anti-phishing line
- Sign-off: `Your DECODE team` / `welovedecode.com`
- Conditional blocks (e.g., `Free Trial ends:` row only shown if trial stacking)
- Cross-currency note: `Amount: 300 AED  (charged as $82.00 USD on your card)` when `presentment_currency ≠ currency`

**Email templates** (use these exact texts when implementing):

#### Template 1 — Listing payment receipt (professional)

**Subject:** `You're live on {{ambassador_first_name}}'s page 🎉`

```
Congrats — you're officially on {{ambassador_first_name}}'s page 🎉

Your listing is live right now.
Thousands of her followers will be able to discover your work.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR SPOTLIGHT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ambassador:       {{ambassador_full_name}}
Reference:        {{payment_reference}}
Service:          {{package_days}}-day listing on {{ambassador_first_name}}'s page
Purchase date:    {{purchase_date}}
Amount:           {{amount}} {{currency}}{{fx_note}}
[IF trial_stacking:]
Free Trial ends:  {{trial_end_date}}
[/IF]
Start date:       {{start_date}}
End date:         {{end_date}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View your listing:
welovedecode.com/{{ambassador_slug}}

View your receipt online:
app.welovedecode.com/listing/confirmation/{{stripe_payment_intent_id}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Didn't make this payment? Please reply right away.

Your DECODE team
welovedecode.com
```

#### Template 2 — Wish gift receipt (gifter)

**Subject:** `You made {{ambassador_first_name}}'s day 🎁`

**Version A (named gifter):**
```
Amazing — you fulfilled {{ambassador_first_name}}'s beauty wish 🎁

Your name is live on {{ambassador_first_name}}'s page right now.
Thousands will see your name and Instagram on her Wall of Love.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR GIFT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ambassador:     {{ambassador_full_name}}
Reference:      {{payment_reference}}
Gift:           {{wish_service}}{{if_professional}} @ {{professional_name}}{{/if}}
Purchase date:  {{purchase_date}}
Amount:         {{amount}} {{currency}}{{fx_note}}
Your name:      {{gifter_name}}
Your IG:        @{{gifter_instagram}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View your gift on {{ambassador_first_name}}'s page:
welovedecode.com/{{ambassador_slug}}

View your receipt online:
app.welovedecode.com/wish/confirmation/{{stripe_payment_intent_id}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Didn't make this gift? Please reply right away.

Your DECODE team
welovedecode.com
```

**Version B (anonymous gifter):** Same as A but:
- Opening line: `Your gift is live on {{ambassador_first_name}}'s page right now.\nThousands will see it as "Anonymous" — your name and Instagram stay private.`
- Replace `Your name:` + `Your IG:` rows with a single: `Visibility:     Anonymous`

#### Template 3 — Listing expiring in 7 days (professional)

**Subject:** `Only 7 days left on {{ambassador_first_name}}'s page ⏰`

```
Heads up — your listing on {{ambassador_first_name}}'s page expires in 7 days.

Don't lose your spotlight.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR SPOTLIGHT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ambassador:     {{ambassador_full_name}}
Reference:      {{payment_reference}}
Service:        {{package_days}}-day listing on {{ambassador_first_name}}'s page
Expires:        {{expires_date}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View your listing:
welovedecode.com/{{ambassador_slug}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Want to renew? Message {{ambassador_first_name}} — she'll send you a fresh payment link.
Or let it expire naturally.

Your DECODE team
welovedecode.com
```

### Variable formatting rules

| Variable | Format |
|---|---|
| `{{purchase_date}}`, `{{start_date}}`, `{{end_date}}`, `{{trial_end_date}}`, `{{expires_date}}` | `16 April 2026` (day + full month name + year, no comma) |
| `{{amount}}` | Number with thousands separator if needed (e.g., `1,234`) |
| `{{currency}}` | Uppercase ISO 4217 (e.g., `AED`, `USD`) |
| `{{fx_note}}` | Empty string if `presentment_currency === currency`, else ` (charged as ${{presentment_amount}} {{presentment_currency_upper}} on your card)` |
| `{{trial_stacking}}` | Boolean: true when `period_start > created_at` |

### WhatsApp templates — deferred to AUTHKey dashboard

You create the 4 UTILITY templates directly in AUTHKey dashboard, submit for Meta approval (1-2 days), and save the resulting `wid` IDs as env vars. Claude Code reads them from env. Draft copy will be defined when you sit down to create them.

---

## 🎯 Clarifications (from Claude Code ULTRAPLAN review)

These resolve questions raised during Slice 0 planning. Each is now locked.

### Payment status enum (5 values, not 4)
`model_listing_payments.status` and `model_wish_payments.status` accept:
`pending / completed / failed / refunded / partial_refund`

Use `partial_refund` when a Stripe refund is issued for less than `gross_amount`. Full refund = `refunded`.

### URL token length (always 8 chars)
Every `payment_link_token` is 8 characters — on both `model_listings` AND `model_wishes`. Any doc reference to "5-char token" is stale; trust the SQL CHECK constraint.

### Wish checkout URLs use tokens, not UUIDs
`model_wishes.payment_link_token` (new column) is required. URL = `/{slug}/wish/{token}` where token is 8 chars. Never expose wish UUIDs in URLs — enumeration risk.

### Suspended ambassador enforcement
When `model_profiles.is_suspended = true`:
- Public route `/{slug}` returns 404
- Authenticated `/model/*` routes show "Your account has been suspended" screen (full-page, no dashboard)
- Ambassador CAN still log in (so they see the message)
- All mutation APIs return 403
- Ambassador CANNOT un-suspend themselves (admin-only)

Implementation: layout-level check in `app/(ambassador)/model/layout.tsx` — if `profile.is_suspended`, render suspended screen instead of children.

### Onboarding creates both auth.users + public.users + model_profiles
Existing WhatsApp OTP flow only creates `auth.users`. The NEW ambassador onboarding flow must create:
1. `auth.users` (via Supabase auth)
2. `public.users` row (mirror with `role='Model'`, `user_name`, `email` nullable)
3. `model_profiles` row (FK → public.users)

All three in a single API call, wrapped in a transaction. If any step fails, rollback all.

### WhatsApp auth: no fake emails
Create NEW route `/api/model/auth/verify-otp` (separate from legacy `verify-whatsapp-otp`). This route:
- Calls `supabase.auth.admin.createUser({ phone, phone_confirm: true })` WITHOUT email
- If Supabase rejects null email, escalate before implementing a workaround
- Sets `public.users.email = NULL` for WhatsApp-only users

Legacy route stays untouched.

### Middleware matcher update
The ONLY existing-file modification in Slice 0: add `/model/:path*` to middleware matcher array. Do not modify the `updateSession` function itself.

### Currency detection (Vercel, not third-party)
Use Vercel's built-in geo headers to auto-detect currency on onboarding:
```typescript
// In server component or API route
const country = request.headers.get('x-vercel-ip-country') || 'AE';
const currency = countryToCurrency(country); // e.g., 'US' → 'USD', 'AE' → 'AED'
```
NO external API calls (no ipapi.co or similar). Free, reliable, zero dependencies. User can override in onboarding form if wrong.

### Self-delete flow (handles ON DELETE RESTRICT correctly)
`model_listing_payments` and `model_wish_payments` use `ON DELETE RESTRICT` on their FK to `model_profiles`. This means deleting an ambassador with any payment history fails at the DB level.

**Self-delete flow:**
1. User clicks "Delete my account" in Settings
2. API checks: `SELECT COUNT(*) FROM model_listing_payments WHERE model_id = ? UNION ALL SELECT COUNT(*) FROM model_wish_payments WHERE model_id = ?`
3. If ANY payments exist (including `pending`, `completed`, `refunded`):
   - Block deletion
   - Return error: `"Cannot delete account — you have payment history. Please contact support at hello@welovedecode.com to proceed."`
4. If NO payments exist:
   - CASCADE delete flows automatically via FK on: `model_listings`, `model_wishes`, `model_analytics_events`, `model_payouts`
   - Then delete `model_profiles` row
   - Then delete `auth.users` (which CASCADES to `public.users` via existing trigger)

**Do NOT change `ON DELETE RESTRICT` to CASCADE.** Payment history must be preserved for financial audit.

### Reserved slugs (comprehensive list)
Block these at signup + in `[slug]/page.tsx` 404 check:
```
admin, login, signup, api, settings, dashboard, model, auth,
register, pay, payment, offers, auctions, profile, terms, privacy,
expired, listing, wish, bank-account, debug, verify-email,
pending-approval, my-links, www, app, mail, about, contact, help,
support, blog, press, jobs, careers, faq, home, welovedecode
```

Case-insensitive comparison. If user submits "Admin" → block.

---

## 🚦 Routing & layouts

### Route group structure

```
app/
├── (ambassador)/                    ← New ambassador feature, isolated
│   ├── layout.tsx               ← Lean DECODE layout (dark theme, mobile-first)
│   ├── [slug]/                  ← Public page (uses parent layout)
│   │   ├── page.tsx
│   │   ├── listing/
│   │   │   └── [token]/page.tsx
│   │   └── wish/
│   │       └── [token]/page.tsx
│   ├── model/                   ← Logged-in ambassador app
│   │   ├── layout.tsx           ← Auth-required layout
│   │   ├── page.tsx             ← Dashboard
│   │   ├── auth/
│   │   ├── setup/
│   │   ├── listings/
│   │   ├── wishlist/
│   │   ├── analytics/
│   │   ├── payouts/
│   │   └── settings/
│   ├── listing/
│   │   ├── confirmation/[pi_xxx]/page.tsx
│   │   └── paid/page.tsx
│   ├── wish/
│   │   ├── confirmation/[pi_xxx]/page.tsx
│   │   └── taken/page.tsx
│   ├── expired/page.tsx
│   ├── terms/page.tsx           ← Static
│   ├── privacy/page.tsx         ← Static
│   └── not-found.tsx            ← 404 catch-all
│
├── (legacy)/                    ← Existing app — DO NOT TOUCH
│   ├── layout.tsx               ← Existing legacy layout
│   ├── auctions/
│   ├── offers/
│   └── ... (whatever exists)
│
└── api/
    ├── webhooks/
    │   └── ambassador-stripe/route.ts  ← NEW endpoint
    ├── (ambassador)/                ← New API routes
    │   ├── model/...
    │   ├── checkout/...
    │   └── analytics/...
    └── (legacy)/                ← Existing API routes — DO NOT TOUCH
```

### Auth guard middleware

```typescript
// app/(ambassador)/model/layout.tsx
export default async function ModelLayout({ children }) {
  const session = await getServerSession();

  // Public routes within /model/* (auth pages)
  const publicPaths = ['/model/auth', '/model/setup'];
  if (!session && !publicPaths.some(p => pathname.startsWith(p))) {
    redirect('/model/auth');
  }

  // Logged-in user without profile → onboarding
  if (session) {
    const { data: profile } = await supabase
      .from('model_profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!profile && !pathname.startsWith('/model/setup') && !pathname.startsWith('/model/auth')) {
      redirect('/model/setup');
    }
  }

  return <DecodeShell>{children}</DecodeShell>;
}
```

---

## 🎨 HTML mockup integration

For each page, find the corresponding `*_final.html` in `/design/source-html/`:

1. **Read the file fully** (don't skip the comments — they document business logic)
2. **Read the matching `*_UI_Spec.md`** for behavior details
3. **Apply cleanup rules** per master doc Phase 12 #20:
   - KEEP all HTML structure, inline CSS, JS logic, regex, validation
   - REMOVE mockup data (Sara Johnson, sample arrays, demo functions)
   - REMOVE `applyDemoMode()`, `?demo=*` URL handling
   - REPLACE hardcoded data with API calls
4. **Convert to React component** (Next.js App Router page or component)
5. **Apply skeleton loading** per master doc Phase 12 #24
6. **Verify against UI spec checklist** at the bottom of each spec file

---

## 🧪 Testing — embedded in slices

Each slice above has its own `✅ VERIFY before next slice` checklist. Do not proceed past a slice until every box is checked. Test in production-like conditions (Vercel preview deploy, real Stripe test mode, real Supabase database) — not just `npm run dev`.

---

## 🔑 Environment variables

### ✅ Already in Vercel (REUSE — don't recreate)

These are already configured for the legacy app. Ambassador feature reuses them:

| Variable | Used by Ambassador feature? |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes — same Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes — client-side Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes — server-side admin ops |
| `STRIPE_SECRET_KEY` | ✅ Yes — same Stripe account |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ Yes — same Stripe frontend |
| `STRIPE_ENVIRONMENT` | ✅ Yes — test/live toggle |
| `STRIPE_WEBHOOK_SECRET` | ❌ NO — that's for legacy webhook endpoint only. Ambassador uses a NEW webhook with its own secret (below) |
| `AUTHKEY_API_KEY` | ✅ Yes — same WhatsApp OTP service |
| `API_ENDPOINT` | ⚠️ Depends — check how legacy uses it; likely reused |
| `LAMBDA_AUCTION_CLOSER_ARN` | ❌ Legacy only |
| `EVENTBRIDGE_ROLE_ARN` | ❌ Legacy only |
| `EVENTBRIDGE_SCHEDULE_GROUP` | ❌ Legacy only |

### 🆕 NEW variables to add for Ambassador feature

Add these to Vercel before deploying Slice 4 (first slice that uses them):

| Variable | Purpose | How to get it |
|---|---|---|
| `STRIPE_AMBASSADOR_WEBHOOK_SECRET` | Signs the NEW webhook endpoint `/api/webhooks/ambassador-stripe` | Stripe Dashboard → Developers → Webhooks → Add endpoint → URL = `https://app.welovedecode.com/api/webhooks/ambassador-stripe` → select events (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`) → copy signing secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile client-side widget | Cloudflare Dashboard → Turnstile → Add site (free) → copy site key |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side verification | Same Cloudflare Turnstile page → copy secret key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint (rate limiting backend) | upstash.com → Create Redis database → Details → copy REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token | Same Upstash database details page → copy REST token |
| `RESEND_API_KEY` | Email delivery service for 3 custom templates | resend.com → sign up → verify `welovedecode.com` domain → API keys → create key |
| `AUTHKEY_WID_LISTING_PAID` | AUTHKey template ID for "listing paid" WhatsApp | AUTHKey dashboard → create UTILITY template → submit to Meta → copy wid after approval |
| `AUTHKEY_WID_WISH_GIFTED` | AUTHKey template ID for "wish gifted" WhatsApp | Same as above |
| `AUTHKEY_WID_LISTING_EXPIRING_AMB` | AUTHKey template ID for ambassador expiring reminder | Same as above |
| `AUTHKEY_WID_LISTING_EXPIRING_PRO` | AUTHKey template ID for professional expiring reminder | Same as above |

**Total new env vars: 10.** Everything else reuses legacy.

**Deployment order:** Set up Turnstile + Upstash + Stripe webhook BEFORE Slice 4 (Resend is already deployed from Slice 1.5). AUTHKey template IDs can be added later (Slice 4 for listing paid; Slice 5 for wish gifted; Slice 7 for expiring reminders).

### Where to reference them in code

```typescript
// Stripe webhook handler (app/api/webhooks/ambassador-stripe/route.ts)
event = stripe.webhooks.constructEvent(
  body, sig,
  process.env.STRIPE_AMBASSADOR_WEBHOOK_SECRET!  // NEW — not STRIPE_WEBHOOK_SECRET
);

// Turnstile server-side verification
const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  body: JSON.stringify({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: turnstileToken
  })
});

// Turnstile client-side widget (React component)
<Turnstile sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} />
```

---

## 🔄 Pull-to-refresh pattern (LOCKED — no realtime)

V1 uses **pull-to-refresh** for updates on data-fetching pages instead of WebSocket realtime. This is the standard mobile app pattern (Twitter, Instagram, Gmail).

### Where it applies

All ambassador data-fetching pages:
- `/model` (Dashboard)
- `/model/listings`
- `/model/wishlist`
- `/model/analytics`
- `/model/payouts`

Also on public page `/{slug}` (visitor can refresh to see latest Wall of Love entries).

### How it works

User pulls down at top of page on mobile → spinner appears → data refetches → spinner fades, fresh data shows.

### Implementation

Use a standard library like `react-pull-to-refresh` or implement natively with a `touchstart` + `touchmove` listener:

```tsx
import PullToRefresh from 'react-simple-pull-to-refresh';

<PullToRefresh onRefresh={async () => { await refetchData(); }}>
  <div>{/* page content */}</div>
</PullToRefresh>
```

For desktop: small refresh icon in header that triggers the same `refetchData()` function. Simple, consistent.

### Future upgrade path

If you want realtime later (V2+), replace `refetchData()` with a Supabase realtime subscription. No architecture change needed.

---

## 📋 Reference files (in `/design/`)

All HTML mockups + UI specs from earlier chat work. Key files referenced throughout:

**Master:** `DECODE_PROJECT_STATE.md`

**HTMLs (in `/design/source-html/`):**
- All 21 `*_final.html` files
- Plus support pages: `not_found_final.html`, `email_error_final.html`, `payouts_list_final.html`, `payout_statement_final.html`, `terms_final.html`, `privacy_final.html`, `listing_paid_final.html`

**UI Specs (in `/design/ui-specs/`):**
- All `*_UI_Spec.md` files matching the HTMLs

**Architecture:** `Current_App_Architecture_2026-04-04.docx`

**Legal text:** `terms_upload.docx`, `privacy_upload.docx`

---

## ⚠️ Common mistakes to avoid

1. **Don't create a new Supabase client** — import the existing one
2. **Don't add password authentication** — only magic link + WhatsApp OTP
3. **Don't use Stripe Checkout (hosted page)** — use Payment Intents + Elements (custom modal)
4. **Don't recalculate platform fee on display** — it's stored at payment time, immutable
5. **Don't touch the legacy app** — auctions, offers, pay pages stay as-is
6. **Don't aggressively strip HTML** — keep validation regex, business logic comments
7. **Don't create staggered card animations** — render data instantly when fetched
8. **Don't poll forever** — max 5 retries (5 sec) on webhook receipt pages
9. **Don't fetch in waterfalls** — use Promise.all for parallel fetches
10. **Don't forget metadata.feature='ambassador'** on all PaymentIntents — webhook isolation depends on it
11. **Don't throw generic 500 on duplicate Instagram** — catch Postgres error code `23505` (unique violation) on `model_professionals.instagram_handle` INSERT and return a friendly UI message: "This Instagram is already linked to {existing.name}. Use that one instead?"
12. **Don't skip Cloudflare Turnstile** on checkout pages — without it, bots can lock every wish on the platform for 10 minutes
13. **Don't rely solely on RLS** — API routes must ALSO verify `model_id` belongs to `auth.uid()` server-side. Belt + suspenders.
14. **Don't trust Stripe metadata blindly** — webhook handler must fetch the PaymentIntent from Stripe and verify `metadata.listing_id` / `metadata.wish_id` matches the DB payment row you created earlier.
15. **Don't accept arbitrary file uploads** — server-side MIME whitelist: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`, `video/webm`. Reject everything else.
16. **Don't skip Origin header validation** on API routes — validate `req.headers.origin` matches your domain. Prevents cross-origin abuse.
17. **Don't trust frontend validation** — always re-validate required fields server-side. Frontend can be bypassed.
18. **Don't spam analytics** — IP hash dedup: max 1 event per IP per event_type per 30 seconds. Prevents bloat.
19. **Don't read from raw tables for wishes/listings in the UI** — use `model_wishes_live` and `model_listings_live` views so `effective_status` is always correct.
20. **Don't dedupe `auth.users` by email** — phone is the authoritative identity for WhatsApp users. Dedupe by phone via `admin.listUsers` or (post-scale) via RPC. Never rely on synthetic email collision. Slice 1.5 bug.
21. **Don't use `supabase.auth.updateUser({ email })` for user-facing email changes** — that triggers Supabase's built-in email with dashboard template. Use `admin.updateUserById` server-side + opaque DB token + direct Resend. Matches `send-magic-link/route.ts` pattern. Slice 1.5 rearchitecture.
22. **Don't use `admin.generateLink` for cross-browser confirmations** — PKCE-bound, fails when user clicks from a different browser than they requested from. Use opaque DB-owned tokens in `email_change_requests` style table. Slice 1.5 bug.
23. **Don't write to `auth.users` without also writing to `public.users` in the same code path** — FK violations appear downstream. Shadow-ensure in callback is a net, not a primary pairing. Slice 1.5 bug.
24. **Don't position content at `bottom:<60px` inside full-height mobile pages** — iOS Safari's bottom toolbar overlays the lower ~55px. Use `env(safe-area-inset-bottom)` + 56px clearance on mobile, set `viewport-fit=cover` in the route group layout. Auth pages bug.

---

## 🗺️ Post-V1 Roadmap — what's deliberately deferred

The following are KNOWN gaps — intentionally left out of V1 scope. Claude Code should NOT implement these, but should leave clean `// TODO: Post-V1` markers where rate-limiting integrations slot in later.

### Priority 1 — Bundle together after V1 launch

These two ship as a single post-launch package (~4-6 hours of work total):

| Item | Purpose | Trigger |
|---|---|---|
| **Admin dashboard** | UI pages for admin to: create payouts, mark as paid, suspend ambassadors (toggle `is_suspended`), view system state | First payout Wednesday OR first fraud case |
| **Sentry** (error tracking) | Automatic capture of production errors with stack traces, user context, replay. Free tier: 5K errors/month | Bundle with admin dashboard |

### Priority 2 — Scale triggers

Add these when business reality demands:

| Item | Purpose | Trigger |
|---|---|---|
| **Supabase Pro upgrade** | Daily backups + 7-day retention. Critical before real customer data exists | First real paying customer |
| **Realtime updates** | Replace pull-to-refresh with Supabase realtime subscriptions on Dashboard/Analytics | 20+ active ambassadors, or users request it |
| **Cloudflare Stream** (video transcoding) | Auto-convert HEVC → H.264 for Firefox/Android playback. Cost: ~$10/mo minimum | If visitor complaints about black video players arise |
| **Apex domain migration** | Move `welovedecode.com` from Carrd to Vercel (currently `app.welovedecode.com` only). Relative paths already used so migration is trivial | Marketing decision / SEO strategy |

### Priority 3 — Marketplace maturity

| Item | Purpose | Trigger |
|---|---|---|
| **PayPal payouts** | Alternative to bank transfer (already in locked decisions as V2) | Ambassadors in markets where bank transfers are harder |
| **Stripe Connect migration** | Automated per-ambassador payouts, KYC handling, per-country compliance. Replaces manual Wednesday payouts | ~50 active ambassadors (manual payouts become too much work) |
| **Customer support tool** (Intercom or Crisp) | Embedded chat widget for ambassadors/gifters to ask questions | When users start asking questions / support volume grows |

### NOT on the roadmap (explicitly decided against for V1 and beyond unless need changes)

- Password authentication (magic link + WhatsApp only)
- Stripe Checkout hosted pages (using custom modal with Payment Intents)
- Cryptocurrency / Crossmint
- Soft delete (hard delete is intentional)
- Currency change in Settings (locked at signup)

### Rate limiting implementation (Upstash Redis — now V1)

Use `@upstash/ratelimit` package with the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Per-endpoint rate limiter configs
const checkoutLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '10 m'),  // 3 attempts per 10 min per IP
});

const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),  // 3 OTPs per hour per phone
});

// Usage in API route
const ip = req.headers.get('x-forwarded-for') || 'anon';
const { success } = await checkoutLimiter.limit(`checkout:${ip}`);
if (!success) {
  return new Response('Too many attempts', { status: 429 });
}
```

**Rate limits to enforce:**
- Wish checkout: 3 per IP per 10 min
- OTP send (WhatsApp): 3 per phone per hour + 10 per IP per hour
- Magic link send (email): 3 per email per hour
- Listing creation: 20 per user per hour
- Analytics events: 1 per IP per event_type per 30 sec

---

## 🎯 Success criteria

The implementation is complete when:

- [ ] All 28 routes work end-to-end
- [ ] An ambassador can sign up via WhatsApp, complete onboarding, create listings, share payment links, receive payments, and get a payout
- [ ] A professional can pay via Stripe modal and see their receipt
- [ ] A gifter can pay for a wish and appear on Wall of Love
- [ ] Race condition: 2 simultaneous wish gift attempts → only 1 succeeds, other sees /wish/taken
- [ ] Trial converts to paid correctly (period stacked, not absorbed)
- [ ] Refunds via Stripe Dashboard reflect in app within 1 minute
- [ ] Bundle sizes meet targets (~120KB ambassador, ~250KB analytics)
- [ ] No console errors, no broken images, no layout shifts
- [ ] Old app (auctions/offers) still works untouched

---

## 🤝 Handoff complete

This brief, the master doc (`DECODE_PROJECT_STATE.md`), and the design files together contain everything needed.

**Build in stage order. Test after each stage. Reference master doc when uncertain.**

If the master doc and this brief contradict → master doc wins.
If the user asks for something not covered → ask before assuming.

Good luck.
