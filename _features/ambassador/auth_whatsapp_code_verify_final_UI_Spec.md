# WhatsApp Code Verify — UI Spec (Final, with Dynamic Data + Resend Cooldown)

**File:** `auth_whatsapp_code_verify_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** Shown after the user submits their phone number on `/auth` and taps Continue with WhatsApp
**Access:** Public — anyone who initiated sign-in with phone

---

## 1. Purpose

User entered their phone on `/auth`, AUTHKey sent a 6-digit WhatsApp code, now they enter it. This page confirms the number, accepts the code, verifies it, and routes to the post-verify destination.

---

## 2. Entry Point

- **From:** `/auth` page → Continue with WhatsApp button (active state)
- **URL contract:** the routing call must pass the phone number as a query parameter:
  - `auth_whatsapp_code_verify_final.html?phone=%2B971%2055%20846%202387`
  - URL-encoded; rendered raw inside the confirmation line

---

## 3. Dynamic Data Sources

| Field | Source | Behavior |
|---|---|---|
| Phone display (`#phoneLink`) | URL param `?phone=...` | Pulled on page load via `URLSearchParams`. Falls back to placeholder `+971 55 846 2387` only if param missing (mockup safety net — should never happen in production). |
| OTP code | User input | 6 separate inputs, auto-advance, paste-aware |
| Verification result | **AUTHKey API** | Production: POST entered code to AUTHKey verify endpoint. Mockup: any 6 digits succeed. |

---

## 4. Layout Structure

1. Status bar — `9:41`
2. Title — `Enter your code` (22px / 700)
3. Confirmation line — `We sent a code to {phone} on WhatsApp` (phone tappable to edit)
4. OTP row — 6 boxes
5. Verify button — idle/ready/verifying/success states
6. Progress stepper — Sent → Enter code → Done
7. Expiry — `Your code expires in 10 minutes`
8. Resend row — `Didn't receive it? Resend`

---

## 5. Color System

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | OTP focus/filled, Verify ready/verifying, stepper, Resend, caret |
| White | `#fff` | Title, OTP text, Verify label, checkmarks, phone inline |
| Gray 888 | `#888` | Body grey |
| Gray 777 | `#777` | Inactive stepper labels |
| Gray 555 | `#555` | Idle Verify label |
| Gray 3a3a3a | `#3a3a3a` | Dashed rail, future step border |
| Gray 262626 | `#262626` | Idle OTP border, idle Verify border |
| Gray 1c1c1c | `#1c1c1c` | Idle Verify background |
| Black | `#000` | Page bg, Verify text on success |
| Red ef4444 | `#ef4444` | OTP error state only |
| Green 4ade80 | `#4ade80` | Resend "Sent!" only (Verify success is pink) |

---

## 6. OTP Input Row

Six `<input>`, `gap:8px`, centered.

- 42 × 54px, 1.5px `#262626` border, 10px radius
- 22px / 700 white text, pink caret
- `inputmode="numeric"`, `autocomplete="one-time-code"` on first box (iOS auto-fill from WhatsApp)
- States: idle (`#262626`) / filled (`#e91e8c`) / error (`#ef4444`)
- Auto-advance on input, backspace-walks-back on empty
- Error: 450ms shake + clear all + refocus first box

---

## 7. Verify Button

| State | Background | Border | Label |
|---|---|---|---|
| Idle | `#1c1c1c` | `#262626` | `#555` "Verify" |
| Ready | `#e91e8c` | `#e91e8c` | `#fff` "Verify" |
| Verifying | `#e91e8c` | `#e91e8c` | `#fff` "Verifying…" |
| Success | `#e91e8c` | `#e91e8c` | `#fff` "Verified!" |

**Production trigger:** POST entered 6-digit code + phone to **AUTHKey verify endpoint**. 800ms latency simulated in mockup.

---

## 8. Resend Button — with Cooldown

### 8.1 Behavior

| Phase | Duration | Display | Action |
|---|---|---|---|
| Idle | — | "Resend" (pink, clickable) | Tap triggers resend |
| Confirming | 2s | "Sent!" (green) | Visual confirmation |
| Cooldown | 60s | "Resend (60s)" → "Resend (1s)" (pink, dimmed to 50% opacity, `not-allowed` cursor) | Disabled, counts down each second |
| Idle (return) | — | "Resend" (pink, clickable) | Available again |

### 8.2 Production trigger

- **API:** Re-call **AUTHKey send-code endpoint** with the same phone number (identical to the original `/auth` Continue with WhatsApp call)
- **Server-side:** AUTHKey must invalidate the previous code so only the newest code works
- **Frontend:** flashes "Sent!" green for 2s, then enters 60s cooldown
- **Layout-shift-proof:** row + button are height-locked (`height:18px`, `line-height:18px`) so text changes between "Resend" / "Sent!" / "Resend (59s)" cause zero vertical reflow

### 8.3 Cooldown rationale

Prevents accidental double-sends and abuse. 60s is short enough that a real user who needs another code isn't blocked, long enough to discourage rapid retries.

---

## 9. Progress Stepper

Three 20×20 circles: **Sent → Enter code → Done**.

- Initial: Sent solid pink ✓, Enter code active (pink outline + dot), Done future
- On Verify success: Enter code → solid pink ✓, rail solidifies, Done becomes active
- After 450ms completion dwell: Done → solid pink ✓ + green redirect toast
- **In production:** redirect after dwell completes (~800ms–1s total from tap). Destination branches on AUTHKey response — see §13.5

---

## 10. Phone Display

- Phone number is **plain display only** — not clickable, not editable
- White, 600 weight, no underline, no cursor pointer
- Pulled dynamically from the data source (see §3) and rendered into `#phoneLink` span on page load
- If user needs to correct the number, they navigate back to `/auth` via browser back button or app navigation — not via the phone display itself

---

## 10.5 Code Expiry Behavior

- Copy reads `Your code expires in 10 minutes` (static, no countdown)
- **No special UI handling on expiry** — if the user's code has expired, the AUTHKey verify call will fail and trigger the standard wrong-code error path (red shake + clear)
- User then taps **Resend** to receive a fresh code via the standard 60s cooldown flow
- This avoids needing a separate "code expired" state in the UI

---

## 10.6 iOS Auto-Fill (Confirmed)

- First OTP box has `autocomplete="one-time-code"`
- iOS reads the WhatsApp notification and offers to auto-fill the 6-digit code
- No additional configuration needed

---

## 11. Toast

Bottom-fixed, `rgba(28,28,28,0.95)` bg, `#333` border, white/green text, 1.8s duration. Used for post-verify redirect notice.

---

## 12. Interactions Summary

| Element | Action | Result |
|---|---|---|
| Page load | — | Pull `?phone=` param into confirmation line |
| OTP box | Type | Auto-advance, border pink |
| OTP box | Backspace empty | Focus prev, clear |
| Verify (ready) | Tap | AUTHKey verify call → success or shake-clear |
| Right code | — | Stepper advances → 450ms dwell → redirect to post-verify page |
| Wrong code | — | Red shake, clear, refocus first |
| Resend (idle) | Tap | AUTHKey re-send → "Sent!" 2s → 60s cooldown |
| Resend (cooldown) | Tap | No-op, button shows countdown |

---

## 13. Build Notes for Claude Code

- **Phone source:** `?phone=` URL param. Routing from `/auth` must encode and pass it.
- **Verify trigger:** AUTHKey verify endpoint (existing integration)
- **Resend trigger:** AUTHKey send-code endpoint (same as initial call from `/auth`)
- **Resend cooldown:** 60s, frontend-enforced + backend rate-limit recommended
- **Old code invalidation:** server-side responsibility on every resend
- **Post-verify destination:** existing dedicated page in app
---

## 13.5 Post-Verify Routing (branches on AUTHKey response)

AUTHKey verify endpoint must return a flag indicating whether the phone number is already registered in the system.

| AUTHKey response | User type | Destination |
|---|---|---|
| `is_registered: true` | Returning user (login) | **Dashboard page** (URL TBD — to be specified) |
| `is_registered: false` | New user (registration) | **Onboarding page** (URL TBD — to be specified) |

Routing logic runs after the 450ms completion dwell. The redirect toast text can be conditionally adjusted ("Signed in · redirecting…" vs "Welcome · setting up…") if desired, but the core flow is identical.

**Build dependency:** the dashboard and onboarding URLs must be wired in once finalized.
