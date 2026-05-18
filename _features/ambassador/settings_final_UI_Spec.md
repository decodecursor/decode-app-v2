# Settings Page — UI Spec (Final)

**File:** `settings_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/settings`
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Central hub for all ambassador identity, contact, financial, and preference settings. Structured as a vertical stack of cards. All edits happen via bottom-sheet modals (no inline editing, no sub-pages).

---

## 2. Navigation — Entry Points, Exits & Data Flow

### 2.1 Inbound entry points

| Source | Element |
|---|---|
| Dashboard | "Settings" nav card (with optional pink hint: "Bank missing", "Email missing", or both) |
| Change email confirmation page | "Go to Settings" button (after email change completes) |
| Browser back from sub-flows | Native gesture |

### 2.2 Outbound exits — full map

| Element | Action | Data written | Trigger fired |
|---|---|---|---|
| Back arrow | → Dashboard (fixed, not history.back) | None | None |
| Cover photo camera icon | Opens native file picker → uploads image | `PATCH /api/user/me { cover_photo }` | `cover_saved` |
| Cover photo drag | Repositions the cover crop | `PATCH /api/user/me { cover_photo_position }` (debounced 2s) | None |
| URL card — copy button | Copies `app.welovedecode.com/{slug}` to clipboard | None | None |
| URL card — view button | Opens `app.welovedecode.com/{slug}` in new tab | None | None |
| URL card — edit button | Opens URL change modal (3-step) | `PATCH /api/user/me { slug }` on confirm | `slug_changed` |
| Profile card — any row | Opens inline edit for that field → saves on blur | `PATCH /api/user/me { field }` | `profile_saved` |
| Contact card — Email row | Opens Email modal (2-step: enter → verification sent) | `POST /api/user/change-email { new_email }` | `email_change_initiated` |
| Contact card — WhatsApp row | Opens Phone modal (3-step: enter → OTP → confirmed) | `PATCH /api/user/me { phone }` on OTP verify | `phone_changed` |
| **Bank card — "Add bank account" (State A)** | Opens Bank modal (add mode) | `POST /api/ambassador/bank-account` | `bank_added` |
| **Bank card — row tap (State B)** | Opens Bank modal (edit mode) | `PATCH /api/ambassador/bank-account` | `bank_updated` |
| Preferences — Currency row | **No action** (locked at onboarding, subtitle explains) | — | — |
| Preferences — Wishlist toggle | Toggles wishlist visibility on public page | `PATCH /api/user/me { wishlist_public }` | `wishlist_toggled` |
| Preferences — Page live toggle | Toggles page visibility (may trigger "Can't hide page" modal) | `PATCH /api/user/me { is_public }` | `page_toggled` |
| Account — Logout | Clears session → redirects to `/auth` | Session destroyed | `logout` |
| Account — Delete profile | Opens Delete modal (2-step: confirm → type DELETE) | `DELETE /api/user/me` | `profile_deleted` |
| "Can't hide page" modal — Got it | Closes modal | None | None |

### 2.3 Modal dismiss behavior (all modals on this page)

| Action | Result |
|---|---|
| Backdrop tap (dimmed area) | Closes modal, unsaved changes lost |
| Drag handle swipe (>40%) | Closes modal |
| Cancel / Back / Keep / Got it buttons | Closes modal |
| No "discard changes?" confirmation — consistent across all modals on this page |

---

## 3. Layout — Card Stack

### 3.1 Right-side alignment rule

All right-side interactive elements (chevrons, toggles, URL card buttons) must have their **rightmost pixel at the same x-position** across every row on the page. Achieved by:
- All cards and rows: `padding-right: 16px` (consistent, no exceptions)
- All right-side icons: `flex-shrink: 0`
- Chevrons: `width: 14px`
- Toggles: `width: 44px` — wider but right-edge aligned at 16px from card border
- URL card buttons: 3 circle buttons flush to the same right rail
- Currency row: value text only, no lock icon (subtitle "Can't be changed after setup" is sufficient)

### 3.2 Card stack order

1. **Cover photo** — draggable crop + camera upload button
2. **URL card** — `app.welovedecode.com/{slug}` + copy / view / edit buttons
3. **Profile card** — First name, Last name, Tagline, Instagram (inline edit rows)
4. **Contact card** — Email, WhatsApp (modal-edit rows)
5. **Payout method card** ← NEW — bank account (modal-edit, two states)
6. **Preferences card** — Currency (locked), Wishlist toggle, Page live toggle
7. **Account card** — Logout, Delete profile

---

## 4. Payout Method Card — Detailed Spec

### 4.1 Position

After Contact card (email/WhatsApp), before Preferences. Groups all identity + financial settings together.

### 4.2 State A — No bank set up

| Element | Spec |
|---|---|
| Header | "Payout method" — 14px/600 `#fff` |
| Body text | "Add your bank to receive payouts" — 12px/400 `#777` |
| CTA button | "Add bank account" — full-width, `#e91e8c` pink, 14px/600 white, 12px radius, 14px padding |
| Tap CTA | Opens Bank modal in add mode |

### 4.3 State B — Bank exists

Single row, same layout pattern as Email/WhatsApp — left grey label, right white value, chevron.

| Element | Spec |
|---|---|
| Left label | "Payout method" — 14px/400 `#888`, vertically aligned with bank name baseline |
| Right line 1 | Bank name — 14px/400 `#fff` (same weight as other row values, not bold) |
| Right line 2 | Masked IBAN — 12px/400 `#777`, 2px below bank name, e.g. "•••• 4821" |
| Right alignment | Both lines right-aligned |
| Chevron | 14px `#555`, top-aligned with bank name, `flex-shrink:0` |
| Tap row | Opens Bank modal in edit mode |
| Card background | `#1c1c1c`, 14px radius |

Beneficiary name is **not shown** on the card — it lives in the edit modal only. The card shows only what Sara needs to glance at: which bank, which account.

### 4.4 Bank Modal

Bottom-sheet modal — same chrome as email/phone modals:
- `rgba(0,0,0,0.7)` overlay
- `#1c1c1c` sheet, top corners 20px
- 40×4px `#444` drag handle
- 24px 20px 32px padding

### 4.5 Modal — Add mode

| Element | Spec |
|---|---|
| Title | "Add bank account" — 18px/700 white, centered |
| Subtitle | "Your payouts will be sent to this account." — 13px/400 `#888`, centered |
| Field: Bank name | Required. Placeholder: "e.g. Emirates NBD" |
| Field: Beneficiary name | Required. Placeholder: "Full legal name on the account" |
| Field: IBAN | Required. Placeholder: "e.g. AE070331234567890123456". Live validation. Status text shows "Valid" in green or error below. |
| Field: SWIFT / BIC | Optional. Label includes "(optional)" suffix. Placeholder: "e.g. ABORAEADXXX" |
| Save button | "Add bank account" — disabled (`#333`/`#666`) until bank name + beneficiary + valid IBAN filled → enabled (`#e91e8c`/`#fff`) |
| Cancel | Text link below save button — 14px/400 `#888`, closes modal |

### 4.6 Modal — Edit mode

| Element | Spec |
|---|---|
| Title | "Update bank account" — 18px/700 white, centered |
| Same subtitle as add mode |
| Bank name | Pre-filled from existing data |
| Beneficiary name | Pre-filled from existing data |
| IBAN | **Blank** — placeholder changes to "Re-enter IBAN to change". Never pre-filled in plaintext. Security: the full IBAN is never returned from the API. |
| SWIFT / BIC | Pre-filled if previously set |
| Save button | "Update" — enabled when bank name + beneficiary filled. IBAN is optional in edit mode (if blank, server keeps existing IBAN). If user types a new IBAN, it must pass validation to save. |

### 4.7 IBAN Validation (client-side)

Basic format check: `^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$` (case-insensitive).
Whitespace stripped before validation.

| State | Visual |
|---|---|
| Empty | No error shown |
| Typing, invalid format | Error below field: "Invalid IBAN format" in red (`#ef4444`), 11px |
| Valid format | Error clears, save button enables (no "Valid" badge — clean field) |

Server performs full per-country IBAN validation on save. Client check is a convenience filter.

### 4.7.1 Field placeholders

All input placeholders show example values directly — no "e.g." prefix:

| Field | Placeholder |
|---|---|
| Bank name | `Emirates NBD` |
| Beneficiary name | `Full legal name on the account` |
| IBAN | `AE070331234567890123456` |
| SWIFT / BIC | `ABORAEADXXX` |

### 4.8 Save flow

1. User taps save button (enabled)
2. Button text → "Saving…", background → `#333`, cursor → not-allowed
3. `POST` (add) or `PATCH` (edit) → `/api/ambassador/bank-account`
4. On 200:
   - Modal closes
   - Card switches from State A → State B (or updates State B values)
   - Card flashes using existing `row-saved-flash` animation (keyframe: `#1c1c1c` → `#14532d` → `#1c1c1c` over 1.2s)
   - Toast: "Bank saved ✓"
5. On error:
   - Modal stays open
   - Error text appears below the relevant field (e.g. "IBAN already in use", "Invalid IBAN for country AE")

### 4.9 Security — IBAN handling

- Full IBAN is **never returned** from any API endpoint — only `iban_last4`
- When editing, the IBAN field is **blank** — user must re-enter to change
- IBAN is stored **encrypted at rest** (pgcrypto or app-level encryption)
- `iban_last4` stored separately in plaintext for display (same pattern as the Statement page's "•••• 4821")
- No bank account deletion in V1 — edit only. Removal requires admin action.

---

## 5. Data Storage

### 5.1 Table: `user_bank_accounts`

**CRITICAL — Audit-first rule for Claude Code:**

> Before building, run `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%bank%'` on Supabase.
> - If `user_bank_accounts` (plural) exists → use it, `ALTER TABLE` to add missing columns only.
> - If `user_bank_account` (singular) exists → `ALTER TABLE user_bank_account RENAME TO user_bank_accounts`, then proceed.
> - If neither exists → `CREATE TABLE user_bank_accounts` with the schema below.
> - Search entire codebase for `user_bank_account` (singular) → replace with plural everywhere.

### 5.2 Schema (target state)

```sql
CREATE TABLE user_bank_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  bank_name           TEXT NOT NULL,
  beneficiary_name    TEXT NOT NULL,
  iban_number         TEXT NOT NULL,         -- encrypted at rest, never returned via API
  iban_last4          CHAR(4) NOT NULL,      -- plaintext, for display only
  swift_code          TEXT NULL,
  is_primary          BOOLEAN NOT NULL DEFAULT TRUE,
  status              TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'verified'
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at         TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

  -- V1: one primary bank per user
  CONSTRAINT one_primary_per_user UNIQUE (user_id, is_primary)
);
CREATE INDEX ON user_bank_accounts (user_id);
```

### 5.3 Table scope

`user_bank_accounts` is **shared across all user types** — not ambassador-specific. V1 only ambassadors write to it. The table doesn't enforce a role constraint; `user_id` references `users(id)` which has its own role field.

### 5.4 V1 verification

No verification UI for ambassadors. Default `status = 'pending'`, `is_verified = false`. Admin manually verifies during first payout batch attempt → flips to `'verified'` via SQL. Verification UI is a post-V1 concern.

### 5.5 API endpoints

```
POST  /api/ambassador/bank-account
  body: { bank_name, beneficiary_name, iban_number, swift_code? }
  → inserts row with is_primary=true, status='pending'
  → returns { id, bank_name, beneficiary_name, iban_last4, swift_code, status }
  → IBAN encrypted before storage, iban_last4 extracted and stored separately

PATCH /api/ambassador/bank-account
  body: { bank_name?, beneficiary_name?, iban_number?, swift_code? }
  → updates existing primary bank account
  → if iban_number present: re-encrypts, re-extracts last4, resets status='pending'
  → returns same shape as POST

GET   /api/ambassador/bank-account
  → returns { bank_name, beneficiary_name, iban_last4, swift_code, status }
  → NEVER returns full iban_number
```

---

## 6. Dashboard Hint — "Bank missing"

Extends the existing "Settings · Email missing" pink hint pattern on the Dashboard's Settings nav card.

### 6.1 Stacking priority

Bank missing is **highest priority** (payouts won't work without it).

| Condition | Hint text |
|---|---|
| Bank missing only | "Settings · Bank missing" |
| Email missing only | "Settings · Email missing" |
| Both missing | "Settings · Bank + Email missing" |
| Neither missing | No hint (clean card) |

### 6.2 Check logic

```js
function getSettingsHint(user) {
  const bankMissing  = !user.has_bank_account;
  const emailMissing = !user.email_verified;

  if (bankMissing && emailMissing) return 'Bank + Email missing';
  if (bankMissing)                 return 'Bank missing';
  if (emailMissing)                return 'Email missing';
  return null;
}
```

### 6.3 Ambassador arrives at Settings with no bank

Card shows State A (empty CTA). **No auto-open of the bank modal.** Sara discovers it naturally by scrolling to the Payout method card. The dashboard hint already nudged her.

---

## 7. Existing Cards — Quick Reference

For Claude Code context. These are already built and working in the current HTML.

### 7.1 Cover photo

- Upload via camera icon → native file picker (jpeg/png/webp)
- Drag to reposition crop → debounced save (2s) to `cover_photo_position`
- Gradient overlay at bottom for text legibility

### 7.2 URL card

- Display: `app.welovedecode.com/{slug}`
- 3 action buttons: copy (clipboard) / view (new tab) / edit (3-step modal: enter → confirm consequences → type CHANGE)
- URL change is destructive — breaks existing shared links

### 7.3 Profile card

- 4 inline-edit rows: First name, Last name, Tagline, Instagram
- Tap row → text becomes editable input → save on blur with flash animation
- All fields: `PATCH /api/user/me { field }`

### 7.4 Contact card

- Email row → 2-step modal: enter new email → "Check your email" with tracker (Sent → Open email → Done)
- WhatsApp row → 3-step modal: enter number with country picker → OTP 6-digit entry → "WhatsApp changed!" confirmation with old→new card display

### 7.5 Preferences card

- Currency: display-only, not tappable. "Can't be changed after setup" subtitle in grey. No lock icon — the subtitle text is sufficient. Set at onboarding, stored as `users.currency`.
- Wishlist toggle: on/off, toggles `wishlist_public`. Subtext updates: "Visible on your page" / "Hidden from your page".
- Page live toggle: on/off, toggles `is_public`. When turning off with active paid listings → opens "Can't hide page" informational modal (Got it button, pink).

### 7.6 Account card

- Logout → clears session → `/auth`
- Delete profile → 2-step modal: consequence list + Keep/Delete → type DELETE to confirm

---

## 8. Modals Summary — Pattern Library

All modals on the Settings page follow the same chrome:

| Property | Value |
|---|---|
| Overlay | `rgba(0,0,0,0.7)` |
| Sheet | `#1c1c1c`, top corners 20px |
| Drag handle | 40×4px `#444`, centered |
| Padding | 24px 20px 32px |
| Title | 18px/700 white, centered |
| Subtitle | 13px/400 `#888`, centered |
| Input fields | `#111` bg, 10px radius, 14px 16px padding, 1px `#333` border → `#e91e8c` on focus |
| Error text | 11px `#ef4444`, below field |
| Primary button (destructive) | `#ef4444` red (URL change, delete profile) |
| Primary button (constructive) | `#e91e8c` pink (email, phone, bank) |
| Cancel/secondary button | `#262626` grey or text link `#888` |
| Disabled button | `#333` bg, `#666` text, `cursor: not-allowed` |
| Dismiss | Backdrop tap + drag handle + explicit cancel/close button. No "discard changes?" confirm. |

### Modals on this page

| Modal | Steps | Trigger |
|---|---|---|
| URL change | 3 (enter → confirm → type CHANGE) | Edit button on URL card |
| Email change | 2 (enter → check inbox) | Email row tap |
| WhatsApp change | 3 (enter → OTP → confirmed) | WhatsApp row tap |
| **Bank add/edit** | 1 (form → save) | Bank CTA or filled-row tap |
| Can't hide page | 1 (informational → Got it) | Page live toggle when blocked |
| Delete profile | 2 (confirm → type DELETE) | Delete profile row tap |

---

## 9. Mockup vs Production

| Mockup | Production |
|---|---|
| `mockUser.bank = null` shows State A | Server returns `has_bank_account: false` from `GET /api/user/me` → State A |
| `mockUser.bank = { ... }` shows State B | Server returns bank data from `GET /api/ambassador/bank-account` → State B |
| `showToast('Bank saved ✓')` | Same toast, triggered after real API response |
| IBAN validation client-only | Client check + full server validation on save |
| `row-saved-flash` animation after save | Same animation, same timing |
| All other modals (email, phone, URL, delete) unchanged | Unchanged — already production-annotated |

### Console test

To toggle between State A and State B in the mockup, set `mockUser.bank`:

```js
// Show empty state
mockUser.bank = null;
document.getElementById('bankEmpty').style.display = 'block';
document.getElementById('bankFilled').style.display = 'none';

// Show filled state
mockUser.bank = { bank_name: 'Emirates NBD', beneficiary_name: 'Sara Johnson', iban_last4: '4821', swift_code: 'ABORAEADXXX' };
document.getElementById('bankEmpty').style.display = 'none';
document.getElementById('bankFilled').style.display = 'block';
```

---

## 10. Files

- `settings_final.html` — interactive mockup (full settings page with bank card + modal)
- `settings_final_UI_Spec.md` — this document

---

## 11. Design Philosophy

- **Modal, not page.** Email, WhatsApp, and bank all use the same bottom-sheet modal pattern. No new route invented.
- **IBAN is never shown back.** Encrypted at rest, only last4 returned. Edit mode requires re-entry — same security posture as banking apps.
- **Audit before create.** Claude Code must check Supabase for existing bank tables before creating anything. Adapt existing tables with ALTER TABLE.
- **One table, plural name, shared across roles.** `user_bank_accounts` serves ambassadors now, professionals later. No role-specific tables.
- **No verification UI in V1.** Admin handles status manually. Keeps the ambassador experience simple — they add bank info, they get paid.
- **Dashboard hint stacking.** Bank missing takes priority over email missing. Both shown when both absent.
- **No deletion.** Bank accounts can be edited, never removed by the user. Prevents accidental payout failures.
- **Card flash, not green.** Save confirmation uses the existing `row-saved-flash` keyframe (dark → green → dark, 1.2s) + toast. No persistent green state.
