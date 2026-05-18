# Auth Email Page — UI Spec

**File:** `auth_email_page_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/model/auth/email`
**Access:** Public — email fallback for users without WhatsApp
**Design Philosophy:** Ultramodern, restrained, typography-led. Mirrors main auth page.

---

## 1. Purpose

Secondary sign-in/sign-up path for users who don't have WhatsApp available (lost phone, different device, friend's laptop, no WhatsApp account). Sends a magic link via email using Supabase Auth.

---

## 2. Entry Point

- **From:** `/model/auth` via the bottom link *"No WhatsApp? **Continue with email →**"*
- No other direct entries. Users who land here always came from the WhatsApp primary page.

---

## 3. Layout Structure

Single-column mobile page (375px width, 760px min-height). Top to bottom:

1. Eyebrow — `SHOW YOUR BEAUTY SQUAD` (10px / 700 / `#888`, 3px letter-spacing, margin-bottom: 10px) — **same as `/model/auth`**
2. Wordmark — `WeLoveDecode` (32px / 800 white, margin-bottom: 48px) — **same as `/model/auth`**
3. Pink accent line — 40px × 1.5px `#e91e8c`, animates scaleX 0→1 over 1s — **same as `/model/auth`**
4. Email input (52px tall, full width, 1.5px `#2a2a2a` border → `#e91e8c` on focus)
5. Email continue button (52px tall, full width, state-managed)
6. Fallback link — absolutely positioned at `bottom: 54px`: *"**← Use WhatsApp** instead"*
7. Legal footer — absolutely positioned at `bottom: 20px`

**No status bar.** Consistent with final `/model/auth` — OS chrome renders the real status bar.

**No pretext copy between the wordmark and accent line.** Clean typography-led layout — wordmark + accent line are the whole visual identity above the input.

---

## 4. Color System

Same as `/model/auth`:

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Accent line, focused borders, active button bg/border, fallback link accent, toast success border |
| White | `#fff` | Wordmark, input text, active button labels, all toast text |
| Gray 888 | `#888` | Eyebrow, fallback link base text |
| Gray 666 | `#666` | Reserved (not used on this page) |
| Gray 555 | `#555` | Inactive labels, placeholders, legal footer text |
| Gray 2a2a2a | `#2a2a2a` | Default input/button borders |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Black | `#000` | Page background |

**No green.** Success states use pink accents.

---

## 5. Typography

Same as `/model/auth`. All `system-ui, -apple-system, sans-serif`.

| Element | Size | Weight | Color |
|---|---|---|---|
| Wordmark | 32px | 800 | `#fff` |
| Input text | 15px | 400 | `#fff` |
| Continue button | 14px | 600 | `#555` → `#fff` active |
| Eyebrow | 10px | 700 | `#888` |
| Fallback link | 12px | 400 base / 600 on pink span | `#888` + `#e91e8c` |
| Legal footer | 9px | 400 | `#555` |

---

## 6. Navigation & Triggers

### 6.1 Entry

| Source | Trigger | Destination |
|---|---|---|
| `/model/auth` | Tap on *"No WhatsApp? Continue with email →"* | `/model/auth/email` (this page) |

### 6.2 In-page interactions

| Element | Action | Result |
|---|---|---|
| Email input | Type | Live button state update based on `@` presence |
| Email input | Focus | Border changes to `#e91e8c` |
| Email input | Blur | Border returns to `#2a2a2a` |
| Continue button (active) | Tap | Backend send → toast → route to sent page |
| Continue button (inactive) | Tap | Toast only, no navigation |
| `← Use WhatsApp instead` link | Tap | Returns to `/model/auth` |

### 6.3 Continue button (active) — backend trigger

- **Trigger:** `POST` to **Supabase Auth** magic-link endpoint (existing integration)
- **Payload:** `{ email }`
- **Validation:** Client runs `isValidEmail()` (contains `@`, min 5 chars, has `.` after `@`, not ending in `.`). Supabase performs full RFC validation server-side.
- **Backend action:** Supabase generates and emails the magic-link register/login URL
- **Frontend action:** Pink-accent toast `Sending magic link to {email}`, then routes to:
- **Exit:** `auth_magic_link_email_sent_final.html` (existing dedicated "check your email" page)
- **After user clicks link in email:** Supabase verifies and routes to dedicated post-verify page (existing in app)

### 6.4 Continue button (inactive)

- **Trigger:** none
- **Frontend:** White toast "Enter a valid email". No API call, no navigation.

### 6.5 Fallback link — back to WhatsApp

- **Trigger:** Tap on `← Use WhatsApp instead`
- **Action:** Navigate back to `/model/auth` (WhatsApp primary). Preserve any browser history — user can also use device back gesture.

### 6.6 Legal footer

Same as `/model/auth`:

| Link | Destination | Behavior |
|---|---|---|
| Terms | `https://welovedecode.com/#terms` | Opens in new tab |
| Privacy Policy | `https://welovedecode.com/#privacy` | Opens in new tab |

---

## 7. Email Input Specs

- Full width, height 52px, 1.5px `#2a2a2a` → `#e91e8c` on focus
- 12px border radius
- Padding: `0 16px`
- Placeholder: `Email` (single word, `#555`)
- `autocomplete="email"` set for browser/OS autofill suggestions

---

## 8. Continue Button States

| State | Trigger | Border | Background | Label |
|---|---|---|---|---|
| Inactive | Input empty OR missing `@` | `#2a2a2a` | transparent | `#555` |
| Active | Input contains `@` | `#e91e8c` | `#e91e8c` | `#fff` |

The `@` check is minimum-viable activation; full validation runs on submit via `isValidEmail()`. Supabase handles authoritative validation.

---

## 9. Toast

Same spec as `/model/auth`:

- Position: absolute, `bottom:60px`, centered, `z-index:20`
- Style: `rgba(28,28,28,0.95)` bg, 1px `#333` border, white text, 10×18px padding, 24px radius
- Success state: pink border `#e91e8c` + white text (no green)
- Error state: grey border `#333` + white text
- Duration: 1.8s with 0.2s fade

---

## 10. Spacing System

| Gap | Value |
|---|---|
| Top of frame → eyebrow | 80px |
| Eyebrow → wordmark | 10px |
| Wordmark → accent line | 48px |
| Accent line → email input | 48px |
| Email input → continue button | 12px |
| Continue button → fallback link | absolute position (bottom:54px desktop) |
| Fallback link → legal footer | absolute position (bottom:20px desktop) |

**Mobile (≤450px) safe-area offsets:**
- Fallback link: `bottom: calc(54px + env(safe-area-inset-bottom) + 56px)` — clears iOS Safari toolbar and home indicator. Desktop unchanged at `bottom:54px`.
- Legal footer: `bottom: calc(20px + env(safe-area-inset-bottom) + 56px)`. Desktop unchanged at `bottom:20px`.

Implemented via shared classes `.amb-auth-fallback-link` / `.amb-auth-legal-footer` defined in `app/(ambassador)/layout.tsx`. Requires `viewportFit: 'cover'` in the route-group viewport meta to activate `env(safe-area-inset-bottom)`.

---

## 11. Files

- `auth_email_page_final.html` — interactive mockup, toast + button state + navigation stubs working
- `auth_email_page_final_UI_Spec.md` — this document

---

## 12. Build Notes for Claude Code

- Magic-link send: integrate with existing **Supabase Auth** in the app. Same endpoint and client used for the main auth page's email path — do not introduce a new integration.
- Post-action destination: `/model/auth/sent` is an existing page — no new route needed. Route on success after the toast animation begins.
- Fallback link: use Next.js `router.push('/model/auth')` or `<Link href="/model/auth">` — full page navigation preferred so the layout guards run fresh.
- Legal links go to live external anchors on the marketing site, same as main auth.
- Inactive button triggers toast only; no API call, no navigation.
- No password field anywhere on this page. Passwordless flow only.
- `autocomplete="email"` must be set on the input so mobile keyboards surface email suggestions and fill correctly.
