# Change Email Confirmation — UI Spec (Final, with Navigation)

**File:** `change_email_confirmation_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/auth/email-confirmed`
**Access:** Public — served after Supabase verifies a valid `type=email_change` token

---

## 1. Purpose

Confirms the email change is complete. Shows both the **old** and **new** email side-by-side so the user sees exactly what just happened. Dedicated confirmation screen — not a silent redirect to `/settings`.

---

## 2. Navigation — Full Map

### 2.1 Inbound (ONE entry point only)

| Source | Element | Trigger |
|---|---|---|
| User's inbox (new email) | "Verify your new email" link | User taps it. Link format: `https://{supabase-project}.supabase.co/auth/v1/verify?token=...&type=email_change&redirect_to=https://welovedecode.com/auth/email-confirmed`. Supabase verifies the token server-side, then 302-redirects to this page. |

**Important constraints:**
- This page **cannot be reached by typing the URL** — there's no valid state without a just-verified session. Direct navigation must redirect to `/auth`.
- This page is **only reached once per successful verification**. Supabase tokens are single-use.
- Users will often arrive on a **different device / browser** than the one they initiated the change on (e.g. started on phone, clicked link on desktop).

### 2.2 Outbound (ONE exit action, plus tab close)

| Element | Destination | Behavior |
|---|---|---|
| "Go to Settings" button | `/settings` | Hard-nav via `window.location.href='/settings'`. If the browser has an active session for the new email, lands in Settings. If not, Supabase intercepts and routes to `/auth`. |
| Tab close (browser UI) | — | Natural way out — no action from our page needed. The original tab on their other device (if any) still shows the "Check your email" modal and can be closed there too. |

**What is NOT an exit:**
- No back button on this page — there's nowhere useful to go back to
- No "Close tab" button — browsers handle that
- No secondary link — keep the page single-purpose

### 2.3 Backend / session writes

| Event | Who writes | What happens |
|---|---|---|
| Link clicked (before this page renders) | Supabase | `users.email` updated to new value; session refreshed; old email invalidated; token consumed |
| Page renders | Server-rendered | Old + new email values pulled from session / server context and injected into the page |
| Button tapped | Client → browser | `window.location.href='/settings'` — no API call, no write |

### 2.4 Error paths (NOT this page — handled by server / Supabase)

If Supabase verification fails, the user is routed to an error page BEFORE this page ever renders:

| Situation | Destination route | Copy |
|---|---|---|
| Token expired (> 10 min) | `/auth/email-link-expired` | "This link has expired. Request a new one from Settings." → button back to `/settings` |
| Token already used | `/auth/email-already-confirmed` | "This email is already confirmed." → button to `/settings` |
| Token invalid / tampered | `/auth/email-link-invalid` | "This link isn't valid. Request a new one from Settings." → button to `/settings` |
| Supabase / network error | Generic `/auth/error` | "Something went wrong. Try again." |

---

## 3. Data Sources

| Field | Source | Fallback |
|---|---|---|
| Old email (`#oldEmail`) | Server: previous `users.email` value captured before the change | If missing, show "previous email" as greyed-out placeholder (should never happen in production) |
| New email (`#newEmail`) | Server: current `users.email` post-verification | Same |
| URL params `?old=...&new=...` | **Mockup-only** — used in the static HTML so the page can be previewed with different emails without a backend | N/A in production |

**Production rule:** do NOT pass emails via URL params in production — params leak into browser history, referrers, and analytics. Server-render the values into the page using the authenticated session.

---

## 4. Layout Structure

1. **Title** — `Email changed!` (22px / 700, center, 42px bottom margin)
2. **Progress tracker** — Sent ✓ → Opened ✓ → Done ✓ (all pink, filled)
3. **Old → New cards** — two cards with a pink arrow between them
4. **Primary button** — `Go to Settings` (pink, full width)

No status bar, no check icon, no subtitle, no secondary ghost link. Minimal and focused.

---

## 5. Color System

| Token | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Tracker dots + rails, "New" card border + label, arrow, primary button, "Done" label |
| White | `#fff` | Title, tracker checkmarks, new email value |
| Gray 888 | `#888` | Old email value |
| Gray 777 | `#777` | "Sent" and "Opened" tracker labels |
| Gray 666 | `#666` | "Old" card label |
| Gray 262626 | `#262626` | "Old" card border |
| Gray 1c1c1c | `#1c1c1c` | Card backgrounds |
| Black | `#000` | Page background |

**No green.** Even though this is a "success" state, the page uses brand pink — consistent with the rest of the auth flow. Avoids introducing a new color for one screen.

---

## 6. Animations (on page load)

Subtle, 0.5–0.7s total. Reinforces the "just completed" feeling.

| Element | Animation | Delay |
|---|---|---|
| Content wrapper | Fade in + slide up 8px | 0s (starts immediately) |
| Tracker dot 1 "Sent" | Pop in from scale 0 → 1 | 0.15s |
| Rail 1 | Scale X from 0 → 1 (left-to-right fill) | 0.22s |
| Tracker dot 2 "Opened" | Pop in | 0.3s |
| Rail 2 | Scale X fill | 0.37s |
| Tracker dot 3 "Done" | Pop in | 0.45s |
| Old/New row | Fade in | 0.55s |
| Button | Fade in | 0.7s |

**Why animate the tracker:** it visually reinforces the journey the user just completed. Static dots would feel like any other screen.

---

## 7. Old → New Cards

### 7.1 Old card (left)
- Background `#1c1c1c`, border `1px solid #262626` (neutral)
- Label: `Old` (9px uppercase, `#666`, 600)
- Value: old email (11px, `#888`, no strikethrough — arrow conveys the transition)
- `flex:1; min-width:0; text-overflow:ellipsis` so long emails truncate gracefully

### 7.2 Arrow
- 16×16 SVG, `#e91e8c`, 2.5px stroke, points right

### 7.3 New card (right)
- Same base + pink accents:
  - Border: `1px solid #e91e8c`
  - Label: `New` (pink `#e91e8c`)
  - Value: new email (11px, **white `#fff`, 600 weight**)

The pink border + pink label + white bold value unmistakably mark the current email.

---

## 8. Primary Button

- Copy: `Go to Settings`
- Full width, pink `#e91e8c`, 16px padding, 14px/600 white text
- `:active` scale(0.98) for tap feedback
- On tap: `window.location.href='/settings'` (production) / toast in mockup
- **Loading state:** text changes to "Loading…" with 70% opacity while navigation fires — prevents double-tap
- No ghost secondary action

---

## 9. Interactions Summary

| Element | Action | Result |
|---|---|---|
| Page load | — | Fade-in + staggered tracker animation. Old + new emails injected from server (or URL params in mockup). |
| Old / New cards | — | Not interactive (plain text display) |
| Tracker dots | — | Not interactive (static display) |
| Go to Settings button | Tap | Nav to `/settings` with loading state on button |

---

## 10. What's NOT on this page (deliberate decisions)

| Removed | Reason |
|---|---|
| Status bar (`9:41`) | Not needed outside full-screen mobile mockup context |
| Check icon above title | Title + filled tracker + exclamation mark already carry the confirmation. Extra icon = noise. |
| Subtitle ("Here's your change at a glance") | Title + visible old/new cards = self-explanatory. Remove. |
| "You can close this tab" ghost text | Users know how browsers work. |
| Green accents | Pink is brand's positive color. No need for separate green. |
| Back button | No valid "back" — token is consumed, previous state doesn't exist |
| Secondary actions | Keep single-purpose |

---

## 11. Multi-tab / Multi-device Behavior

The user probably initiated the change on Device A (phone, in `/settings`) and clicked the verify link on Device B (desktop, email client).

| Device | State after this page loads |
|---|---|
| **Device B (here)** | Shows confirmation, offers "Go to Settings" |
| **Device A (original)** | Still shows the "Check your email" modal in `/settings`. No polling, no auto-update. When user returns and refreshes, `GET /api/user/me` returns the new email and the modal can be dismissed manually. |

No cross-tab communication needed. Same model as the magic-link auth flow.

---

## 12. Build Notes for Claude Code

- **Supabase config:** `redirectTo` in Auth → URL Configuration must include `/auth/email-confirmed` for the production domain
- **Server-rendered values:** old + new emails come from the server. Do NOT rely on URL params in production (security + UX)
- **Session handling:** Supabase auto-refreshes session with new email as primary after verification. Subsequent API calls use new email.
- **No client-side state:** page is purely presentational. No polling, no optimistic writes. Button is the only interactive element.
- **Link expiry:** 10 minutes (Supabase Auth settings). Must match copy on `/settings` "Check your email" modal.
- **Direct navigation guard:** route middleware should verify active session has a just-completed email change flag; otherwise redirect to `/auth`.
- **Animations:** CSS-only (no JS-driven timing). Total duration < 1s to avoid feeling sluggish.

---

## 13. Files

- `change_email_confirmation_final.html` — this page (interactive mockup with URL params)
- `change_email_confirmation_final_UI_Spec.md` — this document
- Related: `settings.html` / `settings_UI_Spec.md` (initiates the flow), `auth_magic_link_email_sent_final.html` (shared tracker pattern)
