# Settings · Login Methods Card — UI Spec

**File:** `settings_login_methods_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/model/settings` (this card is one section within the Settings page)
**Access:** Authenticated ambassador only
**Design Philosophy:** Matches existing Settings card pattern — no section headers, self-identifying rows.

---

## 1. Purpose

Display and manage the user's two possible login methods: WhatsApp (phone) and email. Supports three user states:

- **WhatsApp-primary** (most common): signed up via WhatsApp, no email yet
- **Email-primary** (rare fallback users): signed up via email magic link, no WhatsApp yet
- **Dual-linked** (power user): both methods attached

One row per method. Row behavior differs based on whether the method is linked.

---

## 2. Position

Replaces the current "Contact" card in Settings. Same vertical position (between Profile card and Preferences card).

Existing HTML comment `<!-- Contact -->` → change to `<!-- Login methods -->` in the implementation for code-organization clarity. **No visible section header** — users don't see "LOGIN METHODS" text anywhere.

---

## 3. Row Order (Dynamic)

**Rule: signup method first, linked second.**

Sort logic (server-side, passed to component):

```typescript
const primaryMethod = user.signup_method // 'whatsapp' | 'email'
const rows = primaryMethod === 'whatsapp'
  ? ['whatsapp', 'email']
  : ['email', 'whatsapp']
```

Where `signup_method` derives from which column was populated first at account creation:

- WhatsApp signup → `auth.users.phone` populated first → `signup_method = 'whatsapp'`
- Email signup → `auth.users.email` populated first → `signup_method = 'email'`

**Why dynamic ordering?** Respects how the user thinks of their account. Signup method feels like "theirs." Flipping primary users to the second row would implicitly demote them.

**Persistence:** Once determined at signup, `signup_method` does not change. Adding the second method later does not flip the order.

**Implementation note:** if `signup_method` is not stored explicitly, derive at read time from whichever of `auth.users.phone` or `auth.users.email` has the earlier confirmation timestamp. Recommended to persist in `public.users.signup_method TEXT` for efficiency.

---

## 4. Row Anatomy

### 4.1 Filled row (method is linked)

```
[Label]                    [Value]      [chev]
WhatsApp                   +971 50 123 4567   ›
```

- **Label:** method name, 14px / `#888`
- **Value:** phone number (formatted: dial + space-separated digits) OR email address, 14px white `#fff`
- **Chevron:** 14×14px, grey `#555`
- **Tap behavior:** opens the EXISTING Change modal for that method (Change email 2-step / Change WhatsApp 3-step). No behavior change from current implementation.

### 4.2 Empty row (method not linked)

```
[Label]                          [Pink action]   [pink chev]
Email                            Add email   ›
```

- **Label:** method name, 14px / `#888`
- **Action text:** `Add email` or `Add WhatsApp`, 14px pink `#e91e8c` weight 600
- **Chevron:** 14×14px pink `#e91e8c`
- **Tap behavior:** opens the NEW Add modal for that method (see §7 and §8)

### 4.3 Visual differences summary

| Element | Filled | Empty |
|---|---|---|
| Right-side text | value in white | action in pink |
| Right-side text weight | 400 | 600 |
| Chevron color | `#555` grey | `#e91e8c` pink |

Everything else (row padding, border separators, font sizes) matches existing card rows verbatim.

---

## 5. Card Styling

Identical to current Profile / Contact / Preferences cards in `settings.html`:

- Background: `#1c1c1c`
- Border radius: 14px
- Overflow: hidden
- Margin-bottom: 12px (same as other cards for vertical rhythm)
- Row padding: `14px 16px`
- Row separator: `border-top: 1px solid #262626` on rows except first

---

## 6. State Transitions

### 6.1 WhatsApp-primary user opens Add email modal, completes flow

1. Row state before: `Email — Add email (pink)`
2. User taps row → `/model/settings` stays visible, Add email modal slides up
3. User enters email, taps Send verification → modal swaps to Step 2 (Check your email)
4. User closes modal (no immediate row update — email is not confirmed yet)
5. User clicks link in their email inbox → redirects to `/auth/email-confirmed` (existing page)
6. On next `/model/settings` render: `auth.users.email` is now populated
7. Row state after: `Email — sara@email.com › (grey)`

**Critical:** The row does NOT update optimistically on modal close. The email is only considered "added" after verification. Row reflects `auth.users.email` existence from the DB.

### 6.2 Email-primary user opens Add WhatsApp modal, completes flow

1. Row state before: `WhatsApp — Add WhatsApp (pink)`
2. User taps row → Add WhatsApp modal slides up (3 steps, see §8)
3. Modal closes after Step 3 confirmation
4. Row state after: `WhatsApp — +971 50 123 4567 › (grey)`

**Critical:** AUTHKey verify completes BEFORE Step 3 renders. `auth.users.phone` is updated at that point. The "WhatsApp added!" Step 3 is celebratory confirmation after the actual write. Row reflects new value on next render.

---

## 7. Add Email Modal (new — see `settings_add_modals.html`)

Sheet modal (matches existing Change email modal styling). 2 steps:

### Step 1 — Enter email
- Title: **Add email**
- Subtitle: *"Add an email to recover your account."*
- Email input (placeholder `Email`, `autocomplete="email"`)
- Primary button: **Send verification**
  - Inactive state: `#333` bg, `#666` text, `cursor: not-allowed`
  - Active state (input contains `@`): `#e91e8c` bg, white text
- Cancel link closes modal

### Step 2 — Check your email
- Title: **Check your email**
- Subtitle: `"We sent a verification link to {email}"` (email in white bold)
- Progress tracker: Sent ✓ → Open email (active) → Done (future) — identical to existing Change email tracker
- Reassurance block (`#111` bg, `#262626` border): *"Click the link we just sent to finish adding your email. The link expires in 10 minutes."*
- Resend link: grey text "Didn't receive it? Resend" — 60s cooldown after first click, same pattern as Change email
- Primary button: **Got it** — dismisses modal (user goes back to Settings)

### Backend (Supabase)

- Step 1 submit: `supabase.auth.updateUser({ email: newEmail })`
- Supabase emails verification link to the new address
- User clicks link → redirects to `/auth/email-confirmed` (existing route)
- On that callback, Supabase has already populated `auth.users.email` and `email_confirmed_at`
- Next `/model/settings` render shows row with new email

**No same-email guard needed** (there's no existing email to collide with — this is Add flow, not Change flow).

### Error states (inline, red under input)

- Invalid format → *"Enter a valid email"*
- Supabase `email_exists` response → *"This email is already in use"* (another account owns it)

---

## 8. Add WhatsApp Modal (new — see `settings_add_modals.html`)

Sheet modal (matches existing Change WhatsApp 3-step modal styling). 3 steps:

### Step 1 — Enter number
- Title: **Add WhatsApp**
- Subtitle: *"Add WhatsApp for faster access."*
- Country picker button + phone input (identical to `auth_page_final.html` and existing Change WhatsApp Step 1)
- Primary button: **Send code via WhatsApp**
  - Inactive: `#333` bg, `#666` text
  - Active (digits ≥ 7): `#e91e8c` bg, white text
- Cancel link closes modal

### Step 2 — Enter OTP
- Title: **Enter code**
- Subtitle: *"We sent a 6-digit code to {formatted_number}"*
- Progress tracker: Send ✓ → Enter code (active) → Done (future)
- 6 OTP cells (same component as existing Change WhatsApp)
- Auto-submit on 6th digit
- Resend link with 60s cooldown (standard pattern)
- Back / Cancel buttons (match Change WhatsApp Step 2)

### Step 3 — WhatsApp added!
- Title (large, 22px): **WhatsApp added!**
- Progress tracker: all 3 steps done, "Done" label active
- **Single confirmation card** (centered, 200px wide):
  - Pink `#e91e8c` border, `#1c1c1c` background
  - Top label: *"ADDED"* (pink, uppercase, 9px, letter-spacing 0.5px)
  - Value: the new phone number (white, 13px, weight 600)
- NO "Old → New" comparison cards (key difference from Change flow — there's no previous value)
- Primary button: **Done** — dismisses modal

### Backend (AUTHKey + Supabase)

- Step 1 submit: AUTHKey send endpoint `{ dial_code, phone_number }`
- Step 2 auto-submit: AUTHKey verify endpoint `{ dial_code, phone_number, code }`
- **On successful verify (BEFORE Step 3 renders):** `supabase.auth.updateUser({ phone: e164_number })` — Supabase sets `auth.users.phone` and `phone_confirmed_at`
- Step 3 renders as celebratory confirmation

**No same-number guard needed** (no existing phone to collide with in Add flow).

### Error states

- AUTHKey send failure → toast on Step 1: *"Couldn't send code. Try again."*
- AUTHKey verify wrong code → red text below OTP cells: *"Wrong code, try again"* — cells cleared, focus returns to first cell
- Expired code (60s after send with no input) → *"Code expired. Resend?"* as resend link becomes pulsing

---

## 9. Data Requirements

Page load (same `GET /api/user/me` as existing Settings page — no new endpoint). Component reads:

```json
{
  "id": "uuid",
  "email": "sara@email.com" | null,
  "phone": "+971501234567" | null,
  "signup_method": "whatsapp" | "email"
}
```

- `email` null → Email row shows empty state
- `phone` null → WhatsApp row shows empty state
- `signup_method` determines row order

No separate fetch for Login methods section — all data comes from the single `GET /api/user/me` call that Settings already makes on mount.

---

## 10. Logout Copy Change

Unrelated to Login methods card, but piggybacks on this Slice 1.5 work:

- Account card row label: **"Log out" → "Logout"** (single word)
- Apply to the row label only. Do NOT touch toast messages, button labels, or code comments elsewhere.

---

## 11. Build Notes for Claude Code

- **Reuse the existing Change modals** for filled-row tap behavior. Do not rebuild.
- **Add modals are new components** but share country picker + phone formatter + OTP cells + tracker + toast from the existing codebase. Extract to shared hooks/components if not already shared.
- **`supabase.auth.updateUser()`** handles both email and phone updates natively. Do NOT invent synthetic emails. Do NOT create new auth users. The entire point of Slice 1.5 is to use Supabase's native identity model: one auth user row, multiple optional identity columns.
- **Row ordering:** server-side sort before passing to component. Do not sort in the client — it must stay stable across re-renders.
- **Design fidelity:** `settings_login_methods_final.html` + `settings_add_modals.html` are the source of truth for visual detail. Every padding, radius, color hex, and font size must match byte-for-byte. (Guardrail 3 from Slice 1 retro: line-for-line mockup translation.)
- **No section header.** The HTML comment `<!-- Login methods -->` in source is for developers only. User never sees "LOGIN METHODS" or similar text.
