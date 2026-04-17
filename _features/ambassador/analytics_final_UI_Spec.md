# Analytics + Payouts + Statement — UI Spec (Final)

**File:** `analytics_final.html` — single merged file containing three screens: Analytics page + Payouts overlay + Statement overlay.

**Project:** WeLoveDecode — beauty ambassador platform

**Logical routes (surfaced as in-page overlays):**
- `/dashboard/ambassador/analytics` — Analytics page (base)
- `/dashboard/ambassador/payouts` — Payouts list (overlay 1)
- `/dashboard/ambassador/payouts/:id` — Statement (overlay 2)

**Access:** Authenticated ambassadors only

---

## 0. Architecture — Overlays in a Single File

Analytics, the Payouts list, and the Statement live in **one HTML file as stacked screens**. Navigating between them is a CSS transform (`translateX`) — no page load, no visible route change — but the URL is updated via `history.pushState` so deep links and browser-back work correctly.

### Why overlays, not separate pages

- Zero page-transition flicker; slides are smooth
- Analytics data stays live in memory; returning from Payouts doesn't re-fetch or lose scroll position
- Entire flow (Analytics → Payouts → Statement) is testable/previewable as one file

### Z-stack

```
Analytics (#anPage)           — always visible underneath
  ↑
Payouts overlay (#poScreen)   — slides in from right when "View payouts →" is tapped
  ↑
Statement overlay (#pdScreen) — slides in from right when a Payouts row is tapped
```

Each overlay sits at `position: absolute; top: 0; left: 0`, `transform: translateX(100%)` hidden, `translateX(0)` active, `280ms cubic-bezier(.2,.7,.2,1)` transition. Each screen is independently scrollable with `max-height: 100vh; overflow-y: auto`.

### Background interaction rule

When an overlay is open, screens underneath are **covered and blocked** — taps don't pass through, scripts underneath don't receive events.

---

## 1. Navigation — Entry Points, Exits & Data Flow

### 1.1 Inbound entry points

| Source | Element | Result |
|---|---|---|
| Dashboard | "Analytics" nav card | Loads Analytics page |
| Analytics page | "View payouts →" link | Opens Payouts overlay (slides in from right) |
| Payouts list | Any history row | Opens Statement overlay (slides in from right) |

Statement is only reachable via Payouts list. Never deep-linked from Analytics or Dashboard directly.

### 1.2 Outbound exits — Analytics page

| Element | Action | Data written | Trigger fired |
|---|---|---|---|
| Back arrow | Returns to Dashboard (**fixed**, not history.back) | None | None |
| Filter tabs (Today / Week / Month / All) | Client-side dataset switch — no network call | None | None |
| Total earnings + chart | **No action** (display-only) | — | — |
| Breakdown split bar | **No action** (display-only) | — | — |
| Next payout hero card | **No action** (display-only — use "View payouts →" link) | — | — |
| "View payouts →" link | Opens Payouts overlay | None | `open_payouts_overlay` |
| 3 stat tiles (Visits / Clicks / Gifts) | **No action** (display-only) | — | — |
| "Clicks by listings" entire column block | → `/listings` | None | None |
| "Clicks by wishes" entire column block | → `/wishlist` | None | None |
| Top listing card | → `/listings` (part of the block) | None | None |
| Top gifter card | → `/wishlist` (part of the block) | None | None |
| Pull-to-refresh | Re-fetches `GET /api/analytics` | None | None |

### 1.3 Outbound exits — Payouts list overlay

| Element | Action | Data written | Trigger fired |
|---|---|---|---|
| Back arrow | Closes overlay → returns to Analytics | None | `close_payouts_overlay` |
| ESC key (desktop) | Closes overlay → returns to Analytics | None | Same |
| Swipe-from-left (mobile iOS gesture) | Closes overlay → returns to Analytics | None | Same |
| Next payout hero card | **No action** (display-only) | — | — |
| Total row | **No action** (display-only) | — | — |
| History row tap | Opens Statement overlay for that payout | None | `open_statement`, payload `{ payout_id }` |
| Row hover | `#0a0a0a` background, 8px rounded pill with side breathing room | — | — |
| Pull-to-refresh | Re-fetches `GET /api/ambassador/payouts` | None | None |

### 1.4 Outbound exits — Statement overlay

| Element | Action | Data written | Trigger fired |
|---|---|---|---|
| Back arrow | Closes Statement → returns to Payouts list (scroll position restored) | None | `close_statement` |
| ESC key (desktop) | Closes Statement → returns to Payouts list | None | Same |
| Swipe-from-left (mobile) | Closes Statement → returns to Payouts list | None | Same |
| Hero amount / date | **No action** (display-only) | — | — |
| Payout ID pill (P-number + copy icon) | Copies to clipboard, "Copied!" swaps in place | None | `copy_payout_id` |
| Date text, separator bullet | **No action** (only the pill is tappable) | — | — |
| Stats row (Listings / Wishes / bank) | **No action** (display-only) | — | — |
| Listings breakdown rows | **No action** (display-only) | — | — |
| Wishes breakdown rows | **No action** (display-only) | — | — |
| Pull-to-refresh | **Disabled** on this overlay (PTR lives on Analytics only) | — | — |

### 1.5 Scroll preservation

| Screen | Scroll behavior on re-entry |
|---|---|
| Analytics | Preserved (overlay was on top, didn't touch it) |
| Payouts list | Preserved — remembered in JS variable `POScrollPos`, restored via `setTimeout` after close animation |
| Statement | Always resets to top on open — each payout is its own document |

### 1.6 Browser history (production)

| Action | `history.pushState` |
|---|---|
| Open Payouts overlay | Push `/dashboard/ambassador/payouts` |
| Open Statement | Push `/dashboard/ambassador/payouts/:id` |
| Close Statement | `history.back()` — URL returns to `/payouts` |
| Close Payouts | `history.back()` — URL returns to `/analytics` |
| Browser back button | Same effect as the screen's back arrow |

**Deep link on cold load:** server renders Analytics first, then client detects URL segment — if `/payouts`, opens Payouts overlay with animations suppressed on first render. If `/payouts/:id`, opens both overlays instantly stacked so user lands directly on Statement.

---

## 2. Analytics Page — Purpose & Contents

Single-screen performance dashboard: earnings chart, breakdown (listings vs wishes), next payout summary, funnel (visits → clicks → gifts), top listings and top gifters. Ambassador should be able to glance in 5 seconds and know how the week is going.

### 2.1 Layout

1. Header — back arrow (→ Dashboard) + "Analytics"
2. Filter tabs — Today / Week / Month / All (default: Week)
3. Total earnings + line chart (the single sparkline on the page)
4. Breakdown split bar (pink Listings / mint Wishes)
5. Next payout card + "View payouts →" link
6. 3 stat tiles (Page visits → Clicks → Gifts, funnel with chevrons)
7. Two columns side-by-side: "Clicks by listings" (left) + "Clicks by wishes" (right)
8. Top listing card + Top gifter card

### 2.2 Filter tabs — client-side only

Single `GET /api/analytics` on mount returns **all 4 ranges** in one response:

```json
{
  "today": { "total":…, "chart":[…], "breakdown":{…}, "payout":{…}, "funnel":{…}, "topListings":[…], "topWishes":[…], "topListing":{…}, "topGifter":{…} },
  "week":  { … },
  "month": { … },
  "all":   { … }
}
```

Tab tap = JS dataset swap. No network call. Every element (number, chart, split bar, sparkline) re-animates on switch.

### 2.3 Data tracking — tables & events

| Metric | Source table | Event trigger |
|---|---|---|
| **Page visits** | `view_events(user_id, viewed_at, visitor_id, country, user_agent)` | Public `/{slug}` page load, deduped — see §2.4 |
| **Clicks** | `click_events(user_id, listing_id NULL, wish_id NULL, gifter_ig NULL, click_type, clicked_at, visitor_id)` with `click_type` enum: `listing_media`, `listing_instagram`, `wish_checkout`, `wish_instagram`, `walloflove_gifter_instagram` | Follower taps any tracked element on public page — see §2.5 for which count toward Sara's Clicks stat |
| **Wishes (gifts)** | `wish_commissions` (see §4 Payouts schema) | Gift payment completes via Stripe |
| **Listings earnings** | `SUM(listing_commissions.commission_amount)` for range | Paid package purchase completes via Stripe |
| **Wishes earnings** | `SUM(wish_commissions.commission_amount)` for range | Gift payment completes via Stripe |
| **Total earnings** | Listings earnings + Wishes earnings | Computed server-side per range |

### 2.4 Page visit counting — deduplication rule (session visit model)

One **session visit** per unique `visitor_id` per 24-hour window. Matches Instagram / Linktree / Beacons creator-analytics standard.

**Counts as 1 visit:**
- Stranger taps Sara's bio link → first page load → **+1**
- Different stranger opens the link from WhatsApp → **+1**
- Same stranger returns after 25 hours (cookie expired) → **+1** (new session)

**Does NOT count as a visit:**
- Same person refreshes 10× in one session → still 1
- Same person opens 3 tabs at once → still 1
- Same person returns 5 hours later → still 1 (cookie still valid)
- Sara herself (authenticated) views her own page → 0 (filtered server-side)
- Bot crawlers identified by `user-agent` (Googlebot, AhrefsBot, etc.) → 0

**Implementation:** server sets `wld_visitor` cookie (UUID) on first load, `max-age = 86400` (24h). `view_events` inserts only when no row exists for `(user_id, visitor_id)` within last 24 hours.

### 2.5 Clicks — what counts

A "click" is any of five event types on the public `/{slug}` page, recorded in `click_events`:

| `click_type` | Fired when |
|---|---|
| `listing_media` | Follower taps the play button on a listing (opens media lightbox) |
| `listing_instagram` | Follower taps the photo or name of a listing's professional (opens IG) |
| `wish_checkout` | Follower taps "Gift it" on a wishlist item (opens checkout) |
| `wish_instagram` | Follower taps the name on a wishlist item (opens IG) |
| `walloflove_gifter_instagram` | Follower taps a gifter's name on Wall of Love (opens IG). Stored for future analytics — not surfaced on Sara's Analytics page in v1. |

The first four count toward the Analytics "Clicks" stat (visits → clicks → gifts funnel). `walloflove_gifter_instagram` is tracked separately and does not inflate Sara's Clicks number (it's post-gift social browsing, not a conversion path).

`click_events` also stores `visitor_id` for future dedupe analytics (not applied to the top-level Clicks number — each tap counts).

### 2.6 Breakdown split bar (pink Listings / mint Wishes)

Two independent server queries per range:

```sql
-- Listings width
SELECT SUM(commission_amount) FROM listing_commissions
 WHERE user_id = ? AND charged_at BETWEEN :range_start AND :range_end;

-- Wishes width (separate, never combined)
SELECT SUM(commission_amount) FROM wish_commissions
 WHERE user_id = ? AND charged_at BETWEEN :range_start AND :range_end;
```

Pink width = `listings_earnings / total`. Mint width = `wishes_earnings / total`. Listings and Wishes counts are tracked and displayed **separately** — never merged into one "Gifts" number.

### 2.7 Trend percentages

Trend (e.g. `+12%`, `-5%`) is **pre-computed server-side** per range:

- Today → vs yesterday
- Week → vs previous 7 days
- Month → vs previous 30 days
- All → no trend shown (flat grey `·`)

Client receives `{ value, trend: <number>, direction: 'up'|'down'|'flat' }` per metric, renders with pink/mint arrow + color.

### 2.8 Sparkline

**One sparkline on the entire page** — the big earnings line chart at the top. No mini sparklines under the stat tiles (just label + number + trend).

Sparkline data is **pre-aggregated server-side** per range:

- Today → 24 hourly buckets
- Week → 7 daily buckets
- Month → 30 daily buckets
- All → 12 monthly buckets

API returns array of numbers. Client animates SVG line-drawing + area fill (already built into current HTML).

### 2.9 Amount formatting on Analytics

**Whole numbers with thousand separators — no decimals:**

| Raw | Analytics renders |
|---|---|
| 1384.25 | `$1,384` |
| 420.00 | `$420` |
| 25.85 | `$26` (rounded) |

Uses `Math.round()` server-side then formats. This differs from Payouts/Statement (which show 2 decimals) — Analytics is "glanceable", Payouts/Statement are "financial record".

Currency symbol from `users.currency` (locked at onboarding, immutable).

### 2.10 Column blocks (Clicks by listings / Clicks by wishes)

Each column is one big tappable block spanning:
- Section label ("Clicks by listings" / "Clicks by wishes")
- Three metric rows
- Top listing / Top gifter card below

Left column → navigates to `/listings`. Right column → `/wishlist`. No individual row taps.

### 2.11 Empty state — 0 page visits

Show the standard chart/tiles/columns with zero values. **No special CTA, no share button, no "get started" overlay.** Zeros speak for themselves.

### 2.12 Currency

Uses `users.currency` locked at onboarding. Never changes. All Analytics amounts use this currency with whole-number formatting (§2.9).

---

## 3. Payouts Overlay — Contents

### 3.1 Layout

1. Header — back arrow (← Analytics) + "Payouts" title
2. Next payout hero card — always visible, even when $0.00
3. Total card with history rows below

### 3.2 Next Payout card

Always shown, always in SCHEDULED state. Rolls forward every Wednesday.

| Element | Spec |
|---|---|
| Background | `#1c1c1c`, 14px radius, 20px padding |
| Top-left label | "Next payout" — 11px/400 `#666` |
| Top-right badge | **SCHEDULED** — `background:#34d399`, `color:#000`, 9px/700 uppercase, `padding:4px 10px`, `border-radius:20px`, `letter-spacing:0.3px` |
| Amount | 28px/700 `#fff`, 2 decimals + thousand separators (e.g. `$340.00`) |
| Currency | "USD" inline — 11px/600 `#666`, `letter-spacing:0.8px`, baseline-aligned |
| Date | 10px/400 `#777`, e.g. "Wednesday, 15 April 2026" |

### 3.3 Total + History card

| Element | Spec |
|---|---|
| Background | `#1c1c1c`, 14px radius |
| Total label | "Total" — 11px/400 `#666` |
| Total subtitle | "{N} payouts" — 10px/400 `#777` |
| Total amount | 22px/700 `#fff`, 2 decimals + separators (e.g. `$1,740.00`) |
| Divider | 1px `#1f1f1f` full-bleed |

**History row:**

| Element | Spec |
|---|---|
| Left: date | 14px/700 `#fff`, e.g. "8 April 2026" |
| Left: payout ID | 10px/400 `#777`, e.g. "P8473921" |
| Right: amount | 15px/600 `#fff`, 2 decimals (e.g. `$420.00`) |
| Right: status | 10px/400 `#34d399`, "Paid" |
| Row divider | `border-bottom: 1px solid #1f1f1f` (except last) |
| Hover | `#0a0a0a` bg with 8px rounded corners, side breathing room (`margin: 0 -8px; padding-l/r: 8px`) |
| No active/selection state — tap opens Statement immediately |
| Tap target | Entire row → Opens Statement overlay for this payout |

### 3.4 Empty state — 0 payouts ever

- Hide the Total card entirely
- Show centered below the Next payout card: **"No payouts yet"**
- Subtext: "Your first payout appears here once you earn your first commission"

### 3.5 Simplified payout lifecycle

One payout is always SCHEDULED, rolls forward weekly:

```
Mon–Tue   → Next payout card shows accumulated amount (SCHEDULED)
Wed       → Stripe sends payout to bank
          → Payout moves into history list as PAID
          → Next payout card resets to $0.00 SCHEDULED for next Wed
Thu+      → New commissions start piling up
```

States surfaced to user:

| State | Where shown | Visual |
|---|---|---|
| SCHEDULED | Next payout card | Green pill "SCHEDULED" |
| PAID | History row | Green "Paid" text |

No PROCESSING / FAILED states in v1. Failed payouts handled manually by admin — ambassador sees SCHEDULED until resolved.

### 3.6 Data fetch behavior

| Fetch | When | Cached |
|---|---|---|
| `GET /api/ambassador/payouts` | First tap on "View payouts →" | Yes — session cache |
| Pull-to-refresh on overlay | Explicit user gesture | Invalidates cache, re-fetches |
| Subsequent "View payouts →" taps | Reuse cache | — |

---

## 4. Statement Overlay — Contents

### 4.1 Layout

1. Header — back arrow (← Payouts) + **"Statement"** title
2. Hero card — amount, status, date, payout ID (copyable), stats row, bank destination
3. **LISTINGS** section — commissions from listing packages
4. **WISHES** section — commissions from wish gifts

Page title is **"Statement"** (not "Payout") so it reads cleanly alongside the "Payout" label on the hero card.

### 4.2 Hero card

| Element | Spec |
|---|---|
| Background | `#1c1c1c`, 14px radius, 20px padding |
| Top-left label | "Payout" — 11px/400 `#666` |
| Top-right badge | **PAID** — same chrome as SCHEDULED badge |
| Amount | 28px/700, 2 decimals + commas |
| Currency | "USD" inline |
| Meta row | Date · payout ID pill — 10px/400 `#777`, `gap:5px`, separator is 14px `#555` bullet |
| Divider above stats | `border-top: 0.5px solid #272727`, `padding-top: 14px` |
| Stats row | Listings count / Wishes count / bank destination — 15px/700 numbers, 9px/400 `#666` labels |

### 4.3 Payout ID pill — tap to copy

Only the "P-number + copy icon" wrapper is tappable. Date text and bullet separator are inert.

- Wrapper: `cursor:pointer`, 3px/6px inset padding, 6px negative margin (keeps layout stable), 6px rounded corners
- Hover: `#0a0a0a` background fills the pill only
- Tap: writes ID to clipboard via `navigator.clipboard.writeText()` (fallback: `document.execCommand('copy')` via hidden textarea)
- **In-place swap:** date + separator + icon hide, "P8473921" text replaced by **"Copied!"** in `#34d399` green, weight 600, for 1300ms, then restores
- Double-taps during swap ignored via `data-swapping="1"` flag
- Optimistic UX: if both clipboard APIs fail, "Copied!" still shows (silent failure preferred for a nano-interaction)

### 4.4 Stats row counts

Pre-computed server-side and returned with the payout object:

- **Listings** = count of `listing_commissions` rows in this payout
- **Wishes** = count of `wish_commissions` rows in this payout

### 4.5 Breakdown sections — horizontal alignment

Both **LISTINGS** and **WISHES** section headers + line items are indented to **40px from screen edge** (20px screen padding + 20px extra) so they align with the hero card's inner content edge. Reads as one continuous vertical rhythm.

### 4.6 Listing row

| Line | Content | Spec |
|---|---|---|
| Title (white) | Listing name, e.g. "Salon de Luxe" | 13px/700 `#fff` |
| Subtitle (grey) | Package + full date, e.g. "30-day renewal · 3 April 2026" or "60-day package · 4 April 2026" | 10px/400 `#777` |
| Right amount | Ambassador's 80% share, 2 decimals | 14px/600 `#fff` |

### 4.7 Wish row

| Line | Content | Spec |
|---|---|---|
| Title (white) | Wish/service name only, e.g. "Lip filler" (**no "wish" suffix**) | 13px/700 `#fff` |
| Subtitle (grey) | Gifter name + full date, e.g. "Sara Johnson · 5 April 2026" | 10px/400 `#777` |
| Right amount | Ambassador's 80% share, 2 decimals | 14px/600 `#fff` |

### 4.8 Anonymous gifters

When `wish_gifts.is_anonymous = true`, the subtitle reads **"Anonymous · {date}"**. Same styling as a normal name. Ambassador never sees the real gifter identity.

Server pre-resolves this via `gifter_display_name` in the API response — client doesn't decide.

### 4.9 Statement load flow

1. User taps row on Payouts list
2. Overlay slides in **immediately** with data already known from the row (amount, date, payout ID, counts)
3. `GET /api/ambassador/payouts/:id` fires in parallel
4. While loading, LISTINGS and WISHES sections render skeletons (grey placeholder rows)
5. On response, skeleton replaces with actual breakdown items
6. 280ms slide animation almost always finishes before fetch returns — perceived as instant

### 4.10 Section dividers

- All rows within a section: `border-bottom: 1px solid #1f1f1f`
- Last row of each section: no bottom border
- 14px vertical padding per row

---

## 5. Data Storage — Commission & Payout Schema

### 5.1 The 80% rule

Ambassadors earn **80%** of every transaction. The 20% platform fee is tracked separately for admin/accounting. **Amounts are stored as actual dollars, never computed client-side.**

### 5.2 Schema

```sql
-- Paid listing commissions (pro pays for a listing package)
CREATE TABLE listing_commissions (
  id                 UUID PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES users(id),   -- the ambassador
  listing_id         UUID NOT NULL REFERENCES listings(id),
  payout_id          UUID REFERENCES payouts(id),          -- NULL until grouped
  gross_amount       NUMERIC(10,2) NOT NULL,               -- what pro paid
  commission_amount  NUMERIC(10,2) NOT NULL,               -- 80% to ambassador
  platform_fee       NUMERIC(10,2) NOT NULL,               -- 20% to platform
  currency           CHAR(3) NOT NULL,
  package_type       TEXT NOT NULL,                        -- '30_day', '60_day', '90_day', '30_day_renewal'
  charged_at         TIMESTAMP NOT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Wish gift commissions (gifter pays for a wish)
CREATE TABLE wish_commissions (
  id                  UUID PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id),
  wish_id             UUID NOT NULL REFERENCES wishes(id),
  wish_gift_id        UUID NOT NULL REFERENCES wish_gifts(id),
  payout_id           UUID REFERENCES payouts(id),
  gross_amount        NUMERIC(10,2) NOT NULL,
  commission_amount   NUMERIC(10,2) NOT NULL,
  platform_fee        NUMERIC(10,2) NOT NULL,
  currency            CHAR(3) NOT NULL,
  wish_name           TEXT NOT NULL,                       -- snapshot e.g. "Lip filler"
  gifter_display_name TEXT NOT NULL,                       -- real name or "Anonymous"
  charged_at          TIMESTAMP NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Weekly payouts (grouped every Wednesday)
CREATE TABLE payouts (
  id                 UUID PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES users(id),
  reference          TEXT UNIQUE NOT NULL,                 -- e.g. 'P8473921' — user-visible
  total_amount       NUMERIC(10,2) NOT NULL,
  currency           CHAR(3) NOT NULL,
  status             TEXT NOT NULL,                        -- 'scheduled' | 'paid' | 'failed'
  scheduled_for      DATE NOT NULL,
  paid_at            TIMESTAMP,
  bank_display_name  TEXT NOT NULL,                        -- snapshot e.g. 'Emirates NBD'
  bank_last4         CHAR(4) NOT NULL,
  listings_count     INT NOT NULL DEFAULT 0,               -- pre-computed for stats row
  wishes_count       INT NOT NULL DEFAULT 0,               -- pre-computed for stats row
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Public page views
CREATE TABLE view_events (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id),        -- ambassador whose page was viewed
  visitor_id   UUID NOT NULL,                             -- from cookie
  viewed_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  country      TEXT,
  user_agent   TEXT
);
CREATE INDEX ON view_events (user_id, visitor_id, viewed_at);

-- Public page clicks
CREATE TABLE click_events (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id),
  listing_id   UUID REFERENCES listings(id),              -- nullable
  wish_id      UUID REFERENCES wishes(id),                -- nullable
  gifter_ig    TEXT NULL,                                 -- for walloflove_gifter_instagram clicks
  click_type   TEXT NOT NULL,                             -- 'listing_media' | 'listing_instagram' | 'wish_checkout' | 'wish_instagram' | 'walloflove_gifter_instagram'
  visitor_id   UUID NOT NULL,
  clicked_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ON click_events (user_id, clicked_at);

-- User currency lock
ALTER TABLE users ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD';
-- Set once at onboarding. Immutable after.
```

### 5.3 Why 80% is stored, not computed

- Client never multiplies by 0.8 — avoids floating-point drift and magic numbers
- Commission rate could change per-listing or per-tier in future — storing actuals future-proofs this
- Ambassador-facing APIs return `commission_amount` only; admin-facing APIs can return all three columns
- Full audit trail preserved if rates change

### 5.4 API response shapes

```js
// GET /api/analytics
{
  today: {
    total:            1384,                    // whole number for Analytics
    chart:            [12, 45, 67, 52, 89, 76, 92, …],  // sparkline buckets
    breakdown: { listings: 900, wishes: 484 },
    payout:    { amount: 340, date: '2026-04-15', date_pretty: 'Wednesday, 15 April 2026' },
    funnel: {
      visits:  { value: 247, trend: 18,  direction: 'up' },
      clicks:  { value: 104, trend: 32,  direction: 'up' },
      gifts:   { value: 8,   trend: -5,  direction: 'down' }
    },
    topListings: [ { name: 'Salon de Luxe', count: 182, pct: 95 }, … ],
    topWishes:   [ { name: 'Fillers',       count: 88,  pct: 95 }, … ],
    topListing:  { name: 'Salon de Luxe', amount: 1200 },
    topGifter:   { name: 'Ahmed K.',      amount: 500 }
  },
  week:  { … },
  month: { … },
  all:   { … }
}

// GET /api/ambassador/payouts
{
  next_payout: {
    amount_formatted:     '$340.00',            // 2 decimals for Payouts
    currency:             'USD',
    scheduled_for:        '2026-04-15',
    scheduled_for_pretty: 'Wednesday, 15 April 2026'
  },
  total_formatted: '$1,740.00',
  total_count: 5,
  payouts: [
    { id: 'uuid…', reference: 'P8473921', amount_formatted: '$420.00',
      date_pretty: '8 April 2026', status: 'paid' },
    …
  ]
}

// GET /api/ambassador/payouts/:id
{
  reference:          'P8473921',
  amount_formatted:   '$420.00',
  currency:           'USD',
  date_pretty:        '8 April 2026',
  status:             'paid',
  listings_count:     4,
  wishes_count:       3,
  bank_display_name:  'Emirates NBD',
  bank_last4:         '4821',
  listings: [
    { listing_name: 'Salon de Luxe',
      subtitle:     '30-day renewal · 3 April 2026',
      amount_formatted: '$60.00' },
    …
  ],
  wishes: [
    { wish_name:            'Lip filler',
      gifter_display_name:  'Sara Johnson',    // or 'Anonymous'
      subtitle:             'Sara Johnson · 5 April 2026',
      amount_formatted:     '$75.00' },
    …
  ]
}
```

All formatting (`amount_formatted`, `subtitle`, `date_pretty`) done server-side. Client renders strings verbatim.

---

## 6. Amount Formatting — Cross-Page Rules

| Page | Format | Example |
|---|---|---|
| **Analytics** | Whole numbers, thousand separators, no decimals | `$1,384` |
| **Payouts list** | 2 decimals, thousand separators | `$1,740.00` |
| **Statement** | 2 decimals, thousand separators | `$420.00` |

**Why the split:** Analytics is "glanceable" (big numbers, fast visual comparison). Payouts/Statement are "financial record" (cross-referenced with bank statements, must match exactly). Industry standard — Stripe Dashboard follows the same pattern (big homepage numbers rounded, transaction details precise).

### Currency display

"USD" (or the user's locked currency) appears **once per page, only on the hero card**, inline after the amount:

```
$340.00  USD
```

- Amount: 28px/700 `#fff`
- Currency: 11px/600 `#666`, uppercase, `letter-spacing:0.8px`
- Gap: 8px

Other amounts on the page show `$` prefix only — no repeated currency label.

### Currency lock

- Set once during ambassador onboarding (USD, AED, EUR, GBP, etc.)
- Stored on `users.currency` — immutable after onboarding
- All Stripe payouts issued in this currency
- Business-driven change → admin-only migration, never user-facing

---

## 7. Clipboard Fallback

`copyPid()` sequence:

1. Try `navigator.clipboard.writeText(pid)` — modern browsers
2. If unavailable: fallback via hidden `<textarea>` + `document.execCommand('copy')`
3. If both fail: **still show "Copied!" swap** (optimistic UX)

Silent failure is preferred for a copy action. Surfacing an error toast for a nano-interaction is more annoying than the rare case where clipboard genuinely fails.

---

## 8. Mockup vs Production

The HTML is a functional mockup covering all three screens. Production work for Claude Code:

| Mockup | Production |
|---|---|
| Hardcoded listings/wishes/payouts | Replace with Supabase query results |
| Hardcoded `LISTINGS` / `WISHES` in `openPayoutDetail()` | Fetch from `GET /api/ambassador/payouts/:id` |
| Static sparkline path | Render from `chart` array in API response |
| Client-side row tap passes data to Statement | Keep pattern; data populates skeleton while fetch resolves |
| `alert()` for back-to-Dashboard | Wire to real router |
| In-memory cache of Payouts response | Wire to actual session cache |

All markup, modal chrome, drag-to-dismiss, transitions, toast mechanics, data attributes, and formatting stay identical between mockup and production.

### Console-testable

- Tap "View payouts →" → Payouts overlay slides in
- Tap any history row → Statement overlay slides in with that row's data
- Tap payout ID pill → in-place "Copied!" swap (real clipboard write)
- ESC key → closes topmost overlay
- Pull-to-refresh on Analytics → re-runs the existing PTR animation

---

## 9. Files

- `analytics_final.html` — single merged file: Analytics + Payouts overlay + Statement overlay
- `analytics_final_UI_Spec.md` — this document

---

## 10. Design Philosophy

- **Server formats, client renders.** All amounts, dates, gifter names, trends, and sparkline arrays are pre-formatted server-side. No client-side math, ever.
- **One file, three screens.** Overlays keep the whole flow as one testable artifact. No page reloads between Analytics → Payouts → Statement.
- **Two amount formats by context.** Analytics glances (whole numbers). Payouts/Statement record (2 decimals). Mixing would undermine both.
- **"Copied!" swaps in place.** No floating overlay, no toast chrome. The tapped element confirms itself.
- **Toasts are never tappable.** If we needed one, it would auto-dismiss only. (Kept from Listings spec for consistency.)
- **80% is stored, not computed.** Commission amounts are actual numbers in the DB. Rate changes don't break history.
- **Anonymous is a server decision.** Client receives "Anonymous" as a string. No conditional logic in UI.
- **One sparkline per page.** The earnings chart. Tiles have just number + trend — restraint beats density.
- **Client decides UX, backend validates data.** Fast overlays, instant modal opens, trust the client for the happy path — but backend is always the source of truth on writes (delete validation, commission calculation, session dedupe).
- **Deep links work.** Every URL can be bookmarked and shared; cold-load renders the full stack of overlays on arrival.
