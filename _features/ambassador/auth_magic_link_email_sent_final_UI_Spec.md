# Magic Link Sent — UI Spec (Final, with Dynamic Email + Resend Cooldown + Navigation)

**File:** `auth_magic_link_email_sent_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** Shown after the user submits their email on `/auth`
**Access:** Public — anyone who initiated sign-in with email

---

## 1. Purpose

Confirms that a magic link has been sent to the user's email, shows their position in the sign-in flow, and provides a Resend option. This is a **passive waiting screen** — the user's next action happens in their email client, not on this page.

---

## 2. Entry Point

- **From:** `/auth` page → Continue with Email button (active state)
- **URL contract:** routing call must pass the email as a query parameter:
  - `auth_magic_link_email_sent_final.html?email=sara%40email.com`
  - URL-encoded; rendered raw in the confirmation line

---

## 3. Dynamic Data Sources

| Field | Source | Behavior |
|---|---|---|
| Email display (`#emailLink`) | URL param `?email=...` | Pulled on page load via `URLSearchParams`. Falls back to placeholder `sara@email.com` only if param missing (mockup safety net). |
| Resend trigger | **Supabase Auth** | Re-call magic-link send endpoint with same email. |

---

## 4. Layout Structure

1. Status bar — `9:41`
2. Title — `Check your email` (22px / 700)
3. Confirmation line — `We sent a magic link to {email}` (email is plain display, not clickable)
4. Progress tracker — Sent → Open email → Done (Open email is active)
5. Expiry — `Your magic link expires in 10 minutes`
6. Resend row — `Didn't receive it? Resend`

---

## 5. Color System

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Tracker accents, Resend link |
| White | `#fff` | Title, checkmark, email address |
| Gray 888 | `#888` | Body grey |
| Gray 777 | `#777` | Inactive tracker labels |
| Gray 3a3a3a | `#3a3a3a` | Dashed rail, future step border |
| Black | `#000` | Page background |
| Green 4ade80 | `#4ade80` | Resend "Sent!" |

---

## 6. Email Display

- Plain display only — **not clickable, not editable**
- White, 600 weight, no underline, no cursor pointer
- Pulled from URL param on page load
- If user needs to correct the email, they navigate back to `/auth` via browser back or app navigation

---

## 7. Progress Tracker

Three 20×20 circles: **Sent → Open email → Done**.

- **Sent:** solid pink ✓
- **Open email:** active (pink outline + dot)
- **Done:** future (grey outline)
- Rails: Sent→Open solid pink, Open→Done dashed grey
- This page does **not** advance the tracker — it's a static display. The redirect happens in a different browser tab when the user clicks the email link (see §10).

---

## 8. Resend Button — with 60s Cooldown

Same mechanic as the WhatsApp verify page.

### 8.1 Behavior

| Phase | Duration | Display | Action |
|---|---|---|---|
| Idle | — | "Resend" (pink, clickable) | Tap triggers resend |
| Confirming | 2s | "Sent!" (green) | Visual confirmation |
| Cooldown | 60s | "Resend (60s)" → "Resend (1s)" (pink, dimmed to 50% opacity, `not-allowed` cursor) | Disabled, counts down |
| Idle (return) | — | "Resend" (pink, clickable) | Available again |

### 8.2 Production trigger

- **API:** Re-call **Supabase Auth** magic-link send endpoint with the same email (identical to original `/auth` Continue with Email call)
- **Server-side:** Supabase must invalidate the previous link so only the newest one works
- **Frontend:** flashes "Sent!" green for 2s, then enters 60s cooldown
- **Layout-shift-proof:** row + button are height-locked (`height:18px`, `line-height:18px`) so text changes between "Resend" / "Sent!" / "Resend (59s)" cause zero reflow

### 8.3 Element ID

Span uses `id="resendBtn"` (not `resend`) to avoid collision with the `function resend()` in global scope. Inline `onclick="resend()"` would otherwise resolve to the span element instead of the function in some browsers.

---

## 9. Expiry Line

- Copy: `Your magic link expires in 10 minutes`
- 11px / 400 `#888`, centered, 8px margin-bottom
- **No special UI handling on expiry** — if the link expires, the user simply taps Resend for a fresh one (same logic as WhatsApp verify page)

---

## 10. Magic Link Click Behavior (Production)

When the user clicks the magic link in their email:

1. **New browser tab opens** with the magic-link URL
2. **Supabase verifies the token** server-side
3. Supabase returns `is_registered` flag for this email
4. The new tab **routes directly to the destination** (handled via Supabase `redirectTo` config):
   - `is_registered: true` → **Dashboard page** (URL TBD — to be specified)
   - `is_registered: false` → **Onboarding page** (URL TBD — to be specified)
5. **The original "Check your email" tab is not updated** — no polling, no auto-redirect. It stays in its current state until the user closes it manually.

This is the simpler, more reliable model: one tab does the auth waiting, another tab handles the redirect. No cross-tab communication needed.

---

## 11. Toast

Created lazily on first call, fixed bottom, `rgba(28,28,28,0.95)` bg. Currently unused (the email is no longer clickable). Kept in code for potential future use.

---

## 12. Interactions Summary

| Element | Action | Result |
|---|---|---|
| Page load | — | Pull `?email=` param into confirmation line |
| Email display | — | Not interactive (plain text) |
| Resend (idle) | Tap | Supabase magic-link re-send → "Sent!" 2s → 60s cooldown |
| Resend (cooldown) | Tap | No-op, button shows countdown |
| Magic link in email | Tap (in email client) | Opens new browser tab → Supabase verifies → redirects to dashboard or onboarding |

---

## 13. Build Notes for Claude Code

- **Email source:** `?email=` URL param. Routing from `/auth` must encode and pass it.
- **Resend trigger:** Supabase magic-link send endpoint (existing integration)
- **Resend cooldown:** 60s, frontend-enforced + backend rate-limit recommended
- **Old link invalidation:** server-side Supabase responsibility on every resend
- **Magic link redirect:** configured in Supabase project settings (`redirectTo`). Branches on `is_registered` flag to dashboard or onboarding URL.
- **Original tab:** stays static. No polling, no auto-redirect. User closes it manually.
- **Destination URLs:** Dashboard + Onboarding URLs both TBD — to be wired in once finalized.

---

## 14. Design Philosophy Recap

- **No button, no envelope icon, no animation.** The next action happens in the email client. This page just confirms and waits.
- **One grey, one size** for body text — unified 11px `#888`.
- **Shared progress-bar vocabulary** with the WhatsApp verify page and payment link page.
- **Resend feedback stays in place.** The "Sent!" green flash uses locked dimensions so nothing below it ever moves.
- **Two-tab model:** the auth-waiting tab and the redirect tab are separate. Simple, robust, no polling.
