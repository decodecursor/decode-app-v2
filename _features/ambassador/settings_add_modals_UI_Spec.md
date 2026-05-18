# Add Email + Add WhatsApp Modals — UI Spec

**File:** `settings_add_modals.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Parent route:** `/model/settings` (modals open over Settings page)
**Access:** Authenticated ambassador only
**Design Philosophy:** Mirrors existing Change Email / Change WhatsApp modals with first-time-add copy.

---

## 1. Purpose

Two new sheet modals that open when the user taps an empty row on the Settings Login Methods card:

- **Add email** — 2 steps (shown when `auth.users.email IS NULL`)
- **Add WhatsApp** — 3 steps (shown when `auth.users.phone IS NULL`)

Both share the same sheet-modal chrome as existing Change modals (bottom-sheet style on mobile, grip handle, `#1c1c1c` background, rounded top corners).

---

## 2. Entry Points

### 2.1 Add email modal

| Source | Trigger | Condition |
|---|---|---|
| Settings Login methods card, Email row | Tap | `auth.users.email IS NULL` |

### 2.2 Add WhatsApp modal

| Source | Trigger | Condition |
|---|---|---|
| Settings Login methods card, WhatsApp row | Tap | `auth.users.phone IS NULL` |

No other entry points. These modals are only reached through the Login methods card's empty state.

---

## 3. Modal Chrome

Identical across both modals (matches existing Change modals):

- Overlay background: `rgba(0,0,0,0.7)` covering full viewport
- Sheet: `#1c1c1c` bg, border-radius `20px 20px 0 0`, anchored to bottom, full width
- Grip handle: 40×4px, `#444`, centered, 24px from top
- Content padding: `24px 20px 32px`

Sheet slides up from bottom on open. Dismiss:
- Tap overlay → close
- Cancel link (step 1 only) → close
- Back button (multi-step) → previous step
- Primary action completes flow → close

---

## 4. Add Email Modal — 2 Steps

### 4.1 Step 1 — Enter email

**Content (top to bottom):**

| Element | Spec |
|---|---|
| Title | `Add email` — 18px / 700 / white / centered / 8px margin-bottom |
| Subtitle | `Add an email to recover your account.` — 13px / 400 / `#888` / centered / line-height 1.5 / 20px margin-bottom |
| Email input wrapper | `#111` bg, `#333` border, 10px radius, padding `14px 16px`. Border `#e91e8c` on focus. Bottom margin 14px. |
| Email input | placeholder `Email`, `autocomplete="email"`, 14px white, caret `#e91e8c` |
| Primary button | `Send verification` — see states below |
| Cancel link | 14px / `#888` / centered / padding 8px / cursor pointer |

**Primary button states:**

| State | Trigger | Background | Text |
|---|---|---|---|
| Inactive | Input empty OR missing `@` | `#333` | `#666`, cursor not-allowed |
| Active | Input contains `@` | `#e91e8c` | `#fff` |

### 4.2 Step 2 — Check your email

**Content (top to bottom):**

| Element | Spec |
|---|---|
| Title | `Check your email` — 18px / 700 / white / centered / 8px margin-bottom |
| Confirmation | `We sent a verification link to`<br>`{email}` — 12px / `#888` / centered / line-height 1.6 / 20px margin-bottom. Email in white bold on second line. |
| Progress tracker | Sent ✓ → Open email (active) → Done (future) — identical to existing Change email tracker (see §6) |
| Reassurance block | `#111` bg, 10px radius, `#262626` border, padding `12px 14px`, 16px margin-bottom. Text: *"Click the link we just sent to finish adding your email. The link expires in 10 minutes."* (11px white) |
| Resend line | `Didn't receive it? Resend` — 11px / `#888` / centered. "Resend" is `#e91e8c` weight 600. 60s cooldown after first tap. 16px margin-bottom. |
| Primary button | `Got it` — pink `#e91e8c`, 14px / 600 / white, padding 14px, 12px radius, cursor pointer. Closes modal. |

### 4.3 Backend (Step 1 → Step 2 transition)

- Frontend calls `supabase.auth.updateUser({ email: inputValue })`
- Supabase emails verification link to new address (uses existing project email template)
- On success: modal transitions to Step 2 with `{email}` filled in
- On error `email_exists`: stay on Step 1, show inline red error *"This email is already in use"* under input
- On error `invalid format` (caught client-side): red error *"Enter a valid email"*
- On network error: toast *"Couldn't send. Try again."* stays on Step 1

### 4.4 Resend handler

- First tap: fires same `supabase.auth.updateUser({ email })` call (Supabase invalidates previous link server-side)
- "Resend" link dims to 50% opacity, text changes to `Resend (60s)` counting down
- At 0s: returns to `Resend` idle state
- Between taps: tap is a no-op

### 4.5 Email confirmation (out-of-band)

User clicks link in their inbox → browser opens `/model/auth/email-confirmed` (existing route). Supabase validates token, sets `auth.users.email` + `email_confirmed_at`. User then returns to Settings (manually or via a success screen).

**Row reflects new email on next `/model/settings` render.** No optimistic UI in the Settings card.

---

## 5. Add WhatsApp Modal — 3 Steps

### 5.1 Step 1 — Enter number

**Content (top to bottom):**

| Element | Spec |
|---|---|
| Title | `Add WhatsApp` — 18px / 700 / white / centered / 8px margin-bottom |
| Subtitle | `Add WhatsApp for faster access.` — 13px / 400 / `#888` / centered / line-height 1.5 / 20px margin-bottom |
| Phone row | 108px country picker + flex phone input, 8px gap, 14px margin-bottom |
| Country picker button | Identical to `auth_page_final.html` — opens full-screen country picker overlay |
| Phone input | Live format mask per country, placeholder per country |
| Primary button | `Send code via WhatsApp` — see states |
| Cancel link | 14px / `#888` / centered |

**Primary button states:**

| State | Trigger | Background | Text |
|---|---|---|---|
| Inactive | Phone digits < 7 | `#333` | `#666`, not-allowed |
| Active | Phone digits ≥ 7 | `#e91e8c` | `#fff` |

**Country picker:** Identical implementation to `auth_page_final.html`. Same `countries` array, same `phoneFormats`, same `formatPhoneNumber()`. Reuse the shared module — do NOT create a second copy.

**Country pre-selection:** Default to UAE (+971) since this is the Add flow for users without WhatsApp (no existing phone to derive country from). User can change via picker.

### 5.2 Step 2 — Enter OTP

**Content (top to bottom):**

| Element | Spec |
|---|---|
| Title | `Enter code` — 18px / 700 / white / centered / 8px margin-bottom |
| Subtitle | `We sent a 6-digit code to {formatted_number}` — 13px / `#888` / centered. Number in white weight 500. 20px margin-bottom. |
| Progress tracker | Send ✓ → Enter code (active) → Done (future) — identical to existing Change WhatsApp Step 2 tracker |
| OTP cells | 6 cells, 40×48px, `#111` bg, `#333` border, 10px radius, 18px white bold centered, `inputmode="numeric"`, `maxlength=1` each. 8px gap between. |
| Resend link | `Didn't receive it? Resend code` — 13px / centered. `Resend code` is `#e91e8c` weight 600. 60s cooldown. |
| Button row | Back + Cancel — 50/50 split, `#262626` bg, 14px / 600 / white, 12px radius |

**Auto-submit:** When 6th digit is entered, fire AUTHKey verify without waiting for a submit button.

### 5.3 Step 3 — WhatsApp added!

**Content (top to bottom):**

| Element | Spec |
|---|---|
| Title | `WhatsApp added!` — 22px (LARGER than other step titles) / 700 / white / centered / letter-spacing -0.2px / 32px margin-bottom |
| Progress tracker | All 3 steps done (three pink `#e91e8c` circles with white checkmarks, all rails solid pink), "Done" label active (pink weight 700) — identical to Change WhatsApp Step 3 tracker structure |
| Confirmation card | SINGLE card, centered, 200px wide. See §5.4 below. |
| Primary button | `Done` — pink `#e91e8c`, 14px / 600 / white, full-width, 14px padding, 12px radius. Closes modal. |

### 5.4 Confirmation card (Step 3)

Key structural difference from Change WhatsApp Step 3 (which has Old → New cards):

- **Single centered card** (not two side-by-side)
- Width: 200px
- Background: `#1c1c1c`
- Border: `1px solid #e91e8c`
- Border-radius: 12px
- Padding: `14px 12px`
- Text-align: center

Card contents:

| Element | Spec |
|---|---|
| Label | `ADDED` — 9px / 600 / uppercase / letter-spacing 0.5px / `#e91e8c` / 6px margin-bottom |
| Value | formatted phone number (`+971 50 123 4567`) — 13px / 600 / `#fff` / single line / ellipsis on overflow |

### 5.5 Backend (AUTHKey + Supabase)

- **Step 1 submit:** AUTHKey send endpoint with `{ dial_code, phone_number }`
- **Step 2 auto-submit:** AUTHKey verify endpoint with `{ dial_code, phone_number, code }`
- **On verify SUCCESS (before Step 3 renders):** call `supabase.auth.updateUser({ phone: e164Format(dial_code, phone_number) })`. This sets `auth.users.phone` + `phone_confirmed_at` on the existing auth user. No new auth user created.
- **On verify FAILURE:** stay on Step 2, clear cells, show red error *"Wrong code, try again"*
- **Step 3** renders purely as UX confirmation — the DB write has already happened

### 5.6 Resend handler (Step 2)

- First tap: fires AUTHKey send again (AUTHKey invalidates previous code server-side)
- Resend link dims, shows `Resend in (60s)` countdown
- At 0s: returns to `Resend code` idle state

---

## 6. Shared: Progress Tracker Component

Used in Step 2 of Add email (3 steps: Sent, Open email, Done) and Step 2/3 of Add WhatsApp (3 steps: Send, Enter code, Done).

**Structure:**

```
[●]─────[○]─ ─ ─[○]
 Sent    Open    Done
         email
```

**CSS primitives** (copy from existing Change email / Change WhatsApp trackers):

- `.stepDone` — 20×20px, `#e91e8c` filled, white check icon
- `.stepActive` — 20×20px, `#e91e8c` border, transparent bg, 6×6px pink dot centered
- `.stepFuture` — 20×20px, `#3a3a3a` border, transparent bg, empty
- `.railSolid` — 1.5px pink, flex:1, 2px horizontal margin
- `.railDashed` — 1.5px repeating `#3a3a3a` dashes (3px on, 3px off), flex:1, 2px horizontal margin

**Labels row** (below tracker, 10px margin-top):

- Grid template: `20px 1fr 20px 1fr 20px` (matches tracker columns)
- Label text: 9px weight 600, `white-space: nowrap`, positioned absolute within cell:
  - First label: `left: 0` (aligns with first circle)
  - Middle label: `left: 50%, transform: translateX(-50%)` (centered under middle circle)
  - Last label: `right: 0` (aligns with last circle)
- Color rules:
  - Completed step → `#777` (dimmed grey, weight 600)
  - Active step → `#e91e8c` (pink, weight 700)
  - Future step → `#777` (dimmed grey, weight 600)

---

## 7. Colors

All modals use the same palette as the rest of the app. Key values:

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Active tracker, confirmed cards, primary buttons, resend links |
| Dark grey (modal) | `#1c1c1c` | Modal sheet background, confirmation card bg |
| Border grey | `#333` | Default input borders, inactive button background |
| Text grey | `#888` | Subtitles, inactive labels |
| Mid grey | `#666` | Inactive button text |
| Darker grey | `#262626` | Reassurance block border, Back/Cancel button bg |
| Input bg | `#111` | Input wrapper background, reassurance block bg |

**No green anywhere.** Success states use pink.

---

## 8. Typography

All `system-ui, -apple-system, sans-serif`. Same font stack as rest of app.

| Element | Size | Weight |
|---|---|---|
| Step 1/2 title | 18px | 700 |
| Step 3 title (WhatsApp added!) | 22px | 700 |
| Subtitle | 13px | 400 |
| Input text | 14px | 400 |
| OTP cell | 18px | 600 |
| Primary button | 14px | 600 |
| Secondary button | 14px | 600 |
| Confirmation card label | 9px | 600 (uppercase) |
| Confirmation card value | 13px | 600 |
| Tracker label | 9px | 600 (700 for active) |
| Resend link | 11-13px | 600 (pink) |
| Reassurance text | 11px | 400 |
| Cancel link | 14px | 400 |

---

## 9. Error States

### 9.1 Add email

| Scenario | UI | Stays on step |
|---|---|---|
| Empty input at submit | Button inactive, tap does nothing | Step 1 |
| Invalid format | Red inline error under input: *"Enter a valid email"* | Step 1 |
| Email already in use (Supabase `email_exists`) | Red inline error: *"This email is already in use"* | Step 1 |
| Supabase network error | Toast: *"Couldn't send. Try again."* | Step 1 |
| User closes email client without clicking link | No UI change (email never confirms; row stays empty on next settings render) | — |

### 9.2 Add WhatsApp

| Scenario | UI | Stays on step |
|---|---|---|
| Empty/short number at submit | Button inactive, tap does nothing | Step 1 |
| AUTHKey send error | Toast: *"Couldn't send code. Try again."* | Step 1 |
| Wrong OTP entered | Red error below cells: *"Wrong code, try again"*. Cells cleared. Focus first cell. | Step 2 |
| OTP expired (user took too long) | Red error: *"Code expired. Resend?"* Resend link pulses. | Step 2 |
| AUTHKey verify network error | Toast: *"Couldn't verify. Try again."* | Step 2 |

---

## 10. Accessibility Notes

- All inputs: `aria-label` matching placeholder text
- OTP cells: `aria-label="Digit {n} of 6"` where n = 1..6
- Progress tracker: `role="progressbar"` with `aria-valuenow`, `aria-valuemax="3"`
- Modal: `role="dialog"`, `aria-modal="true"`, focus trap active while open, focus returns to triggering row on close
- Keyboard: Esc closes modal, Tab cycles within modal only

---

## 11. Build Notes for Claude Code

- **Reuse, don't rebuild.** Country picker, phone formatter, OTP cells, progress tracker, toast, sheet modal chrome — all exist in `settings.html` already for Change modals. Extract to shared components/hooks if not already shared, then use for both Change AND Add flows.
- **Copy differences are the ONLY functional distinction** between Change and Add for email. Structurally identical modals.
- **WhatsApp Add Step 3 is a NEW component** — single centered card instead of Old→New row. Visual difference from Change flow is intentional (no previous value to compare against).
- **Supabase native only.** Do NOT invent synthetic emails. Do NOT create new auth users. `supabase.auth.updateUser({ email })` and `supabase.auth.updateUser({ phone })` are the ONLY ways to link identities in this system.
- **Design fidelity.** Match `settings_add_modals.html` byte-for-byte. Every padding, margin, color, radius is intentional.
- **AUTHKey integration** is identical to existing Change WhatsApp modal. Do not invent new endpoints.

---

## 12. Files

- `settings_add_modals.html` — interactive mockup showing all 5 steps (2 Add email + 3 Add WhatsApp) side-by-side
- `settings_add_modals_UI_Spec.md` — this document
- Related: `settings_login_methods_final.html` (parent card), `settings_login_methods_final_UI_Spec.md`, `settings.html` (existing Change modals for reference), `auth_page_final.html` (country picker data source)
