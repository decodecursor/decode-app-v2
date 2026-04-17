# Payout Statement — UI Spec (FINAL)

**File:** `payout_statement_final.html`
**Project:** WeLoveDecode — ambassador platform (WLD)
**Route:** `/model/payouts/[id]`
**Access:** Authenticated — ambassador role only (must own this payout)

---

## 1. Purpose

Detail view of a single payout. Shows what was paid, when, where it went, and the breakdown by source (listings + wishes).

The ambassador's "receipt" for a Wednesday payout. Ambassadors can:
- Verify the amount they received in their bank
- See exactly which listings + wishes contributed to that payout
- Copy the reference ID to share with support if there's an issue

Replaces what used to be the second overlay inside `analytics_final.html`. Now a real URL — bookmarkable, shareable, deep-linkable from emails.

---

## 2. Why this page is a real URL (not an overlay)

Same reasoning as `/model/payouts` (the list). Real URLs allow:
- Direct bookmarks for "my payout from last Wednesday"
- Sharing specific statement URLs with support team
- Browser back works naturally
- Deep linking from email notifications ("Your payout was sent — view statement →")

---

## 3. Navigation — Full Map

### 3.1 Inbound (entry points)

| Source | Element | Behavior |
|---|---|---|
| `/model/payouts` | Tap any payout row | Navigates to statement |
| Email — payout completed notification | "View statement" CTA | Direct deep link to specific payout |
| Direct URL / bookmark | — | Loads statement, requires auth |

### 3.2 Outbound (all exits)

| Element | Destination | Mechanism |
|---|---|---|
| Back arrow (top-left) | `/model/payouts` via `history.back()`; fallback to `/model/payouts` if no history | JS click handler |
| Reference pill (e.g. "P8473921") | None — copies ID to clipboard | Triggers "Copied!" feedback below |

**No deep navigation FROM this page.** It's a terminal/leaf node — read-only detail view.

### 3.3 Backend reads

```
GET /api/model/payouts/{id}
Auth: required (ambassador session)
Authorization: payout must belong to current user (404 otherwise)

Response:
{
  "id": "P8473921",
  "amount": 420.00,                            // NET — what hits ambassador's bank
  "currency": "USD",
  "status": "paid" | "processing" | "failed",
  "date": "2026-04-08",                        // paid_at
  "bank": {
    "name": "Emirates NBD",                     // from user_bank_accounts.bank_name
    "last4": "4821"                             // last 4 of IBAN/account number
  },
  "listings": [                                 // listing payments included in payout
    {
      "professional_name": "Salon de Luxe",
      "duration_label": "30-day renewal",       // pre-formatted server-side
      "paid_on": "2026-04-03",
      "amount": 60.00,                          // NET — ambassador's 80% share
      "gross_amount": 75.00                     // GROSS — what professional paid
    },
    ...
  ],
  "wishes": [                                   // wish payments included in payout
    {
      "treatment": "Lip filler",
      "gifter_name": "Sara Johnson" | "Anonymous",
      "paid_on": "2026-04-05",
      "amount": 75.00,                          // NET — ambassador's 80% share
      "gross_amount": 93.75                     // GROSS — what gifter paid
    },
    ...
  ]
}
```

**Note on amount fields:**
- `amount` (top-level + per line item) = **net** = ambassador's 80% share
- `gross_amount` (per line item) = **gross** = what the gifter or professional originally paid (100%)
- The platform fee (20%) is the difference: `gross_amount - amount`
- Server calculates and returns BOTH so the frontend never has to do fee math
- Server stores both values per transaction (immutable history) — never derives from a "current fee %" at display time

### 3.4 Backend writes

**None.** Read-only page.

---

## 4. Layout (top to bottom)

1. **Header** — back arrow + "Statement" title (20px / 700)
2. **Summary card** — dark grey `#1c1c1c` rounded card
   - Label "Payout" + status badge ("PAID" / "PROCESSING" / "FAILED")
   - Amount (28px / 700) + currency code
   - Date · Reference pill (clickable, copies to clipboard)
   - Divider
   - Stats row: listings count, wishes count, bank info (right-aligned)
3. **Listings section** — section label "LISTINGS" (10px uppercase `#666`)
   - Stack of line items, each rendered as **two rows** (2px vertical gap):
     - **Top row:** professional name (left, 13px / 700, white) + net amount (right, 14px / 600, white)
     - **Bottom row:** package + date (left, 10px, `#777`) + gross amount (right, 10px, `#666`)
   - Last item has no bottom border
4. **Wishes section** — section label "WISHES"
   - Same two-row structure as listings:
     - **Top row:** treatment (left) + net amount (right)
     - **Bottom row:** gifter name + date (left) + gross amount (right)
5. **Bottom padding** — 20px

If `listings` or `wishes` array is empty, hide that entire section (label + items).

### 4.1 Why two rows per line item

The line item shows BOTH:
- **Net amount (top, prominent)** — what the ambassador actually received from this transaction (after the 20% platform fee)
- **Gross amount (bottom, subtle)** — what the gifter or professional originally paid

This is the **only place in the entire app** where the gross amount is shown to the ambassador. Everywhere else (Dashboard, Listings, Wishlist, Analytics, Payouts list) shows gross OR net per the locked fee-display strategy. The statement is the audit/reconciliation page where both values are visible side-by-side.

Visual symmetry: top row's left + right items align with each other; bottom row's left + right items align with each other. Equal 2px gap between rows on both sides.

---

## 5. Color & Typography

| Element | Token |
|---|---|
| Page background (outer) | `#111` |
| Frame background | `#000` |
| Frame border | `2px #1a1a1a` |
| Card background | `#1c1c1c` |
| **Reference pill hover bg** | **`#262626` (LIGHTER than card)** |
| Title (20px / 700) | `#fff` |
| Big amount (28px / 700) | `#fff` |
| Currency code (11px / 600) | `#666` |
| Card label "Payout" | `#666` 11px |
| Date + reference (10px) | `#777` |
| Section label (10px uppercase, 0.8px letter-spacing) | `#666` |
| Listing/wish name — **top row** (13px / 700) | `#fff` |
| Listing/wish **net amount** — top row (14px / 600) | `#fff` |
| Listing/wish meta — **bottom row** (10px) | `#777` |
| Listing/wish **gross amount** — bottom row (10px) | `#666` |
| **Vertical gap between top and bottom row** | **`2px`** |
| Bank name (10px) | `#999` |
| Bank last4 (10px) | `#666` |
| Status badge "PAID" | `#34d399` bg, `#000` text, weight 700 |
| **Copied! feedback** | **`#34d399` 10px / 600, fades after 1.5s** |
| Stat divider | `0.5px #272727` |
| Row dividers (between line items) | `1px #1f1f1f` |
| Line item vertical padding | `14px 0` |

---

## 6. Interactions

| Element | Action | Result |
|---|---|---|
| Back arrow | Tap | History back; fallback to `/model/payouts` |
| Back arrow | Press / active | Scale 0.9 (tactile feedback) |
| Reference pill | Hover | Background lightens to `#262626` |
| Reference pill | Tap | Copies reference ID to clipboard; shows "Copied!" centered below pill in green for 1.5s |
| Reference pill | Tap rapidly multiple times | Timer resets each tap; label disappears 1.5s after final tap |
| Clipboard API unavailable | Tap | Falls back to `document.execCommand('copy')` via hidden textarea |
| JS disabled | — | Page still readable; back arrow falls back to native href, copy doesn't work (user can manually select/copy) |

---

## 7. Resolved decisions

| Item | Decision |
|---|---|
| Authentication | Required — ambassador session via Supabase |
| Authorization | Server confirms payout belongs to current user; returns 404 otherwise |
| Data freshness | Fetch on every visit (no client cache) |
| 404 behavior | Redirect to `/model/payouts` — payout doesn't exist or not yours |
| Date format | "8 April 2026" everywhere (full month) |
| Currency display | Symbol prefix when unambiguous ($, €, £, AED). Otherwise code. |
| Bank info source | Snapshot at payout time from `user_bank_accounts` — preserves history if bank changes later |
| Reference format | Letter prefix `P` + 7 digits = 8 chars total |
| Copy feedback | "Copied!" text, green `#34d399`, centered below pill, 1.5s fade |
| Empty sections | If `listings` or `wishes` array empty, hide that section entirely (no empty header) |
| Refunds in payout | If a listing was refunded, show as line item with negative amount and grey color (V2 if needed) |
| Print stylesheet | Not implemented for V1 |
| Export to PDF | Not in V1; add later if requested |
| **Show net + gross per line** | **Yes — net on top row, gross on bottom row, equal 2px gap** |

---

## 7a. Fee-display strategy (locked across DECODE)

Important context for understanding why the statement page shows TWO amounts per line item.

The 20% platform fee is displayed selectively across DECODE pages — this page is the only one that shows BOTH gross and net:

| Page | Shows | Reason |
|---|---|---|
| `/model` Dashboard | **Gross (100%)** | "What I made happen" — vibe / motivation |
| `/model/analytics` | **Gross (100%)** | Same — performance view |
| `/model/listings` | **Gross (100%)** | What was paid by professionals |
| `/model/wishlist` | **Gross (100%)** | What was paid by gifters |
| `/model/payouts` (list) | **Net (80%)** | What hits the bank — practical money view |
| **`/model/payouts/[id]` (this page)** | **Net (80%) + Gross (100%)** | **Audit / reconciliation — only place both appear** |
| `/wish/W...` receipt | Gross (100%) | What gifter paid |
| `/listing/L...` receipt | Gross (100%) | What professional paid |
| `/model/settings` | Nothing about fees | Clean UI |
| Terms of Service | Disclosure (legal text) | Legal compliance |

**Important for Claude Code:**
- The platform fee is **never explicitly displayed as "20%"** anywhere except in Terms.
- The word "fee" is **never shown to ambassadors** in the UI.
- This page is the only place the gross amount appears in the ambassador's interface — and even here it's visually subordinate (smaller, greyer, below the net amount).
- Server stores both `amount` (net) and `gross_amount` per transaction. **Never derive net from a "current fee %" at display time** — historical transactions must always show the fee that applied AT THE TIME of the transaction (in case fee % ever changes).

---

## 8. Build checklist for Claude Code

- [ ] Next.js: `app/(wld)/model/payouts/[id]/page.tsx` renders this HTML
- [ ] Wrap in auth middleware — redirect to `/model/auth` if no session
- [ ] Server-side authorization: confirm payout belongs to current user, else `notFound()`
- [ ] Fetch `GET /api/model/payouts/{params.id}` on mount
- [ ] Replace mockup values: amount, currency, date, ID, status, bank, counts
- [ ] Render listings via `.map()` over `data.listings` — each item produces a `.pd-line` with two `.pd-row` children:
  - Top row: `professional_name` + `amount` (formatted as currency)
  - Bottom row: `duration_label · paid_on` + `gross_amount` (formatted as currency)
- [ ] Render wishes via `.map()` over `data.wishes` — same two-row structure:
  - Top row: `treatment` + `amount`
  - Bottom row: `gifter_name · paid_on` + `gross_amount`
- [ ] Hide listings section if `listings.length === 0`
- [ ] Hide wishes section if `wishes.length === 0`
- [ ] Loading state — skeleton or spinner during fetch
- [ ] Error state — if API fails, show "Couldn't load statement. Try again."
- [ ] Keep the "Copied!" feedback logic intact
- [ ] Back arrow → `router.back()` with fallback to `/model/payouts`
- [ ] Add accessibility: reference pill needs `role="button"`, `aria-label="Copy reference ID"`, keyboard Enter handler
- [ ] Add `aria-live="polite"` region for the "Copied!" announcement so screen readers know
- [ ] **Format currency consistently**: same currency symbol + 2 decimals (e.g. "$60.00") for both net and gross. Use `Intl.NumberFormat` with the payout's currency.

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| Statement deep-linked, no history | Back arrow falls back to `/model/payouts` |
| User opens statement that's not theirs | 404 — redirect to `/model/payouts` |
| User opens statement that doesn't exist | 404 — redirect to `/model/payouts` |
| Payout is "processing" (not yet completed) | Status badge "PROCESSING" in amber `#f59e0b` |
| Payout failed | Status badge "FAILED" in red `#ef4444`; show contact-support text |
| Bank account deleted after payout | Snapshot data still shown — stored on payout record at creation |
| Currency mismatch (listing in USD, payout in EUR) | All amounts in payout's currency. FX done at payout creation, not display. |
| Very long professional name | Truncates with ellipsis at end of line |
| Very long treatment name | Truncates with ellipsis |
| Listings empty, only wishes | Hide listings section entirely |
| Wishes empty, only listings | Hide wishes section entirely |
| Both empty (shouldn't happen but defensive) | Show "No items in this payout" message |
| Clipboard API blocked by browser | Falls back to legacy `execCommand('copy')` via hidden textarea |
| User taps reference rapidly | Timer resets; label stays visible until 1.5s after final tap |
| JS disabled | Reference is plain text; user can manually select + copy |
| Screen reader user copies | `aria-live` region announces "Copied!" |

---

## 10. Related files

| File | Purpose | Status |
|---|---|---|
| `payouts_list_final.html` | Sibling — list view of all payouts | Final |
| **`payout_statement_final.html`** | **This page** | **Final** |
| `analytics_final.html` | Existing — needs overlay removal + link change | To update during integration |
| Backend `/api/model/payouts/[id]` | New GET endpoint | To build |

---

## 11. Outstanding items

- [ ] Decide: reuse existing `payouts` table or create `model_payouts` (Phase B decision)
- [ ] Backend: implement `GET /api/model/payouts/[id]`
- [ ] Confirm color tokens for "processing" + "failed" status states
- [ ] Decide on refund display in V1 vs V2
- [ ] Optional V2: PDF export, print stylesheet
