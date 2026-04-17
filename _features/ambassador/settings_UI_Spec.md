# Settings — UI Spec (FINAL)

**File:** `settings.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/settings`
**Access:** Authenticated ambassador only

---

## 1. Purpose

Single screen for managing: public page URL (slug), cover image, profile fields (name, tagline, Instagram), preferences (currency read-only, wishlist visibility, page live), account credentials (email, WhatsApp), and destructive actions (sign out, delete).

---

## 2. Navigation — Full Map

### 2.1 Inbound (single entry point)

| Source | Element | Trigger |
|---|---|---|
| Dashboard | "Settings" nav card | Tap — navigates to `/settings` |

No deep links, no email/SMS entry. Dashboard is the only way in.

### 2.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| Back arrow | `/dashboard` | Same | Hard-nav via `window.location.href`. Always to dashboard, never `history.back()`, even on deep-link entry. |
| Copy URL icon | (no navigation) | — | Writes `https://welovedecode.com/{slug}` to clipboard. Green check + "Copied!" text label (10px, non-bold, no background) appears centered above icon for 1.5s. No toast. |
| View page icon | `https://welovedecode.com/{slug}` | Same | Hard-nav. Waits for any in-flight optimistic save to complete before navigating. |
| Edit URL icon | (modal in-page) | — | Opens 3-step URL change modal |
| Cover camera icon | (native file picker) | — | OS file picker; accepts JPEG/PNG/WEBP |
| Cover drag (mousedown/touchstart) | (in-place reposition) | — | Live background-position update; debounced save (2s) on release |
| Profile row tap (first name, last name, tagline, Instagram) | (inline edit mode) | — | Row expands into editable input, 70-char maxlength |
| Email row tap | (modal in-page) | — | Opens Change email modal (2-step) |
| WhatsApp row tap | (modal in-page) | — | Opens Change WhatsApp modal (3-step) |
| Currency row | (no action) | — | Read-only display |
| Wishlist toggle | (no modal) | — | Optimistic write, flips instantly |
| Page live toggle OFF | (modal OR immediate) | — | If `has_active_paid_listings=true` → "Can't hide page" modal; else optimistic write |
| Page live toggle ON | (no modal) | — | Always allowed, optimistic write |
| Sign out row | `/auth` | Same | Calls `supabase.auth.signOut()` then hard-navigates. **No confirmation** — sign-out is reversible, confirmation would be friction. |
| Delete profile row | (modal in-page) | — | Opens 2-step Delete modal. Final confirm → `/auth` |
| Verification link in user's new email (after email change) | `/auth/email-confirmed` | Different tab | Out-of-band from this page — user opens in their email client |

### 2.3 Backend writes (all triggers and endpoints)

| Action | Trigger | Endpoint |
|---|---|---|
| Page load | Mount | `GET /api/user/me` — returns all fields in one call |
| Inline profile edit save | Blur or Enter key in edit input | `PATCH /api/user/me { [field]: value }` (optimistic — UI updates instantly, rollback + toast on failure) |
| URL change — live check (while typing) | Debounced 300ms keystroke in Step 1 | `GET /api/slug/check?value={slug}` → `{available, reason}`. **MUST be server-side — mockup's client array is placeholder. See §6.2.1.** |
| URL change confirm (Step 3) | "Change" button after typing CHANGE | Atomic uniqueness recheck (race-safe) → `UPDATE users SET slug = ?` with DB UNIQUE constraint (pessimistic — wait before closing modal). On 409 Conflict → reopen Step 1 with error. |
| Cover upload | File selected in picker | Supabase Storage upload to `cover-photos` bucket + `UPDATE users SET cover_photo_url = ?, cover_photo_position = 50` + delete previous Storage object |
| Cover reposition | 2s after drag-end (debounced) | `PATCH /api/user/me { cover_photo_position: 0-100 }` (optimistic) |
| Email change Step 1 submit | "Send verification" button | `supabase.auth.updateUser({ email })` — Supabase emails a verification link to the NEW address; old address stays active until link clicked |
| Email resend | "Resend" link (after 60s cooldown ends) | Same Supabase call; Supabase invalidates previous link server-side |
| WhatsApp change Step 1 submit | "Send code via WhatsApp" button | AUTHKey send endpoint — same service as onboarding |
| WhatsApp OTP verify | 6th digit entered | AUTHKey verify endpoint → on success `UPDATE users SET phone = ?` BEFORE Step 3 renders |
| WhatsApp OTP resend | "Resend code" link after 60s cooldown | AUTHKey resend endpoint; previous code invalidated |
| Wishlist toggle | Toggle tap | `PATCH /api/user/me { wishlist_public: bool }` (optimistic) |
| Page live toggle ON | Toggle tap | `PATCH /api/user/me { is_public: true }` (optimistic) |
| Page live toggle OFF | Toggle tap | `PATCH /api/user/me { is_public: false }` — server checks `has_active_paid_listings`; returns 403 with `{count, latest_expiry}` if blocked, or 200 OK |
| Sign out | "Log out" row | `supabase.auth.signOut()` → `window.location.href='/auth'` |
| Delete profile | "Delete" button after typing DELETE | Pre-delete cleanup (see §10) → hard `DELETE FROM users WHERE id = ?` with CASCADE |

### 2.4 Unclear / Out-of-scope items explicitly decided

| Item | Decision |
|---|---|
| Instagram field format | Store raw handle (no `@` prefix, no URL). If user pastes `@username` or `instagram.com/username`, strip to `username`. |
| Profile field max length | 70 characters for all (first_name, last_name, tagline, instagram). No visible counter. Enforced via `maxlength` on input. |
| Cover drag save frequency | Debounced 2000ms after last drag-end |
| Cover upload failure handling | Pessimistic upload. On failure: revert to old cover (stays visible throughout), show toast "Couldn't upload. Try again." User retries via camera icon. |
| WhatsApp set to same number | Block with inline error "This is already your number" under the input. Don't fire AUTHKey send. |
| Email pending state in Settings | No visible indication in the Email row. Row shows current (old) email until verification link clicked. |
| Country picker pre-selection | On modal open, parse current `users.phone` and pre-select the country whose `dial` is the longest matching prefix. |
| Sign out confirmation | None — single tap signs out immediately |
| Delete confirmation input casing | Case-insensitive. User can type `delete`, `DELETE`, `Delete` — all accepted. |
| Page offline display (when `is_public=false`) | TBD — visitor sees "This page is offline" placeholder. Separate mockup to be designed. |

---

## 3. Data Loading

Single endpoint on page mount:

```
GET /api/user/me
```

Returns all user fields in one response. Page renders instantly — no skeletons, no per-field fetches.

```json
{
  "id": "uuid",
  "slug": "sarajohnson",
  "first_name": "Sara",
  "last_name": "Johnson",
  "tagline": "Beauty lover from Dubai ✨",
  "instagram": "sarajohnson",
  "email": "sara@email.com",
  "phone": "+971501234567",
  "currency": "AED",
  "cover_photo_url": "https://.../cover-photos/uuid.jpg",
  "cover_photo_position": 50,
  "is_public": true,
  "wishlist_public": false,
  "has_active_paid_listings": true
}
```

---

## 4. Layout

1. Header: back arrow (to `/dashboard`) + "Settings" title
2. **Cover image** (120px, drag-to-reposition, camera icon)
3. Your page card (URL preview + Copy / View / Edit icons)
4. Profile card (First name, Last name, Tagline, Instagram — inline-edit rows, 70-char max each)
5. Account card (Email row → modal / WhatsApp row → modal)
6. Preferences card:
   - **Currency** (read-only display, shows "AED (⌐)" with lock icon)
   - **Beauty Wishlist** visibility toggle
   - **Page live** toggle
7. Sign out row
8. Delete profile row (destructive)

---

## 5. Cover Image

### 5.1 Source
Rendered from `users.cover_photo_url` + `users.cover_photo_position` on page load. **This is the identical image Sara uploaded during onboarding** — single source of truth, no duplicate records, no "onboarding cover" vs "settings cover" split. Onboarding writes it; Settings updates it; public page reads it. Last write wins.

### 5.2 Display
- 120px tall, 14px radius, full card width
- Camera icon bottom-right (34px circle, semi-transparent black) → triggers file picker to **replace** image
- **No "Drag to reposition" badge** — Sara already encountered drag during onboarding

### 5.3 Drag-to-reposition
- Drag vertically to update `background-position` live
- Works immediately on load (the existing cover is draggable — not only after a new upload)
- On release: 2000ms debounced save of `cover_photo_position` (0–100). Prevents server flood if user drags multiple times.

### 5.4 Upload new cover (pessimistic)
1. Tap camera → native file picker (JPEG, PNG, WEBP)
2. Client-side resize/compress if > 2MB (Canvas API)
3. Upload to Supabase Storage bucket `cover-photos`
4. On success: `UPDATE users SET cover_photo_url = ?, cover_photo_position = 50`, delete previous Storage file, cover refreshes in-place, toast "Cover saved ✓"
5. **On failure: revert UI to old cover (which was never replaced), show toast "Couldn't upload. Try again."**

Pessimistic (not optimistic) because showing a preview before upload confirmation would flash back to the old image if upload fails — jarring UX.

---

## 6. URL Card

### 6.1 Elements

| Element | Action |
|---|---|
| Copy icon | Copies `https://welovedecode.com/{slug}` to clipboard. Icon swaps to green check + "Copied!" text label (10px, non-bold, no background pill) appears centered above icon for 1.5s. No toast. |
| View icon | Hard-nav to `https://welovedecode.com/{slug}` in same tab. Blocks until any in-flight row save completes. |
| Edit icon | Opens 3-step URL change modal |

### 6.2 Edit URL modal — 3 steps, all destructive-red buttons (`#ef4444`)

**Step 1 — Edit slug**
- Input prefixed with `welovedecode.com/`
- Live uniqueness check (debounced 300ms) against reserved list + taken list
- Validation: min 3 chars, `[a-z0-9._-]` only
- Primary "Change" button enabled only when valid, available, and different from current

**Step 2 — Warnings**
- Heading: "Change your URL?"
- Preview: "Your new URL will be `welovedecode.com/{new}`"
- Three bullets: current URL will stop working, payment links will break, old URL released
- Buttons: "Keep" / "Change"

**Step 3 — Type to confirm**
- Copy: "Type **CHANGE** below to amend your URL"
- Input auto-capitalizes; typed text bold (weight 700)
- Confirm button enables only when value === "CHANGE"
- On confirm: pessimistic `UPDATE users SET slug = ?`
- On success: modal closes, URL card updates, toast "URL updated"
- On failure (race): error in modal, return to Step 1

All three primary buttons are red (`#ef4444`), not pink, matching the destructive nature.

### 6.2.1 ⚠️ CRITICAL — Slug uniqueness MUST be server-checked

**The mockup has a hardcoded client-side list (`['admin','sarah','beauty',...]`). This is placeholder only. Do NOT ship with client-side checking. Claude Code must replace it with real server calls.**

This is non-negotiable. A client-side list can be bypassed by editing the JS in devtools, would go stale the moment a new user signs up with a slug, and cannot catch race conditions between two ambassadors picking the same slug at the same moment. The only correct source of truth is the database.

#### Live check endpoint (Step 1 — debounced typing)

```
GET /api/slug/check?value={slug}
```

**Response shapes:**
```json
{ "available": true }

{ "available": false, "reason": "taken" }
{ "available": false, "reason": "reserved" }
{ "available": false, "reason": "invalid" }
{ "available": false, "reason": "same_as_current" }
```

**Frontend flow in Step 1:**
1. User types in slug input
2. Debounce 300ms after last keystroke
3. Fire `GET /api/slug/check?value={v}`
4. While pending → status label shows "Checking…" (grey, `#888`)
5. On response:
   - `available: true` → green "Available", pink "Change" button enabled
   - `reason: 'taken'` → red "Not available"
   - `reason: 'reserved'` → red "Reserved"
   - `reason: 'invalid'` → red "Letters, numbers, . _ - only" or "Min 3 characters"
   - `reason: 'same_as_current'` → red "This is your current URL"
6. Cancel any in-flight request when user types again (to avoid stale responses overwriting fresh ones)
7. Network error → treat as unavailable, show "Couldn't check. Try again." — do NOT optimistically enable the button

#### Server-side reserved list

Maintain a reserved list on the server (config file or DB table). At minimum include:
- Route names: `admin`, `api`, `auth`, `dashboard`, `settings`, `login`, `signup`, `logout`, `onboarding`
- Legal/brand: `welovedecode`, `wld`, `terms`, `privacy`, `legal`, `about`, `contact`
- Common system words: `test`, `null`, `undefined`, `true`, `false`, `help`, `support`
- Short generic: `home`, `app`, `www`, `mail`, `shop`

The frontend never sees this list. It only receives `{ reason: 'reserved' }`.

#### Atomic re-check on final submit (Step 3 — critical race condition)

Even with live checking in Step 1, the slug can be claimed by another user between Step 1 and Step 3. The `UPDATE users SET slug = ?` call MUST be:

1. **Atomic** — single transaction including the uniqueness check
2. **Protected by a DB unique constraint** on `users.slug` (cannot be bypassed even if application code has a bug)
3. **Return an error on conflict** — the frontend re-opens Step 1 with message "Someone just took this URL. Try another."

Pseudo-SQL pattern:
```sql
BEGIN;
  -- Supabase: let the unique constraint do the work
  UPDATE users
  SET slug = $1
  WHERE id = $2
  AND NOT EXISTS (SELECT 1 FROM users WHERE slug = $1 AND id != $2);
  -- If 0 rows affected → slug was taken in between → return 409
COMMIT;
```

#### Server validation rules (authoritative, enforced at API layer)

Regardless of what the frontend does, the server must:
- Reject any slug not matching `^[a-z0-9._-]{3,30}$`
- Reject any slug in the reserved list
- Reject slugs that are `SELECT slug FROM users WHERE slug = ?` already taken
- Lowercase-normalize before storing (defense against case-manipulation attacks)

#### Claude Code checklist

- [ ] Build `GET /api/slug/check?value={slug}` with the 5 response types above
- [ ] Maintain server-side reserved list (config file, not in code)
- [ ] Add UNIQUE constraint on `users.slug` in schema migration
- [ ] Wire frontend `umCheck()` to call the endpoint (debounced 300ms, cancel-on-retype)
- [ ] Show "Checking…" status while request is in flight
- [ ] On Step 3 confirm, handle 409 Conflict response → return user to Step 1 with error
- [ ] Remove mockup's hardcoded `reserved` and `taken` arrays from the final JS

### 6.3 Slug release (no history)
Released slugs go back to the pool. No `slug_history` table. Visiting an unassigned slug returns "This page is not available anymore".

---

## 7. Profile Card — Inline Edits

Four rows: First name, Last name, Tagline, Instagram. All optimistic.

### 7.1 Interaction
1. Tap row → value swaps to input (existing value pre-filled)
2. Edit, tap away (blur) or press Enter → saves
3. Press Escape → cancels (restores old value)

### 7.2 Rules per field
- All fields: `maxlength=70`, no visible counter
- Instagram: the stored value has no `@`. If user pastes `@sarajohnson` or `https://instagram.com/sarajohnson`, we normalize to `sarajohnson`
- Empty save → reverts to previous value (no empty names/taglines)

### 7.3 Save behavior
- Optimistic: `PATCH /api/user/me { [field]: value }` fires immediately, UI shows new value
- On success: green flash on row for 1.2s (no toast, no "Saved!" text — the flash is enough feedback)
- On failure: rollback to old value + error toast "Couldn't save, try again"

### 7.4 Edit-mode visual treatment (no field chrome)

When a row enters edit mode, there is **no border, no background change, no field chrome**. The cell visually stays as a row. Three subtle signals indicate editability:

1. **Pink caret** (`caret-color: #e91e8c`) — confirms the row is receiving input
2. **Pink selection highlight** (`::selection { background:#e91e8c; color:#fff }`) — the pre-selected existing value reads as pink-on-white for a beat when the row is tapped
3. **The user just tapped it** — the fact that it's now editable IS the affordance

No pink border. Pink is reserved for meaningful semantic states (Live / Visible / Confirmed / CTAs). Transient editing isn't a meaningful state — it's an action — and doesn't deserve the same visual weight as "Your page is live" or "Email changed!". Giving every edit a pink frame dilutes the accent color everywhere else.

---

## 8. Account Card

### 8.1 Change Email (2-step modal)

**Step 1 — Enter new email**
- Input with format validation on blur
- Pink "Send verification" button (stays pink; when submitting, dims to 70% opacity with "Sending…" text — never turns green)
- Inline errors (red, under input):
  - Invalid format → "Enter a valid email"
  - Supabase `email_exists` → "This email is already in use"
- Cancel closes modal

**Step 2 — Check your email** (modal stays open, swaps content)
- Heading: "Check your email"
- Body: "We sent a verification link to **{new_email}**"
- **Progress tracker** (same vocabulary as auth magic-link page): Sent ✓ (pink fill) → Open email (pink outline, active) → Done (grey future)
- Reassurance block: "Your current email stays active until you click the verification link. The link expires in 10 minutes."
- **Resend link** (plain text, no badge):
  - Idle → "Resend" (pink)
  - Tap → "Code sent" (plain text, same pink, no background/green) for 2s
  - Cooldown → "Resend (60s)" → "Resend (1s)" (pink, 50% opacity, not-allowed cursor)
  - Returns to idle
- Pink **"Got it"** button explicitly dismisses

**After user clicks verify link:** lands on `/auth/email-confirmed` (separate mockup `change_email_confirmation_final.html`). See that spec for details.

**No visible pending state** in the Settings Email row. Row shows current (old) email until verification completes.

### 8.2 Change WhatsApp (3-step modal, AUTHKey)

**Step 1 — Enter number**
- **Country picker** ported exactly from `auth_page_final.html` (full country list, POPULAR + A-Z sections, search with 1-letter-scroll and 2+ char-filter, phoneFormats map, formatPhoneNumber()). Same code, no new component.
- **Country pre-selected** on modal open based on current `users.phone` (longest matching dial-code prefix wins)
- Phone input with country-specific format mask applied live
- Digits-only input (letters/paste-garbage stripped)
- Pink "Send code via WhatsApp" button (no WhatsApp icon). Active when digits ≥ 7.
- **Same-number guard:** if user enters their current number, block with inline error "This is already your number" — don't fire AUTHKey send
- **No tracker on Step 1** (matches email flow)

**Step 2 — Enter OTP**
- **Tracker appears:** Send ✓ → Enter code (active) → Done (future)
- 6-digit auto-advancing cells, backspace goes back
- Resend link (plain text, same pattern as email): "Resend code" → "Code sent" 2s → "Resend in 60s" countdown
- Back button returns to Step 1 (user can edit number)
- Cancel closes modal
- On 6 digits entered → auto-submit to AUTHKey verify
- On failure: red "Wrong code, try again"; cells cleared, refocus first; allow retry

**Step 3 — WhatsApp changed!** (NEW — no longer auto-close)
- Full tracker filled pink: Send ✓ → Enter code ✓ → Done (active label)
- Title: "WhatsApp changed!"
- **Old → New cards** (identical layout to `change_email_confirmation_final.html`):
  - Old: previous number (grey, neutral border)
  - →  pink arrow
  - New: new number (white bold, pink border)
- Both cards have centered content
- Pink **"Done"** button closes modal

**Backend write (Supabase):** `UPDATE users SET phone = ? WHERE id = ?` fires the moment AUTHKey returns a successful verify — BEFORE Step 3 renders. If verify fails, no DB write, user stays on Step 2.

---

## 9. Preferences Card

### 9.1 Currency (read-only)
- Displays `users.currency` with inline symbol (e.g. "AED (⌐)")
- Lock icon on right
- Subtitle: "Can't be changed after setup"
- No interaction

### 9.2 Beauty Wishlist visibility (toggle)
- Controls the entire "My Beauty Wishlist" section on the public ambassador page (every item under that heading — Salon de Luxe, Lash Salon, etc.)
- **Field:** `users.wishlist_public BOOLEAN DEFAULT true`
- Subtitle colors (both states pink since both are valid choices):
  - ON: "Visible on your page" (pink)
  - OFF: "Hidden from your page" (pink)
- Optimistic write, no modal
- Deep link `welovedecode.com/wishlist/{slug}` falls back to the offline/not-available page when `wishlist_public=false`

### 9.3 Page live (toggle)
- Controls entire public page visibility
- **Field:** `users.is_public BOOLEAN DEFAULT true`
- Subtitle: "Your page is visible" (ON, pink) / "Your page is hidden" (OFF, grey)
- ON → always allowed
- OFF → server check for `has_active_paid_listings`:
  - If TRUE → "Can't hide page" modal, toggle reverts, no DB write
  - If FALSE → optimistic write
- When OFF, visitors to `welovedecode.com/{slug}` see the offline page (separate mockup TBD)

### 9.4 "Can't hide page" modal (`hm`)

Informational. Ambassador can only acknowledge.

**Heading:** "Can't hide page"

**Body (two lines, `<br>`):**
> You have active paid listings.
> Your page stays visible until they expire.

**Info card** (`#111` background, 10px radius, no colored accent stripe):
- Title: `{count} active listing(s)` — 13px/500 white
- Subtitle: `Hideable from {latest_expires_at + 1 day, long format}` — e.g. `Hideable from 11 April 2026`
  - Long format always (`April`, never `Apr`)
  - `+ 1 day` because listing expiry is inclusive (valid through 10 April, so hideable from 11 April)
  - Start date of the valid action, not end date

**Button:** Pink "Got it". Closes modal. Toast: "Got it — page stays visible".

**Server enforcement:**
1. Tap toggle OFF → `PATCH /api/users/me { is_public: false }`
2. Server checks for active paid listings
3. Blocked → `403` with `{ blocked_by_listings: count, latest_expiry: 'YYYY-MM-DD' }`
4. Frontend opens modal with count + `latest_expiry + 1 day`
5. Not blocked → `200 OK`, DB updated

Count + date always from server response, never cached client-side.

"Active paid" excludes free trials. Trials hide with the page without blocking.

---

## 10. Delete Profile — Hard Delete (2-step modal)

**Step 1 — Info**
- Heading: "Delete profile?"
- 4 bullets: page deleted, listings removed, URL released, cannot be undone
- "Keep" / "Delete" (red) buttons

**Step 2 — Type to confirm**
- Copy: "Type **DELETE** below to confirm"
- Placeholder: DELETE
- Input: auto-capitalize on mobile. **Case-insensitive match** — `delete`, `Delete`, `DELETE` all accepted.
- Red "Delete" button enables on match
- On confirm: pre-delete cleanup → hard `DELETE users CASCADE` → redirect to `/auth`

**Pre-delete cleanup checklist:**
1. Active paid listings on the ambassador's page — packages end with the profile deletion. **No refund logic** (packages are time-windowed, not subscriptions).
2. Supabase Storage: remove cover photo, profile photos, listing media files
3. Pending Stripe gift payments (if any): handled per policy — separate from this flow
4. Cascade delete DB rows: listings, wishes, gifts, events, user

---

## 11. Sign Out

- Single tap signs out immediately — no confirmation modal
- Calls `supabase.auth.signOut()` then `window.location.href='/auth'`
- **No confirmation** — reversible action; friction would be unjustified

---

## 12. Offline Page (TBD)

When `users.is_public = false`, visitors to `welovedecode.com/{slug}` or `welovedecode.com/wishlist/{slug}` see an offline page. **Not yet designed** — separate mockup to build.

Open questions for that mockup:
- Generic "not available" vs explicit "offline" framing
- Branded with logo vs minimal
- CTA back to homepage yes/no
- Does shared wish link behave the same way

---

## 13. Build Notes for Claude Code

- **Slug uniqueness — CRITICAL:** see §6.2.1. Must be server-checked via `GET /api/slug/check`, NOT the mockup's hardcoded client-side array. DB needs UNIQUE constraint on `users.slug`. Step 3 confirm must re-check atomically for race conditions.
- **Email via Supabase:** use built-in `supabase.auth.updateUser({ email })`. Verification link redirects to `/auth/email-confirmed` per Supabase `redirectTo` config
- **WhatsApp via AUTHKey:** reuse existing send/verify endpoints from `auth_whatsapp_code_verify_final.html`
- **Country data is single source:** same `countries` array + `phoneFormats` + `formatPhoneNumber()` as `auth_page_final.html`. Do NOT create a second data file
- **Cover storage:** single `cover-photos` Supabase Storage bucket shared with onboarding. Single `users.cover_photo_url` + `users.cover_photo_position` columns — no split
- **No `slug_history` table** — released slugs return straight to the pool
- **Optimistic writes** (profile edits, wishlist toggle, page live ON, cover position): UI updates instantly, rollback on error
- **Pessimistic writes** (slug change, cover upload): wait for server before closing/confirming
- **Toast system:** single reusable `showToast(msg)` — already implemented

---

## 14. Files

- `settings.html` — interactive mockup
- `settings_UI_Spec.md` — this document
- Related: `change_email_confirmation_final.html` / spec (Step 3 of email change), `auth_page_final.html` (country picker data source), `modal_settings__toggle_hide_page.html` (hide-page modal reference)
