# Listings Page — UI Spec (Final)

**File:** `listings_final.html` (single merged file — listings + delete modals + delete toasts + celebration toast)
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/listings`
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Index of all the ambassador's listings. Filterable by status. Each card has Share (= send payment link) and Delete actions. Delete opens one of two bottom-sheet modals depending on state; successful deletes fire a toast using the same chrome as the celebration toast. Everything lives in one file — no separate modal file, no parallel toast system.

---

## 2. Navigation — Entry Points & Exits

### 2.1 Inbound entry points

| Source | Element | URL |
|---|---|---|
| Dashboard | "Listings" nav card | `/listings` |
| Add Listing (trial path) | Auto-redirect after submit | `/listings?new={id}&type=trial` |
| Stripe webhook (paid activation) | Auto-redirect on next visit | `/listings?new={id}&type=paid` |
| Send Payment Link | "Skip for now" or after WhatsApp send | `/listings` |
| Browser back from sub-pages | Native gesture | — |

### 2.2 Outbound exits — full map

| Element | Destination | Data written | Trigger fired |
|---|---|---|---|
| Back arrow | **Dashboard** (`/dashboard`, fixed, not history.back) | None | None |
| `+` button | `/listings/new` (Add Listing) | None | None |
| Share icon | `/listings/:id/payment` (single URL, server renders state) | None | None |
| Delete icon (removable listing) | Opens Modal 1 in-page | None | None |
| Delete icon (active paid listing) | Opens Modal 2 in-page | None | None |
| Modal 1 · **Keep** | Closes modal | None | None |
| Modal 1 · **Remove** | Closes modal, fires DELETE | Soft delete on 200 | `listing:removed` / `listing:remove_failed_stale` / `listing:remove_failed_network` |
| Modal 2 · **Got it** | Closes modal | None | None |
| Drag handle (swipe > 40%) | Closes any modal | None | None |
| Backdrop tap (dimmed area) | Closes any modal | None | None |
| Empty-state CTA | `/listings/new` | None | None |
| Filter tab | Client-side show/hide only | None | None |
| Pull-to-refresh | Re-runs page-load query | None | None |
| Card body (non-icon area) | **No action** | — | — |

### 2.3 Share icon — state-aware routing

Server reads `listing.status` and renders the correct Send Payment Link state:

| Listing status | Send Payment Link state shown |
|---|---|
| `pending_payment` | S1 — Awaiting payment |
| `active_trial` | S2 — Trial |
| `active_paid` | S3 — Renewal |
| `expired` | S1 — Re-activate |

One URL (`/listings/:id/payment`), state decided server-side from the current `listings` row. The client doesn't pass state as a query param — this keeps URLs clean and prevents stale state (if listing moved from trial → paid between page load and tap, the server renders the correct current state).

---

## 3. Layout

1. Header: back arrow (left → Dashboard) + "Listings" title + `+` button (right, pink outlined circle → Add Listing)
2. Filter tabs: All / Active / Trial / Pending / Expired
3. Listing cards (all loaded on mount — no pagination)
4. Celebration toast (fires on page load if `?new=…` URL flag present)
5. Delete toast (fires on trigger after delete action)
6. Delete modal (bottom sheet, opens on waste-bin tap)

---

## 4. Filter Tabs — Client-Side Only

All listings load on page mount. Filter tabs hide/show cards in the existing dataset — no extra queries.

| Tap | Show cards where |
|---|---|
| All | (all statuses) |
| Active | `status === 'active_paid'` |
| Trial | `status === 'active_trial'` |
| Pending | `status === 'pending_payment'` |
| Expired | `status === 'expired'` |

Instant filter switching, no loading states.

---

## 5. Loading

- **Load all listings on page mount** — single query, no pagination
- **Pull-to-refresh:** native gesture, re-runs the page-load query. Spec-only — not visually built in the mockup.
- Future: if ambassadors start hitting hundreds of listings, can be paginated server-side later without breaking anything else.

---

## 6. Card Interactions

| Element | Action |
|---|---|
| Card body | **No action** (only icons are tappable) |
| Share icon | → `/listings/:id/payment` (server-rendered state) |
| Delete icon — removable | Opens Modal 1 |
| Delete icon — active paid | Opens Modal 2 |

---

## 6.5 Urgency Coloring — "X days left" + Share Icon

Both the "X days left" text and the share icon change color based on listing status + days remaining.

### Rule

- **"X days left" text** = status indicator → follows listing-type color (blue=trial, pink=paid urgency)
- **Share button** = CTA → always pink when action is recommended, otherwise grey

### Color matrix

| Status | "X days left" | Share button |
|---|---|---|
| Active paid > 7 days | grey `#777` | grey `#666` |
| Active paid ≤ 7 days | pink `#e91e8c` + bold | pink `#e91e8c` |
| Trial > 7 days | grey `#777` | grey `#666` |
| Trial ≤ 7 days | blue `#38bdf8` + bold | pink `#e91e8c` |
| Pending | always pink `#e91e8c` + bold | always pink `#e91e8c` |
| Expired | grey `#777` | grey `#666` |

### State transitions

- Trial → paid → Active paid coloring
- Pending → paid → Active paid coloring
- Expired → pending (re-activated) → Pending coloring
- Active paid expires → Expired → goes grey

### Implementation

```js
function getDaysColor(status, daysLeft) {
  if (status === 'pending_payment') return '#e91e8c';
  if (status === 'expired') return '#777';
  if (daysLeft > 7) return '#777';
  if (status === 'active_paid') return '#e91e8c';
  if (status === 'active_trial') return '#38bdf8';
  return '#777';
}
function getShareColor(status, daysLeft) {
  if (status === 'expired') return '#666';
  if (status === 'pending_payment') return '#e91e8c';
  if (daysLeft <= 7) return '#e91e8c';
  return '#666';
}
function getDaysWeight(status, daysLeft) {
  if (status === 'pending_payment') return 700;
  if (status === 'expired') return 400;
  return daysLeft <= 7 ? 700 : 400;
}
```

---

## 7. Delete Flow — Modals + Toasts

### 7.1 Decision logic — which modal opens

Client-side check on `listing.status`, using data already in memory:

```js
function pickDeleteModal(listing) {
  const isActivePaid = listing.status === 'active_paid'
                    && new Date(listing.expires_at) >= new Date();
  return isActivePaid ? 'blocked' : 'remove';
}
```

- Trial / Pending / Expired → **Modal 1 — Remove listing?**
- Active paid (not yet expired) → **Modal 2 — Can't remove listing**

Backend **re-validates** on the actual DELETE call (see §7.8). The client decision is for UX speed, not trust.

### 7.2 Data source — info card (both modals)

Each listing row carries the data needed to populate its modal via `data-*` attributes. **No re-fetch** — modal reuses what the page already loaded on mount.

| Attribute | Used for |
|---|---|
| `data-id` | DELETE request path |
| `data-name` | Info card title |
| `data-category` | Info card category (pink label) |
| `data-location` | Info card location (grey label) |
| `data-removable` | `"yes"` or `"no"` — which modal opens |
| `data-removable-from` | Modal 2 only — pre-formatted "Removable from" date |

**Info card is display-only.** Not tappable. No navigation from it.

### 7.3 "Removable from" date — pre-computed server-side

The date shown in Modal 2 ("Removable from 5 July 2026.") is **pre-computed and pre-formatted by the backend** via a shared utility:

```js
// Shared across delete-listing AND hide-page endpoints
function computeAvailableFrom(expiresAt) {
  return addDays(expiresAt, 1);  // expires_at is inclusive → +1 day
}
```

Backend response shape per listing:

```js
{
  id: 'lst_abc123',
  name: 'Salon de Luxe',
  category: 'Hair',
  location: 'Dubai, UAE',
  status: 'active_paid',
  expires_at: '2026-07-04',
  removable_from_formatted: '5 July 2026',  // ← used verbatim in Modal 2
  ...
}
```

Client does **no date math** — renders the string as received. The `+1 day` rule lives in one shared backend function so it can't drift between features.

### 7.4 Modal 1 — "Remove listing?"

**Shown for:** Trial / Pending / Expired

| Element | Spec |
|---|---|
| Title | "Remove listing?" (18px/700 white, centered) |
| Body (two lines via `<br>`) | "This removes the listing from your page." / "The payment link will no longer be valid." (13px/400 `#888`, 1.5 line-height, centered) |
| Info card | Name (14px/500 white) · category (11px/400 `#e91e8c`) · location (11px/400 `#888`) |
| Left button | **Keep** — `#262626` grey, 14px/600 white |
| Right button | **Remove** — `#e91e8c` pink, 14px/600 white |

### 7.5 Modal 2 — "Can't remove listing"

**Shown for:** Active paid (not yet expired)

| Element | Spec |
|---|---|
| Title | "Can't remove listing" (18px/700 white, centered) |
| Body (two lines via `<br>`) | "This listing is active with a paid package." / "Removable from {removable_from_formatted}." |
| Info card | Identical to Modal 1 |
| Single button | **Got it** — `#e91e8c` pink, full width |

No cancel button. The single button is the primary action and gets the primary color.

**No refunds.** Once paid, the professional gets the full paid period regardless of the ambassador's intent to remove.

### 7.6 Modal chrome (shared by both)

| Property | Value |
|---|---|
| Overlay | `rgba(0,0,0,0.7)`, fade in 200ms |
| Sheet background | `#1c1c1c`, top corners rounded 20px |
| Sheet animation | Slide up 250ms `cubic-bezier(.2,.7,.2,1)` |
| Drag handle | 40×4px `#444` bar, centered top |
| Padding | 24px 20px 32px |
| Info card | `#111` background, 10px radius, 14px padding |

### 7.7 Dismiss behavior

| Action | Modal 1 | Modal 2 |
|---|---|---|
| Tap Keep | Closes, no action | N/A |
| Tap Remove | See §7.8 | N/A |
| Tap Got it | N/A | Closes |
| Swipe down on drag handle (past 40% of sheet height) | Closes | Closes |
| Tap dimmed backdrop | Closes | Closes |

No X button. No "are you sure?" on dismiss.

### 7.8 Remove flow (Modal 1 → Remove button)

Modal closes **immediately** (250ms slide down). Feedback surfaces via the delete toast on the Listings page.

1. User taps Remove
2. Modal starts closing
3. Frontend sends `DELETE /api/ambassador/listings/:id`
4. **Backend re-validates** — does not trust the client's earlier decision:
   - Re-reads `listings.status` and `listings.expires_at` with row lock (`SELECT … FOR UPDATE`)
   - If now `active_paid` and not yet expired → returns `409 Conflict` with body:
     ```json
     {
       "error": "listing_now_active",
       "listing": { /* fresh full listing object */ }
     }
     ```
   - Otherwise → `UPDATE listings SET status='deleted', deleted_at=NOW()` → returns `200 OK`
5. Frontend response handler fires one of three triggers:

| Response | Trigger | Toast variant | Row behavior |
|---|---|---|---|
| `200 OK` | `listing:removed` | 🗑️ **success** | Row fades out, collapses, removes from DOM |
| `409 Conflict` | `listing:remove_failed_stale` | 🔒 **error_stale** | Row updated in place from `response.listing` (new status, new colors). No extra fetch. |
| Network / 5xx | `listing:remove_failed_network` | 📡 **error_network** | Row unchanged |

The modal is a thin UI layer — it fires the trigger; the Listings page owns the row animation and toast.

---

## 7.9 Delete Toast System

One reusable toast component, three variants. **Identical chrome and animation to the celebration toast** — copy-reuse, not a parallel system.

### Variants

| Variant | Emoji | Title | Subline | Fires on |
|---|---|---|---|---|
| `success` | 🗑️ | Listing removed | Payment link is no longer valid | `200 OK` |
| `error_stale` | 🔒 | Can't remove | This listing is paid and now active | `409 Conflict` |
| `error_network` | 📡 | Couldn't remove | Check your connection and try again | Network / 5xx |

All three share identical chrome. Only emoji and copy differ.

### Chrome (identical to celebration toast)

| Property | Value |
|---|---|
| Position | `position: absolute; top: 65px; left: 6px; right: 6px` |
| Background | `#0c0c0c` |
| Border radius | `12px` |
| Padding | `14px` |
| Gap (emoji ↔ text) | `12px` |
| Box shadow | `0 4px 8px rgba(0, 0, 0, 0.6)` |
| Emoji size | `22px`, `line-height: 1` |
| Title | `13px / 700 #fff`, `margin-bottom: 2px` |
| Subline | `11px / 400 #999` |
| z-index | `51` (one above celebration toast's 50, so a delete toast overlays a still-fading celebration) |

### Animation

| Phase | Timing |
|---|---|
| Entry delay | `0ms` (trigger-driven, fires immediately on response) |
| Fade in | `1200ms cubic-bezier(.2, .7, .2, 1)` — slides up + fades in |
| Stays visible | ~2800ms |
| Exit starts | At `4000ms` total elapsed |
| Fade out | `1200ms cubic-bezier(.5, .2, .8, .1)` — slides down + fades out |

Total on-screen ~5.2s.

### Toast interaction

**Toasts are not tappable.** `pointer-events: none` on the toast element. Auto-dismiss after the animation duration — no click, no swipe, no undo. Simple, predictable.

### Celebration vs delete toast conflict

If ambassador lands on `/listings?new=…` and deletes a listing while the celebration toast is still showing, the delete toast **overlays** it (higher z-index). Last event wins. One slot, no queue.

---

## 7.10 Celebration Toast — "Trial is live" / "Listing is live"

Shown **once** when ambassador arrives at `/listings` after creating a new listing. URL flag pattern.

### Entry mechanism

**Trial path:**
- Add Listing → trial toggle ON → submit
- Redirects to `/listings?new={id}&type=trial` (no payment needed)

**Paid path (Stripe webhook):**
1. Ambassador sends payment link via WhatsApp
2. Professional pays via Stripe
3. Stripe webhook fires → backend updates:
   - `listings.status = 'active_paid'`
   - `listings.paid_package_days = 30|60|90` (from what pro chose at checkout)
   - `listings.expires_at = now() + paid_package_days`
   - `listings.celebrated_at = NULL`
4. Ambassador notified (email + WhatsApp via AUTHKey)
5. On ambassador's next visit, server checks for listings where `celebrated_at IS NULL AND status = 'active_paid'`, redirects to `/listings?new={id}&type=paid`, then sets `celebrated_at = NOW()` so it only fires once.

### Schema addition

```sql
ALTER TABLE listings ADD COLUMN celebrated_at TIMESTAMP NULL;
```

### On page mount

```js
const params = new URLSearchParams(window.location.search);
const newId = params.get('new');
const type  = params.get('type');
if (newId) {
  showCelebration(type);
  history.replaceState({}, '', '/listings'); // clear URL flag
}
```

### Copy variants

| Variant | Title | Subline |
|---|---|---|
| Trial (`type=trial`) | Trial is live 🎉 | 30 days on your page |
| Paid (`type=paid`) | Listing is live 🎉 | {paid_package_days} days on your page |

### Behavior

- Auto-dismisses (~5s)
- **Not tappable** (same rule as delete toast — `pointer-events: none`)
- URL cleaned immediately on mount so refresh/bookmark won't re-fire
- Same measurements + animation as §7.9 delete toast — identical chrome

---

## 8. Empty State

**Spec-only — not built in the mockup** (mockup always has example data).

When 0 listings are visible:

| Condition | Message | CTA |
|---|---|---|
| 0 listings overall | "No listings yet" | "Add your first listing" → `/listings/new` |
| Filter active, 0 in that filter | Filter-specific: "No active listings" / "No trial listings" / etc. | "Add your first listing" → `/listings/new` |

Centered in the listings area, below the filter tabs.

---

## 9. Triggers & Backend Writes

### Triggers fired

| Trigger | Fired when | Payload | Result on Listings page |
|---|---|---|---|
| `listing:removed` | Remove → 200 OK | `{ listing_id }` | Row fade-out + collapse + 🗑️ toast |
| `listing:remove_failed_stale` | Remove → 409 | `{ listing_id, listing }` (fresh state) | Row updated in place from `listing` + 🔒 toast |
| `listing:remove_failed_network` | Remove → network/5xx | `{ listing_id }` | Row unchanged + 📡 toast |

### Backend writes & queries

| Action | Query |
|---|---|
| Page load | `SELECT * FROM listings WHERE user_id=? AND status!='deleted' ORDER BY created_at DESC` |
| Filter change | Client-side only — no query |
| Pull-to-refresh | Re-run page-load query |
| Remove confirm (200 path) | `UPDATE listings SET status='deleted', deleted_at=NOW() WHERE id=? AND user_id=?` (after re-validation check inside a row lock) |
| Celebration fires | `UPDATE listings SET celebrated_at=NOW() WHERE id=? AND celebrated_at IS NULL` |

---

## 10. Build Notes for Claude Code

### Schema

```sql
ALTER TABLE listings ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE listings ADD COLUMN celebrated_at TIMESTAMP NULL;
ALTER TABLE listings ADD COLUMN paid_package_days INT NULL;
-- status enum must include 'deleted'
```

All non-admin queries must append: `AND status != 'deleted'`.

### Removable check (backend, authoritative)

```js
function isRemovable(listing) {
  return listing.status !== 'active_paid'
      || new Date(listing.expires_at) < new Date();
}
```

### Shared date utility

```js
function computeAvailableFrom(expiresAt) {
  return addDays(expiresAt, 1);  // expires_at is inclusive
}
// Used by both delete-listing (for removable_from_formatted)
// and hide-page (for hideable_from_formatted) endpoints.
```

### Status indicator colors (right-side status label on cards)

| Status | Hex |
|---|---|
| `active_paid` | `#4ade80` green |
| `active_trial` | `#38bdf8` blue |
| `pending_payment` | `#e91e8c` pink |
| `expired` | `#555` grey |
| `deleted` | never shown |

### Button color rule — system-wide

- **Single-button informational modal** → pink `#e91e8c`
- **Two-button confirm/cancel modal** → grey `#262626` cancel + pink/red primary
- Grey is never the primary color

| Modal | Buttons |
|---|---|
| Hide page | Got it (pink) |
| Delete listing — can remove | Keep (grey) · Remove (pink) |
| Delete listing — can't remove | Got it (pink) |
| Deactivate page step 1 | Keep (grey) · Deactivate (red) |
| Deactivate page step 2 | Keep (grey) · Deactivate (red, enabled after typing) |
| Delete wish | Keep (grey) · Remove (pink) |

---

## 11. Mockup vs Production

The HTML contains **7 hardcoded listing rows** as visual examples covering every coloring state (trial normal, active normal, active urgent, trial urgent, trial, pending, expired). Each row carries `data-id`, `data-name`, `data-category`, `data-location`, `data-removable`, and `data-removable-from` so the delete modal can populate itself directly from the row.

In production, Claude Code replaces these static rows with a **dynamic render loop** over the Supabase query results. The markup structure stays identical — same `data-*` attributes, populated from the backend response. The modal logic, drag-to-dismiss, backdrop tap, toast system, and trigger handlers are unchanged.

### Render loop example (production)

```js
function renderListings(listings) {
  container.innerHTML = listings.map(l => `
    <div
      data-state="${mapStatusToState(l.status)}"
      data-id="${l.id}"
      data-name="${escapeHtml(l.name)}"
      data-category="${escapeHtml(l.category)}"
      data-location="${escapeHtml(l.location)}"
      data-removable="${isRemovable(l) ? 'yes' : 'no'}"
      ${l.removable_from_formatted
         ? `data-removable-from="${l.removable_from_formatted}"`
         : ''}
      style="…">
      …
    </div>
  `).join('');
}
```

### Console demo — preview all toast variants

```js
demoToast('success');        // 🗑️ Listing removed
demoToast('error_stale');    // 🔒 Can't remove — paid & active
demoToast('error_network');  // 📡 Couldn't remove — connection
```

Lets reviewers preview all three variants without simulating backend failures.

---

## 12. Files

- `listings_final.html` — single merged mockup (listings + modals + toasts)
- `listings_final_UI_Spec.md` — this document

---

## 13. Design Philosophy

- **Client decides, backend validates.** Fast UX (instant modal open from in-memory data) + correct state (backend is source of truth on the actual delete).
- **One toast component, multiple variants.** Emoji + copy carry semantic meaning; chrome stays constant.
- **Toasts are not tappable.** Auto-dismiss only. Simple, predictable.
- **Informational modals tell you *when*, not just *that*.** Every blocking modal tells the user the exact date the action becomes available.
- **One rule for button colors.** Single-button = pink. Two-button = grey cancel + pink/red primary.
- **Two-line body text with `<br>`.** Forced line breaks separate distinct thoughts — the *what* and the *why*.
- **Shared math across features.** `computeAvailableFrom(expires_at)` is shared between delete-listing and hide-page endpoints.
- **The modal is a thin UI layer.** It fires triggers; the Listings page handles row animations and toasts.
- **One file, one truth.** Listings, modals, and toasts live in the same file. No separate files to drift apart.
