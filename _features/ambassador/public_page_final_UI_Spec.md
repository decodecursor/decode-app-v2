# Public Page — UI Spec (Final)

**File:** `public_page_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `welovedecode.com/{slug}` (public, no auth, SEO-indexable)

---

## 1. Purpose

The ambassador's public-facing profile page. Strangers arriving from Sara's Instagram bio or a shared link see her Beauty Squad (professionals she recommends), her Wishlist (treatments followers can gift her), and her Wall of Love (prior gifts received). This is the top of the conversion funnel — it has to load fast, read clearly, and convert taps into listing media opens, Instagram clicks, and wish gifts.

---

## 2. Navigation — Entry Points, Exits & Data Flow

### 2.1 Inbound entry points

| Source | Entry URL |
|---|---|
| Ambassador's Instagram bio link | `welovedecode.com/{slug}` |
| Ambassador sharing via WhatsApp / DM / email | `welovedecode.com/{slug}` |
| Share button from the ambassador's own dashboard (preview) | `welovedecode.com/{slug}` |
| Direct URL / search engine result | `welovedecode.com/{slug}` |

Page is fully public — no auth required. Indexable by search engines.

### 2.2 Outbound exits — full map

| Element | Action | Opens where | Data written | Click event fired |
|---|---|---|---|---|
| Share button (top-right) | Native share or copy URL | System share sheet (mobile) or clipboard (desktop) | None | None |
| Cover photo | **No action** (display-only) | — | — | — |
| Ambassador name | **No action** (display-only) | — | — | — |
| Tagline | **No action** (display-only) | — | — | — |
| **Squad row — photo circle** | Open professional's Instagram | New tab (`instagram.com/{handle}`) | None | `listing_instagram` |
| **Squad row — business name** | Open professional's Instagram | New tab | None | `listing_instagram` |
| **Squad row — play button** | Open media lightbox for this listing | Lightbox overlay (separate spec) | None | `listing_media` |
| **Wishlist row — business name** | Open professional's Instagram | New tab | None | `wish_instagram` |
| **Wishlist row — "Gift it" pill** | Open gift checkout for this wish | `/gift/{wish_id}` | None | `wish_checkout` |
| **Wall of Love — gifter name** (non-anonymous only) | Open gifter's Instagram | New tab (`instagram.com/{gifter_ig}`) | None | `walloflove_gifter_instagram` |
| Wall of Love — Instagram icon | **Decorative only** (not independently tappable) | — | — | — |
| Wall of Love — Anonymous rows | **No tap action** (no IG handle) | — | — | — |
| "Powered by WeLoveDecode" footer | Open marketing homepage | `welovedecode.com` (same tab) | None | None |

### 2.3 Share button behavior

Tap the top-right share button:

1. **Mobile (supports `navigator.share`):** native share sheet opens with URL + title. On completion → "Shared!" flashes below button for 1.8s in green.
2. **Desktop (no native share, has clipboard API):** URL copied to clipboard → "Copied!" flashes below button.
3. **Both unsupported:** "Copy failed" flashes in green.

Fallback chain: `navigator.share` → `navigator.clipboard.writeText` → error message.

### 2.4 View tracking — session dedupe

Page views recorded in `view_events`. Deduped by `wld_visitor` cookie with **24-hour** window (matches Instagram / Linktree / Beacons creator-analytics standard).

**Server-side on render:**
1. Read cookie `wld_visitor`
2. If missing → generate UUID, set cookie (`max-age=86400`, 24h), insert `view_events` row
3. If present → check `view_events` for (user_id=slug-owner, visitor_id) in last 24h
4. If no recent row → insert new `view_events`
5. Otherwise → skip (dedupe)

**Excluded from tracking:**
- Authenticated ambassador viewing her own page (`auth.user_id === slug_owner_id`) — 0 views
- Bot crawlers (Googlebot, AhrefsBot, etc.) identified by user-agent — 0 views

See also: Analytics spec §2.4 — same dedupe rule applies there.

### 2.5 Click tracking

Every tap on a tracked element fires `POST /api/public/track-click`:

```js
{
  slug: 'sarajohnson',
  click_type: 'listing_instagram' | 'listing_media' | 'wish_instagram' | 'wish_checkout' | 'walloflove_gifter_instagram',
  listing_id?: uuid,
  wish_id?: uuid,
  gifter_ig?: string
}
```

Fire-and-forget. Uses `keepalive: true` so it completes even if the user navigates away (e.g. Instagram link opening in a new tab doesn't lose the request).

Server inserts into `click_events` — schema in §5.

### 2.6 Checkout redirect

Tapping "Gift it" navigates to `/gift/{wish_id}` (the gift checkout flow specified separately in `checkout_for_wish-gifter_final.html`). The click is tracked first, then navigation happens.

```js
function openCheckout(wishId) {
  trackClick('wish_checkout', { wish_id: wishId });
  window.location.href = '/gift/' + wishId;
}
```

### 2.7 Media lightbox

Tapping a squad play button opens a media lightbox with the professional's uploaded photos/videos. Lightbox itself is specified separately (not part of this spec).

```js
function openMedia(listingId) {
  trackClick('listing_media', { listing_id: listingId });
  // open lightbox overlay
}
```

---

## 3. Layout

1. **Cover** — 300px hero with cover photo, gradient fade to black, ambassador name (30px/700), tagline (12px/400 grey)
2. **My Beauty Squad** — list of professionals Sara recommends (photo + category + name + location + play button)
3. **My Beauty Wishlist** — treatments Sara wants, each with "Gift it" price pill
4. **My Wall of Love** — chronological list of gifts received (name + date + category + amount)
5. **Powered by WeLoveDecode** — marketing footer link

No status bar (9:41 artifact removed).

---

## 4. Sections — Detailed

### 4.1 Cover

| Element | Spec |
|---|---|
| Height | 300px |
| Cover image | Sara uploads at onboarding (editable in Settings). Background fallback: dark grey `#222` |
| Gradient overlay | `linear-gradient(transparent, #000)` bottom 120px for text legibility |
| Share button | 32×32 circle top-right, `rgba(0,0,0,0.35)` with `backdrop-filter: blur(8px)`, white share icon |
| "Copied!" / "Shared!" toast | Positioned below share button, `#4ade80` green, 11px/600, text-shadow for readability |
| Ambassador name | 30px/700 `#fff`, centered, `letter-spacing:-0.3px` |
| Tagline | 12px/400 `#777`, centered below name |

**Tagline handling:**
- Source: `users.tagline` (editable in Settings only — not set at onboarding)
- If empty → **hide the tagline row entirely** (no placeholder text)
- In mockup the string "write your customized tag line here" is visible; that's the empty-state placeholder Sara sees in her settings preview — the public page does not render that string

### 4.2 My Beauty Squad

Each row:

| Element | Spec |
|---|---|
| Photo circle | 52×52 round, `#333` bg fallback, tappable (opens IG) |
| Category | 11px/700 `#e91e8c` uppercase, `letter-spacing:1px` |
| Business name | 15px/600 `#fff`, tappable (opens IG) |
| Location | 12px/400 `#777` |
| Play button | 36×36 circle, 1.5px `#e91e8c` outlined, transparent bg, pink play icon |
| Row dividers | 1px `#1a1a1a` top-border on each row; last row also has bottom-border |
| Row padding | 14px vertical |
| Gap between photo / content / play button | 14px |

**Tap targets:**
- Photo circle → IG (`listing_instagram`)
- Business name → IG (`listing_instagram`)
- Play button → media lightbox (`listing_media`)
- Category/location → not tappable

### 4.3 My Beauty Wishlist

Each row:

| Element | Spec |
|---|---|
| Category | 11px/700 `#e91e8c` uppercase |
| Business name | 15px/600 `#fff`, tappable (opens IG) |
| Location | 12px/400 `#777` |
| "Gift it" pill | 1.5px `#e91e8c` outline, 18px radius, transparent bg, 10×18 padding. Two lines: price (15px/600 `#e91e8c`) + "Gift it" (12px/600 `#fff`, 1px top margin) |
| Row dividers | Same as Squad |

**No photo circle** — the pink price pill is the visual anchor. Confirmed intentional.

**Tap targets:**
- Business name → IG (`wish_instagram`)
- Gift it pill → `/gift/{wish_id}` (`wish_checkout`)
- Category/location → not tappable

### 4.4 My Wall of Love

Heart SVG icon (pink) inline with heading.

Each row:

| Element | Spec |
|---|---|
| Instagram icon | 16×16 square+circle SVG, stroke `#e91e8c` (real name) or `#777` (anonymous). Decorative only — not tappable. |
| Gifter name | 15px/600 `#fff`. Real names wrapped in `<a>` to Instagram (new tab); Anonymous is plain text |
| Date | 12px/400 `#777`, format "12 March 2026" |
| Category | 11px/700 `#e91e8c` uppercase |
| Amount | 15px/600 `#fff`, whole numbers + thousand separators (e.g. `$500`, `$2,500`) |
| Row dividers | 1px `#1a1a1a` top-border; last row also bottom-border |
| Row padding | 12px vertical |

**Tap targets:**
- Gifter name (non-anonymous only) → Instagram in new tab (`walloflove_gifter_instagram`)
- Anonymous rows → no tap action
- Icon → not independently tappable

**Load all gifts on first render.** No pagination, no "Load more" button. When volume becomes an issue later, add pagination as a later iteration — simple now.

**Anonymous rows:**
- `wish_gifts.is_anonymous = true` → gifter_display_name returns "Anonymous" from server
- No IG handle, so icon stroke is grey `#777`, no name tap, no click event
- Everything else (date, category, amount) shows normally

### 4.5 Footer

"Powered by WeLoveDecode" — 12px/400 `#777`, centered, links to `https://welovedecode.com` in same tab.

---

## 5. Data Storage — Schema & API

### 5.1 Schema (relevant to this page)

```sql
-- Ambassador identity
ALTER TABLE users ADD COLUMN slug TEXT UNIQUE NOT NULL;             -- e.g. 'sarajohnson'
ALTER TABLE users ADD COLUMN tagline TEXT NULL;                     -- nullable, set in Settings
ALTER TABLE users ADD COLUMN cover_photo_url TEXT NULL;             -- uploaded at onboarding
ALTER TABLE users ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD';

-- Listings (Squad entries) — already defined in Listings spec
-- Wishes — already defined in Wishlist spec
-- Wish gifts (Wall of Love rows) — already defined in Wishlist spec
ALTER TABLE wish_gifts ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE wish_gifts ADD COLUMN gifter_display_name TEXT NOT NULL; -- "Anonymous" or real name
ALTER TABLE wish_gifts ADD COLUMN gifter_instagram TEXT NULL;        -- NULL if anonymous

-- Public page view tracking (deduped by cookie, 24h window)
CREATE TABLE view_events (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),       -- ambassador whose page was viewed
  visitor_id UUID NOT NULL,                            -- from 'wld_visitor' cookie
  viewed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  country    TEXT,                                     -- from IP geolocation
  user_agent TEXT
);
CREATE INDEX ON view_events (user_id, visitor_id, viewed_at DESC);

-- Click tracking for all public-page interactions
CREATE TABLE click_events (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),       -- ambassador whose page was tapped
  listing_id UUID REFERENCES listings(id),             -- nullable
  wish_id    UUID REFERENCES wishes(id),               -- nullable
  gifter_ig  TEXT NULL,                                -- for walloflove_gifter_instagram clicks
  click_type TEXT NOT NULL,                            -- see enum below
  visitor_id UUID NOT NULL,
  clicked_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ON click_events (user_id, clicked_at DESC);

-- click_type enum values (public page only):
--   'listing_media'                   squad play button → media lightbox
--   'listing_instagram'               squad photo/name → IG
--   'wish_checkout'                   "Gift it" pill → gift checkout
--   'wish_instagram'                  wishlist name → IG
--   'walloflove_gifter_instagram'     wall of love gifter name → IG
```

### 5.2 API responses

```js
// GET /api/public/{slug}
// Returns the full page data in one call — rendered server-side for SEO
{
  ambassador: {
    name:             'Sara Johnson',
    tagline:          'Bringing beauty wisdom to Dubai',    // or null → hide row
    cover_photo_url:  '…'
  },
  squad: [
    {
      id:              'uuid…',
      name:            'Salon de Luxe',
      category:        'Hair',
      location:        'Dubai, UAE',
      photo_url:       '…',
      instagram_handle: 'salondeluxe'
    },
    …
  ],
  wishlist: [
    {
      id:               'uuid…',
      professional_name:'Salon de Luxe',
      category:         'Hair',
      location:         'Dubai, UAE',
      instagram_handle: 'salondeluxe',
      price:            300,                              // whole dollars
      price_formatted:  '$300'                            // pre-formatted
    },
    …
  ],
  wall: [
    {
      id:                   'uuid…',
      gifter_display_name:  'Ahmed Khalil',              // or 'Anonymous'
      gifter_instagram:     'ahmedkhalil',               // null if anonymous
      date_pretty:          '12 March 2026',
      category:             'Fillers',
      amount:               500,
      amount_formatted:     '$500'
    },
    …
  ]
}
```

All amounts pre-formatted server-side using `users.currency`. Client renders verbatim.

### 5.3 Track click endpoint

```js
// POST /api/public/track-click
// body:
{
  slug:       'sarajohnson',
  click_type: 'listing_media',
  listing_id: 'uuid…',      // optional, depending on click_type
  wish_id:    'uuid…',      // optional
  gifter_ig:  'ahmedkhalil' // optional, for walloflove_gifter_instagram
}

// response: 204 No Content — fire-and-forget, errors ignored client-side
// server-side: resolves slug → user_id, inserts click_events row with visitor_id from cookie
```

### 5.4 Cookie details

- Name: `wld_visitor`
- Value: UUID v4
- `max-age: 86400` (24 hours)
- `httpOnly: true` (server-set, not JS-readable)
- `sameSite: lax`
- `secure: true` (production)
- Set on first view of any `/{slug}` page; refreshed on each visit (rolling 24h)

---

## 6. Amount Formatting

| Context | Format | Example |
|---|---|---|
| Wishlist "Gift it" price | Whole, thousand separators | `$300`, `$1,200` |
| Wall of Love amount | Whole, thousand separators | `$500`, `$2,500` |

**No decimals on this page.** Same rule as Analytics — public-facing, glanceable.

Currency symbol from `users.currency` (locked at onboarding).

---

## 7. Empty States

**All sections hide entirely when empty:**

| Section | Empty state |
|---|---|
| Squad (0 listings) | Section hidden entirely |
| Wishlist (0 wishes) | Section hidden entirely |
| Wall of Love (0 gifts) | Section hidden entirely |

Page still renders with cover + name + (optional tagline) + footer. No "coming soon" copy, no placeholder.

### Self-view (ambassador viewing own page)

Same public view — Sara previews her page exactly as followers see it. No edit controls inline.

---

## 8. Mockup vs Production

The mockup uses:
- Hardcoded squad rows (4 items)
- Hardcoded wishlist rows (2 items)
- Hardcoded gifts array (8 items) for Wall of Love
- `console.log` instead of real `trackClick()` fetch call
- `alert()` / `console.log` instead of real `openMedia()` / `openCheckout()` navigation

Production swaps these for:
- API-driven render loops over `GET /api/public/{slug}` response
- Real `fetch('/api/public/track-click', { keepalive: true })` calls
- Real navigation (`window.location.href = '/gift/' + wishId`) and lightbox overlay for media

All markup, tap handlers, CSS, share button logic, and click-tracking hook points stay identical.

---

## 9. Files

- `public_page_final.html` — interactive mockup
- `public_page_final_UI_Spec.md` — this document

---

## 10. Design Philosophy

- **Public-facing = glanceable.** Whole numbers, no decimals. Big clear amounts.
- **Every tap is tracked.** 5 click event types cover every meaningful interaction. Non-tracked elements (covers, categories, locations) are display-only.
- **Anonymous is a server decision.** The page never checks `is_anonymous` — it just gets `gifter_display_name: "Anonymous"` and renders it with the grey-stroke icon.
- **Load everything upfront.** No pagination for Wall of Love until it's actually needed. Simplicity beats premature optimization.
- **SEO-indexable and cold-load friendly.** Server-rendered HTML on first request. Progressive hydration for interactivity. Fast as possible because this is the top of the funnel.
- **Tagline hides when empty.** No placeholder, no "add a tagline" nag on a follower's screen.
- **24-hour view dedupe.** Matches creator-analytics industry standard. Simple cookie logic, minimal engineering cost.
- **Fire-and-forget tracking.** Click events use `keepalive: true` so they survive tab-close from IG opens. If one fails, we don't care — the conversion still happens.
