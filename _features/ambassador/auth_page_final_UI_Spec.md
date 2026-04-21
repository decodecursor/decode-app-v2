# Auth Page — UI Spec

**File:** `auth_page_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/model/auth`
**Access:** Public — primary entry point for sign-in and sign-up
**Design Philosophy:** Ultramodern, restrained, typography-led.
**Auth Primacy:** WhatsApp is the primary method. Email is a secondary fallback.

---

## 1. Purpose

Primary sign-in/sign-up page. User enters phone number, taps "Continue with WhatsApp", receives OTP via WhatsApp (via AUTHKey), verifies to enter the app. Users without WhatsApp use the fallback link to reach the dedicated email page.

---

## 2. Entry Point

- **From:** Landing page CTA button → routes to `/model/auth`
- **From:** Any route that redirects unauthenticated users (setup guard, dashboard guard, etc.)

---

## 3. Layout Structure

Single-column mobile page (375px width, 760px min-height). Top to bottom:

1. Eyebrow — `SHOW YOUR BEAUTY SQUAD` (10px / 700 / `#888`, 3px letter-spacing, margin-bottom: 10px)
2. Wordmark — `WeLoveDecode` (32px / 800 white, margin-bottom: 48px)
3. Pink accent line — 40px × 1.5px `#e91e8c`, animates scaleX 0→1 over 1s
4. Phone row (country button + phone input) — 48px gap from accent line
5. WhatsApp continue button
6. Fallback link — absolutely positioned at `bottom: 54px`: *"No WhatsApp? **Continue with email →**"*
7. Legal footer — absolutely positioned at `bottom: 20px`

**No status bar.** OS chrome renders the real status bar.

**No pretext copy.** The wordmark, accent line, and input placeholder are the whole visual identity. No "Enter your number" line.

Country picker is a separate full-screen overlay that slides over the auth screen when the country button is tapped.

---

## 4. Color System

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Accent line, focused borders, active button bg/border, fallback link accent, toast success border |
| White | `#fff` | Wordmark, input text, active button labels, all toast text |
| Gray 888 | `#888` | Eyebrow, chevron, picker section labels, fallback link base |
| Gray 666 | `#666` | Reserved (not used on this page after final) |
| Gray 555 | `#555` | Inactive labels, placeholders, legal footer text |
| Gray 2a2a2a | `#2a2a2a` | Default input/button borders |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Black | `#000` | Page background |

**No green anywhere.** Success states use pink accents.

---

## 5. Typography

All `system-ui, -apple-system, sans-serif`.

| Element | Size | Weight | Color |
|---|---|---|---|
| Wordmark | 32px | 800 | `#fff` |
| Picker title | 18px | 700 | `#fff` |
| Input text | 15px | 400 | `#fff` |
| Country dial / search | 14px | 600/400 | `#fff` |
| Continue button | 14px | 600 | `#555` → `#fff` active |
| Eyebrow / section labels | 10px | 700 | `#888` |
| Fallback link | 12px | 400 base / 600 on pink span | `#888` + `#e91e8c` |
| Legal footer | 9px | 400 | `#555` |

---

## 6. Navigation & Triggers

### 6.1 Entry points

| Source | Trigger | Destination |
|---|---|---|
| Landing page CTA | Tap | `/model/auth` (this page) |
| Any protected route | Unauthenticated redirect | `/model/auth` |

### 6.2 In-page interactions

| Element | Action | Result |
|---|---|---|
| Country button | Tap | Opens picker overlay (full-screen, in-page) |
| Picker back arrow | Tap | Closes picker, returns to `/model/auth` |
| Picker country row | Tap | Updates dial code + placeholder mask, resets phone input, closes picker |
| Picker search | Type 1 letter | Auto-scroll to A–Z section |
| Picker search | Type 2+ chars | Filter list |
| Phone input | Type | Live format mask + WhatsApp button state update |
| WhatsApp button (active) | Tap | Backend send → toast → route to verify page |
| WhatsApp button (inactive) | Tap | Toast only, no navigation |
| Fallback link | Tap | Navigate to `/model/auth/email` |

### 6.3 WhatsApp button (active) — backend trigger

- **Trigger:** `POST` to **AUTHKey API** (existing integration in app)
- **Payload:** `{ dial_code, phone_number }`
- **Backend action:** AUTHKey sends WhatsApp message containing one-time login/register code to the user's WhatsApp number
- **Frontend action:** Pink-accent toast `Sending WhatsApp code to {dial} {number}`, then routes to:
- **Exit:** `/model/auth/verify` — existing dedicated code-entry page
- **After successful code verify:** Dashboard `/model` (existing user) or setup `/model/setup` (new user). The verify page's callback handles this branching.

### 6.4 WhatsApp button (inactive)

- **Trigger:** none
- **Frontend:** White toast "Enter a valid phone number". No API call, no navigation.

### 6.5 Fallback link — "No WhatsApp? Continue with email →"

- **Trigger:** Tap
- **Destination:** `/model/auth/email`
- **Purpose:** Secondary path for users without WhatsApp. Dedicated email sign-in page.

### 6.6 Legal footer

| Link | Destination | Behavior |
|---|---|---|
| Terms | `https://welovedecode.com/#terms` | Opens in new tab (`target="_blank"`) |
| Privacy Policy | `https://welovedecode.com/#privacy` | Opens in new tab (`target="_blank"`) |

---

## 7. Phone Row Specs

- **Country button:** 1.5px `#2a2a2a` border, 12px radius, height 52px, padding `0 14px`. Contains flag (18px) + dial code (14px / 600) + chevron (`#888`, 11×11).
- **Phone input:** `flex:1`, `min-width:0` (critical for flexbox; otherwise input overflows on narrow viewports), height 52px, 1.5px `#2a2a2a` → `#e91e8c` on focus. Country-specific format mask applied live via `formatPhoneNumber(digits, dialCode)`.

---

## 8. WhatsApp Button States

| State | Trigger | Border | Background | Label |
|---|---|---|---|---|
| Inactive | Phone < 6 digits | `#2a2a2a` | transparent | `#555` |
| Active | Phone ≥ 6 digits | `#e91e8c` | `#e91e8c` | `#fff` |

The 6-digit floor is a safe activation minimum; AUTHKey / backend validates exact length per country.

---

## 9. Country Picker Overlay

- Full-screen `position:absolute;inset:0`, `z-index:10`, black background
- Header: back arrow + "Select country" (18px / 700), top padding 32px (accounts for OS status bar area)
- Search input: 48px tall, magnifying glass icon, placeholder "Search country or code"
- Country list rendering modes:
  - Empty search → POPULAR (UAE, US, UK) + A–Z sections
  - 1 letter → full list, auto-scrolled to that letter
  - 2+ chars → filtered alphabetical list
- Each row: flag (22px) + name (14px white) + dial code (13px `#888`)

---

## 10. Toast

- Position: absolute, `bottom:60px`, centered, `z-index:20`
- Style: `rgba(28,28,28,0.95)` bg, 1px `#333` border, white text, 10×18px padding, 24px radius
- Success state: pink border `#e91e8c` + white text
- Error state: grey border `#333` + white text
- Duration: 1.8s with 0.2s fade

---

## 11. Spacing System

| Gap | Value |
|---|---|
| Top of frame → eyebrow | 80px |
| Eyebrow → wordmark | 10px |
| Wordmark → accent line | 48px |
| Accent line → phone row | 48px |
| Phone row → WhatsApp button | 12px |
| WhatsApp button → fallback link | absolute position (bottom:54px desktop) |
| Fallback link → legal footer | absolute position (bottom:20px desktop) |

**Mobile (≤450px) safe-area offsets:**
- Fallback link: `bottom: calc(54px + env(safe-area-inset-bottom) + 56px)` — clears iOS Safari toolbar and home indicator. Desktop unchanged at `bottom:54px`.
- Legal footer: `bottom: calc(20px + env(safe-area-inset-bottom) + 56px)`. Desktop unchanged at `bottom:20px`.

Implemented via shared classes `.amb-auth-fallback-link` / `.amb-auth-legal-footer` defined in `app/(ambassador)/layout.tsx`. Requires `viewportFit: 'cover'` in the route-group viewport meta to activate `env(safe-area-inset-bottom)`.

---

## 12. Files

- `auth_page_final.html` — interactive mockup, all handlers working
- `auth_page_final_UI_Spec.md` — this document

---

## 13. Build Notes for Claude Code

- **WhatsApp send:** integrate with existing **AUTHKey** service. Endpoint and auth credentials already configured in Vercel env vars.
- **Email fallback link:** use Next.js `<Link href="/model/auth/email">` — full page navigation preferred so the layout guards run fresh.
- **Post-WhatsApp-verify destination:** branch server-side in `/model/auth/verify` callback: if `model_profiles` exists for `auth.users.id`, redirect to `/model`; otherwise redirect to `/model/setup`. Do NOT route to setup from this page directly.
- **Legal links** go to live external anchors on the marketing site.
- **Inactive button** triggers toast only; no API call, no navigation.
- **Phone formatter:** Mockup uses manual format masks for top 55 countries. Production: replace with `libphonenumber-js` or `react-phone-number-input` for full coverage + validation across all 190+ countries.
- **`min-width: 0` on the phone input** is critical in the flex row; without it, the input's intrinsic width prevents shrinking and causes horizontal overflow on narrow mobile viewports.
- **No green anywhere.** All "success" indicators use pink `#e91e8c`.
