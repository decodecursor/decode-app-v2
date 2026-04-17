# Payouts List — UI Spec (FINAL)

**File:** `payouts_list_final.html`
**Project:** WeLoveDecode — ambassador platform (WLD)
**Route:** `/model/payouts`
**Access:** Authenticated — ambassador role only

---

## 1. Purpose

Lists all payouts for the logged-in ambassador. Two visual sections:

- **Next payout card** — upcoming scheduled payout (when, how much)
- **History card** — paginated list of all past payouts, tappable to view detail

Replaces what used to be the first overlay inside `analytics_final.html`. Now a real URL — bookmarkable, shareable, deep-linkable from emails.

---

## 2. Why this page is a real URL (not an overlay)

**Old behavior:** Tapping "View payouts →" on `/model/analytics` opened a sliding overlay. Tapping a row opened a second overlay.

**Problems:**
- Browser back button broke (which overlay closes first?)
- Couldn't share specific payouts with support
- Couldn't bookmark
- Two stacked overlays = z-index/focus management issues

**New behavior:** real navigation. Each level has its own URL. Industry standard (Stripe, Linear, Notion).

---

## 3. Navigation — Full Map

### 3.1 Inbound (entry points)

| Source | Element | Behavior |
|---|---|---|
| `/model/analytics` | "View payouts →" link in earnings card | Real navigation (formerly opened overlay) |
| Email — payout completed notification | "View payouts" CTA | Direct deep link |
| Direct URL / bookmark | — | Loads list, requires auth |
| Settings (potential future) | "Payout history" row | Direct navigation |

### 3.2 Outbound (all exits)

| Element | Destination | Mechanism |
|---|---|---|
| Back arrow (top-left) | `/model/analytics` via `history.back()`; fallback to `/model/analytics` if no history | JS click handler |
| Any payout row | `/model/payouts/{id}` | Same tab, full navigation |

### 3.3 Backend reads

```
GET /api/model/payouts
Auth: required (ambassador session)

Response:
{
  "next": {
    "amount": 340.00,
    "currency": "USD",
    "scheduled_for": "2026-04-15",          // next Wednesday
    "status": "scheduled" | "processing"
  },
  "history": [
    {
      "id": "P8473921",                      // statement reference
      "date": "2026-04-08",                  // when paid
      "amount": 420.00,
      "currency": "USD",
      "status": "paid" | "processing" | "failed"
    },
    ...
  ],
  "total": {                                  // sum of history
    "amount": 1740.00,
    "count": 5
  }
}
```

### 3.4 Backend writes

**None.** Read-only page.

---

## 4. Layout (top to bottom)

1. **Header** — back arrow + "Payouts" title (20px / 700)
2. **Next payout card** — dark grey `#1c1c1c` rounded card
   - Label "Next payout" (top-left, 11px `#666`)
   - Status badge "SCHEDULED" (top-right, green `#34d399` pill)
   - Amount (28px / 700) + currency code (11px / 600 `#666`)
   - Scheduled date (10px `#777`)
3. **History card** — dark grey `#1c1c1c` rounded card
   - "Total" label + "{count} payouts" + grand total amount
   - Divider line
   - Payout rows: date + reference (left), amount + status (right)
   - Hover state: row background lightens to `#262626`
4. **Bottom padding** — 20px

---

## 5. Color & Typography

| Element | Token |
|---|---|
| Page background (outer) | `#111` |
| Frame background | `#000` |
| Frame border | `2px #1a1a1a` |
| Card background | `#1c1c1c` |
| **Row hover background** | **`#262626` (LIGHTER than card — surfaces the row)** |
| Title (20px / 700) | `#fff` |
| Big amount (28px / 700) | `#fff` |
| Currency code (11px / 600) | `#666` |
| Row date (14px / 700) | `#fff` |
| Row reference (10px) | `#777` |
| Row amount (15px / 600) | `#fff` |
| Row status "Paid" (10px) | `#34d399` |
| Status badge bg | `#34d399` |
| Status badge text | `#000` weight 700 |
| Card divider | `1px #1f1f1f` |

---

## 6. Interactions

| Element | Action | Result |
|---|---|---|
| Back arrow | Tap | History back; fallback to `/model/analytics` |
| Back arrow | Press / active | Scale 0.9 (tactile feedback) |
| Payout row | Hover | Background lightens to `#262626`, rounded edges visible |
| Payout row | Tap | Navigates to `/model/payouts/{id}` |
| JS disabled | — | Page renders; back arrow + rows do nothing (graceful failure) |
| Screen reader | Tab through rows | Each row is keyboard-focusable (Claude Code should add `role="button"` + `tabindex="0"`) |

---

## 7. Resolved decisions

| Item | Decision |
|---|---|
| Authentication | Required — ambassador session via Supabase |
| Authorization | Server filters payouts to current user only |
| Data freshness | Fetch on every visit (no client cache) |
| Empty state | If `history` empty: show "No payouts yet" message in the history card. Next-payout card shown only if `next` exists. |
| Date format | "8 April 2026" (full month, no abbreviations) |
| Currency display | Symbol prefix when unambiguous ($, €, £, AED). Otherwise code only. |
| Status badge wording | "SCHEDULED" (next), "PAID" (history), "PROCESSING", "FAILED" |
| Pagination | Initially: load all history. If history grows past ~50 items, add "Load more" later. |

---

## 8. Build checklist for Claude Code

- [ ] Next.js: `app/(wld)/model/payouts/page.tsx` renders this HTML
- [ ] Wrap in auth middleware — redirect to `/model/auth` if no session
- [ ] Fetch `GET /api/model/payouts` on mount
- [ ] Loading state — show skeleton or spinner during fetch
- [ ] Error state — if API fails, show "Couldn't load payouts. Try again."
- [ ] Empty state — handle no history gracefully
- [ ] Render history rows by mapping over `data.history`
- [ ] Row click → `router.push('/model/payouts/' + id)` (Next.js router, not `window.location.href`)
- [ ] Back arrow → `router.back()` with fallback to `/model/analytics`
- [ ] Add accessibility: each row needs `role="button"`, `tabindex="0"`, keyboard Enter handler
- [ ] Update `analytics_final.html` separately: change "View payouts →" link from `onclick="openPayouts()"` to `<Link href="/model/payouts">`, remove overlay sections + JS

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| User opens `/model/payouts` directly without history | Back arrow falls back to `/model/analytics` |
| No payouts ever made | History card shows "No payouts yet". Next card shows only if scheduled. |
| Payout is "processing" (not yet paid) | Status badge color shifts to amber `#f59e0b` |
| Payout failed | Status badge "FAILED" in red `#ef4444` — show contact-support link |
| Currency mismatch (some payouts USD, some EUR) | Each row shows its own currency. Total shows in account's primary currency. |
| Many payouts (>50) | Defer "Load more" pagination to V2 |
| Long reference IDs | Truncate with ellipsis (won't happen with current 8-char format) |
| Slow connection | Loading state shown; back arrow stays interactive |

---

## 10. Related files

| File | Purpose | Status |
|---|---|---|
| **`payouts_list_final.html`** | **This page** | **Final** |
| `payout_statement_final.html` | Sibling — detail view of one payout | Final |
| `analytics_final.html` | Existing — needs overlay removal + link change | To update during integration |
| Backend `/api/model/payouts` | New GET endpoint | To build |

---

## 11. Outstanding items

- [ ] Decide: reuse existing `payouts` table or create `model_payouts` (Phase B decision)
- [ ] Backend: implement `GET /api/model/payouts`
- [ ] Update `analytics_final.html` (remove overlays, fix link)
- [ ] Confirm color tokens for "processing" + "failed" status states
- [ ] Optional V2: pull-to-refresh, "Load more" pagination
