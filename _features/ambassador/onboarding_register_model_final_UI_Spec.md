# Onboarding (`/register/model`) — UI Spec (Final, with Navigation + Triggers)

**File:** `onboarding_register_model_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/register/model` — shown after a NEW user verifies via WhatsApp code or magic link
**Access:** New users only (`is_registered: false` from auth verification)

---

## 1. Purpose

Final step of sign-up. Collects minimum fields to make a new ambassador's public page complete on day one: cover photo, name, page URL, Instagram, currency. On submit, animates `Set up → Live` and redirects to dashboard with first-visit greeting.

---

## 2. Entry Point

- **From WhatsApp verify page:** if `is_registered: false` after AUTHKey verify
- **From magic link:** if `is_registered: false` after Supabase verify (opens in new tab from email)
- **No other entry path.** Returning users skip this and go straight to dashboard.

---

## 3. Layout

1. ~~Status bar~~ — **REMOVED** (real device status bar handles time/battery)
2. Progress tracker — Verify ✓ → Set up (active) → Live
3. Hero — `You're almost live!` / `Let's set up your page` (4px gap between)
4. Cover photo — upload + drag-to-reposition
5. First name + Last name (side by side)
6. Page URL — `welovedecode.com/` prefix + slug, live availability check
7. Instagram — no `@`, cleaned input
8. Currency — auto-detected via IP geolocation, tappable picker
9. Go live CTA

**No back button.** Onboarding is forward-only.

---

## 4. Data Persistence

- **No auto-save while typing.** Standard form behavior — data is held in JS state only
- **Batch save on Go live tap** — all fields POSTed to Supabase in one request
- **No session storage.** If user closes/refreshes mid-onboarding, they restart from scratch
- This is the simpler, more predictable model — no draft state to manage in DB

---

## 5. Cover Photo

- **Upload trigger:** tap → native file picker (`accept="image/*"`)
- **Storage:** **Supabase Storage bucket** — Claude Code to choose appropriate bucket name (suggested: `cover-photos` or `ambassador-covers`). Upload happens **on Go live tap**, not on selection (consistent with batch-save model).
- **Drag behavior:** vertical reposition, mouse + touch, stores `coverY` percentage (0–100)
- **"Drag to reposition" pill:** visible while dragging, fades out 1s after drag ends, reappears on next drag

---

## 6. Page URL — Availability Check

- **Mockup:** checks against hardcoded `TAKEN` array
- **Production:** real Supabase query (marked with `// PRODUCTION:` comment in code):
  ```js
  const { data } = await supabase
    .from('users')
    .select('slug')
    .eq('slug', query)
    .maybeSingle();
  ```
- **Server-side RESERVED list** required (admin, login, signup, api, settings, dashboard, etc.) so users can't claim system routes
- **Click anywhere in the URL field** (including `welovedecode.com/` prefix) focuses the input

---

## 7. Currency Picker — Country-Style Layout

Restructured to mirror the country picker on `/auth`:

### 7.1 Display

| Section | Behavior |
|---|---|
| Empty search | **POPULAR** section first (USD, EUR, AED), then **A–Z** sections with letter headers |
| Search active | Filtered flat list (no sections) |

### 7.2 Row format

`🇦🇪 AED · UAE Dirham · Ⓓ` — flag, ISO, name, separator, symbol (white, only for the 4 currencies that have a symbol defined)

### 7.3 Symbols defined

Only on 4 currencies:
- USD → `$`
- EUR → `€`
- GBP → `£`
- AED → **inline SVG** of the official UAE Central Bank Dirham symbol (until Unicode 18.0 / U+20C3 ships in fonts in late 2026)

### 7.4 Selected state

- Selected row: text stays **white** (not pink)
- Pink ✓ checkmark on the right edge

### 7.5 Auto-detect on first load

- **Production:** call IP geolocation API on page load to pre-select user's local currency
- Suggested service: Cloudflare's `cf-ipcountry` header (free, server-side) or `ipapi.co` (client-side)
- Fallback: **AED** (UAE-first business)

### 7.6 Currency selector trigger row

Shows: `🇦🇪 AED · Ⓓ` — flag, ISO code, dot, symbol — vertically centered, all aligned

---

## 8. Go Live CTA

| State | Trigger | Background | Border | Label |
|---|---|---|---|---|
| Disabled | Form invalid | `#1c1c1c` | `#262626` | `#555` "Go live" |
| Ready | Form valid | `#e91e8c` | `#e91e8c` | `#fff` "Go live" |
| Working | Tap | `#e91e8c` | `#e91e8c` | `#fff` "Going live…" |
| Success | After 900ms | **`#e91e8c`** | **`#e91e8c`** | **`#fff` "You're live!"** |

Success state is **pink** (matching WhatsApp verify page convention — green is reserved for Resend "Sent!" only).

---

## 9. Navigation & Triggers (FULL MAP)

### 9.1 Entry

| Source | Condition | Destination |
|---|---|---|
| WhatsApp verify page | `is_registered: false` | `/register/model` (this page) |
| Magic link click (in email) | `is_registered: false` | `/register/model` (in new tab) |

### 9.2 In-page interactions

| Element | Action | Result / Trigger |
|---|---|---|
| Cover (empty) | Tap | Native file picker |
| Cover (with image) | Drag vertically | Repositions image, stores `coverY` |
| First / Last name | Type | Auto-capitalize, auto-fill URL slug if not edited |
| Page URL field (anywhere) | Click | Focus input |
| Page URL | Type | Strip invalid chars, debounced **Supabase availability check** |
| Instagram | Type | Strip `@` and invalid chars |
| Currency trigger row | Tap | Open currency picker sheet |
| Picker search | Type | Filter list (POPULAR + A-Z when empty, flat when searching) |
| Picker row | Tap | Select currency, close sheet |
| Picker backdrop / ✕ | Tap | Close sheet |

### 9.3 Go Live (full sequence)

| Step | Trigger | Duration |
|---|---|---|
| 1. Tap Go live (ready state) | User action | — |
| 2. "Going live…" pink button | Immediate | 900ms |
| 3. Stepper advances to terminal "Live" state | Auto | — |
| 4. "You're live!" pink success button | Immediate | 450ms dwell |
| 5. **Batch POST to Supabase** | Auto | — |
| 6. **Cover photo upload to Supabase Storage** | Auto | — |
| 7. **Set `users.first_dashboard_seen_at = now()`** | Auto | — |
| 8. **Redirect to dashboard** (URL TBD) | Auto | — |

### 9.4 Dashboard greeting

- The `first_dashboard_seen_at` timestamp triggers the **"Sara, you're live! 🎉"** greeting on first dashboard load
- Dashboard URL: **TBD** — to be provided

---

## 10. Build Notes for Claude Code

### 10.1 Supabase integration points

| Trigger | Endpoint | Notes |
|---|---|---|
| URL availability check | Supabase query on `users.slug` | Debounced 450ms, also enforce server-side RESERVED list |
| Currency auto-detect | IP geolocation on page load | Cloudflare header or ipapi, fallback AED |
| Cover photo upload | Supabase Storage bucket | Claude to name (suggested: `cover-photos` or `ambassador-covers`). Upload on Go live tap. |
| User data save | INSERT into `users` table | Batch on Go live tap |
| First-visit flag | Set `users.first_dashboard_seen_at = now()` | Triggers dashboard greeting |
| Redirect | `window.location.href = '<dashboard URL>'` | URL TBD |

### 10.2 Removed elements

- Status bar (time + battery emulation) — real device handles this
- No back button — onboarding is forward-only
- No session/draft persistence — restart on refresh

### 10.3 Comments in code

All Supabase integration points are marked with `// PRODUCTION:` comment blocks showing the exact code to swap in.

---

## 11. Validation Summary

| Field | Rule |
|---|---|
| First name | Required, auto-capitalized, letters only |
| Last name | Required, auto-capitalized, letters only |
| Page URL | Required, 3–30 chars, `[a-z0-9._-]`, Supabase availability check |
| Instagram | Required, `[a-zA-Z0-9._]`, leading `@` stripped |
| Currency | Auto-detected from IP, always valid |
| Cover photo | Optional at this step (can be added later from Settings) |

---

## 12. Files

- `onboarding_register_model_final.html` — interactive mockup
- `onboarding_register_model_final_UI_Spec.md` — this document
