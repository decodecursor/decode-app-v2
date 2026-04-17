# Auth Page — UI Spec (Final, with Navigation)

**File:** `auth_page_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/auth`
**Access:** Public — entry point for sign-in and sign-up
**Design Philosophy:** Ultramodern, restrained, typography-led.

---

## 1. Purpose

A single page that lets a visitor start sign-in or sign-up via either WhatsApp (phone) or magic-link (email). One screen, two paths, no clutter.

---

## 2. Entry Point

- **From:** Landing page CTA button → routes user to dedicated `/auth` URL.
- The `/auth` URL is the only public entry point to this screen. No deep links from email/SMS land here.

---

## 3. Layout Structure

Single-column mobile page (375px width, 760px min-height). Top to bottom:

1. Status bar — `9:41` placeholder
2. Eyebrow — `SHOW YOUR BEAUTY SQUAD` (10px / 700 / `#888`, 3px letter-spacing, **margin-bottom: 10px**)
3. Wordmark — `WeLoveDecode` (32px / 800 white, margin-bottom: 18px)
4. Subline — `Enter your number or email` (11px / `#666`, margin-bottom: 24px)
5. Pink accent line — 40px × 1.5px `#e91e8c`, animates scaleX 0→1 over 1s
6. Phone row (country button + phone input) — 48px gap from accent line
7. WhatsApp continue button
8. OR divider
9. Email input
10. Email continue button
11. Legal footer — absolutely positioned at bottom, 20px from bottom edge

Country picker is a separate full-screen overlay that slides over the auth screen when the country button is tapped.

---

## 4. Color System

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Accent line, focused borders, active button bg/border |
| White | `#fff` | Wordmark, input text, active button labels |
| Gray 888 | `#888` | Eyebrow, status bar, chevron, picker section labels |
| Gray 666 | `#666` | Subline, OR divider |
| Gray 555 | `#555` | Inactive labels, placeholders, legal footer text |
| Gray 2a2a2a | `#2a2a2a` | Default input/button borders |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Black | `#000` | Page background |
| Green 4ade80 | `#4ade80` | Toast success state |

---

## 5. Typography

All `system-ui, -apple-system, sans-serif`.

| Element | Size | Weight | Color |
|---|---|---|---|
| Wordmark | 32px | 800 | `#fff` |
| Picker title | 18px | 700 | `#fff` |
| Input text | 15px | 400 | `#fff` |
| Country dial / search | 14px | 600/400 | `#fff` |
| Continue buttons | 14px | 600 | `#555` → `#fff` active |
| Subline | 11px | 400 | `#666` |
| OR divider | 11px | 600 | `#666` |
| Eyebrow / section labels | 10px | 700 | `#888` |
| Legal footer | 9px | 400 | `#555` |

---

## 6. Navigation & Triggers (FULL MAP — for Claude Code build)

### 6.1 Entry points

| Source | Trigger | Destination |
|---|---|---|
| Landing page CTA button | Tap | `/auth` (this page) |

### 6.2 In-page interactions

| Element | Action | Result / Trigger |
|---|---|---|
| Country button | Tap | Opens picker overlay (full-screen, in-page) |
| Picker back arrow | Tap | Closes picker, returns to `/auth` |
| Picker country row | Tap | Updates dial code + placeholder mask, resets phone input, closes picker |
| Picker search | Type 1 letter | Auto-scroll to A–Z section |
| Picker search | Type 2+ chars | Filter list |
| Phone input | Type | Live format mask + WhatsApp button state update |
| Email input | Type | Email button state update on `@` presence |

### 6.3 WhatsApp button (active) — backend trigger

- **Trigger:** `POST` to **AUTHKey API** (existing integration in app)
- **Payload:** `{ dial_code, phone_number }`
- **Backend action:** AUTHKey sends WhatsApp message containing one-time login/register code to the user's WhatsApp number
- **Frontend action:** Toast confirms "Sending WhatsApp code to {dial} {number}" (green), then routes to:
- **Exit:** `auth_whatsapp_code_verify_final.html` (existing dedicated code-entry page)
- **After successful code verify:** dedicated post-verify page (existing in app)

### 6.4 WhatsApp button (inactive)

- **Trigger:** none
- **Frontend:** Toast "Enter a valid phone number" (white). No navigation.

### 6.5 Email button (active) — backend trigger

- **Trigger:** `POST` to **Supabase Auth** magic-link endpoint
- **Payload:** `{ email }`
- **Backend action:** Supabase generates and emails the magic-link register/login URL
- **Frontend action:** Toast confirms "Sending magic link to {email}" (green), then routes to:
- **Exit:** `auth_magic_link_sent_final.html` (existing dedicated "check your email" page)
- **After user clicks link in email:** Supabase verifies and routes to dedicated post-verify page (existing in app)

### 6.6 Email button (inactive)

- **Trigger:** none
- **Frontend:** Toast "Enter a valid email" (white). No navigation.

### 6.7 Legal footer

| Link | Destination | Behavior |
|---|---|---|
| Terms | `https://welovedecode.com/#terms` | Opens in new tab (`target="_blank"`) |
| Privacy Policy | `https://welovedecode.com/#privacy` | Opens in new tab (`target="_blank"`) |

---

## 7. Phone Row Specs

- Country button: 1.5px `#2a2a2a` border, 12px radius, height 52px, padding `0 14px`. Contains flag (18px) + dial code (14px / 600) + chevron (`#888`, 11×11).
- Phone input: flex:1, height 52px, 1.5px `#2a2a2a` → `#e91e8c` on focus. Country-specific format mask applied live.

---

## 8. WhatsApp Button States

| State | Trigger | Border | Background | Label |
|---|---|---|---|---|
| Inactive | Phone < 6 digits | `#2a2a2a` | transparent | `#555` |
| Active | Phone ≥ 6 digits | `#e91e8c` | `#e91e8c` | `#fff` |

The 6-digit floor is a safe minimum; backend validates exact length per country.

---

## 9. Email Button States

| State | Trigger | Border | Background | Label |
|---|---|---|---|---|
| Inactive | No `@` in input | `#2a2a2a` | transparent | `#555` |
| Active | Input contains `@` | `#e91e8c` | `#e91e8c` | `#fff` |

The `@` check is minimum-viable; Supabase performs full validation.

---

## 10. Country Picker Overlay

- Full-screen `position:absolute;inset:0`, `z-index:10`, black background
- Header: status bar + back arrow + "Select country" (18px / 700)
- Search input: 48px tall, magnifying glass icon, placeholder "Search country or code"
- Country list rendering modes:
  - Empty search → POPULAR (UAE, US, UK) + A–Z sections
  - 1 letter → full list, auto-scrolled to that letter
  - 2+ chars → filtered alphabetical list
- Each row: flag (24px) + name (15px white) + dial code (14px `#888`)

---

## 11. Toast

- Position: absolute, `bottom:60px`, centered, `z-index:20`
- Style: `rgba(28,28,28,0.95)` bg, 1px `#333` border, white text, 10×18px padding, 24px radius
- Success state: `#4ade80` text + border
- Duration: 1.8s with 0.2s fade

---

## 12. Spacing System

| Gap | Value |
|---|---|
| Status bar → eyebrow | 64px |
| Eyebrow → wordmark | **10px** |
| Wordmark → subline | 18px |
| Subline → accent line | 24px |
| Accent line → phone row | 48px |
| Phone row → WhatsApp button | 12px |
| WhatsApp button → OR | 28px |
| OR → email input | 28px |
| Email input → email button | 12px |
| Legal footer → bottom | 20px |

---

## 13. Files

- `auth_page_final.html` — interactive mockup, legal links wired to live URLs
- `auth_page_final_UI_Spec.md` — this document

---

## 14. Build Notes for Claude Code

- WhatsApp send: integrate with existing **AUTHKey** service in the app. Endpoint and auth credentials already configured.
- Magic-link send: integrate with existing **Supabase Auth** in the app. Supabase project already configured.
- Both post-action destinations are existing pages — no new routes to build.
- Legal links go to live external anchors on the marketing site.
- Inactive buttons trigger toast only; no API call, no navigation.
