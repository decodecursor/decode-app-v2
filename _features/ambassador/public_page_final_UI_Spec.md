# Public Page — UI Spec (Final, Trust Stack)

**File:** `public_page_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `welovedecode.com/{slug}` (public, no auth, SEO-indexable)

---

> **⚠ TRUST STACK SUPERSESSION (Trust Stack slice, 2026-05, final state `24a6505`).**
> This document supersedes the pre-Trust-Stack public-page spec. The **My Beauty Squad** section and its tap model are rebuilt; a new **Pro Info modal** surface is added; an **ambassador Instagram button** is added to the cover; the analytics event vocabulary is the `model_analytics_events.event_type` CHECK enum (single events table, not separate `view_events`/`click_events`). **My Beauty Wishlist** and **My Wall of Love** are unchanged by this slice and remain as shipped in Slice 5D (`3a3c1a5`). Swipe-to-dismiss on the Pro Info modal was attempted and **dropped for V1** — see §4.6 for the rationale and the documented library constraints.

> **⚠ V1 SCOPE SUPERSESSION (Slice 4A #4, 2026-04-23) — UN-SUPERSEDED in Slice 5D (2026-04-25).** Wishlist + Wall of Love shipped in Slice 5D (`3a3c1a5`): WishesSection gated on `profile.gifts_enabled`; WallOfLoveSection gated on existence of completed payments. Both fetch via anon supabase-js post-mount (Pattern 2), ISR-safe. The wish-row business name renders as plain text (no `professional_instagram` column on `model_wishes`).

---

## 1. Purpose

The ambassador's public-facing profile page. Strangers arriving from Sara's Instagram bio or a shared link see her Beauty Squad (professionals she recommends, now with third-party trust signals and a detail modal), her Wishlist (treatments followers can gift her), and her Wall of Love (prior gifts received). This is the top of the conversion funnel — it must load fast, read clearly, and convert taps into Instagram opens, media-lightbox opens, **Pro Info modal opens**, **WhatsApp messages**, and wish gifts.

The Trust Stack adds independent credibility (Google rating, review distribution, AI-summarised reviews) and a direct, low-friction contact path (WhatsApp), so a follower can move from "Sara recommends this" to "I've messaged them" without leaving the page.

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

| Element | Action | Opens where | Click event fired |
|---|---|---|---|
| **Ambassador IG button (top-left)** | Open ambassador's own Instagram | New tab (`instagram.com/{handle}`) | `ambassador_instagram_click` |
| Share button (top-right) | Native share or copy URL | System share sheet / clipboard | `public_page_share_click` |
| Cover photo / name / tagline | **No action** (display-only) | — | — |
| **Squad — avatar (large circle)** | Open professional's Instagram | New tab (`instagram.com/{handle}`) | `listing_instagram_click` |
| **Squad — WhatsApp badge** (overlapping avatar) | Open WhatsApp chat | `wa.me/{number}` **same tab** | `listing_whatsapp_badge_click` |
| **Squad — middle column** (category + name + city + trust row) | Open Pro Info modal | In-page overlay | `listing_modal_open` |
| **Squad — media orb (right)** | Open media lightbox | Lightbox overlay (separate spec) | `listing_media_click` |
| **Pro Info modal — Website** | Open business website | `{website}` **same tab** | — |
| **Pro Info modal — Google Maps** | Open Maps listing | Maps universal link **same tab** | — |
| **Pro Info modal — Phone** | Start a call | `tel:{number}` (native handler) | — |
| **Pro Info modal — Send WhatsApp** | Open WhatsApp chat | `wa.me/{number}` **same tab** | `listing_whatsapp_modal_click` |
| **Pro Info modal — Cancel / backdrop / Escape** | Close the modal | — | — |
| **Wishlist — "Gift it" pill** | Open gift checkout | `/gift/{wish_id}` | `wish_giftit_click` |
| Wishlist — business name | **No action** (plain text — no IG column) | — | — |
| **Wall of Love — gifter name** (non-anonymous) | Open gifter's Instagram | New tab | `wall_of_love_instagram_click` |
| Wall of Love — icon / anonymous rows | **No action** | — | — |
| "Powered by WeLoveDecode" footer | Open marketing homepage | `welovedecode.com` (same tab) | — |

**Tap-routing note (locked):** the squad avatar is the *only* Instagram entry on a squad row. The business name no longer opens IG — the entire middle column opens the Pro Info modal instead. The WhatsApp badge sits on top of the avatar and uses `stopPropagation` so a badge tap never also opens the modal.

### 2.3 Why links are native same-tab (`<a href>`, no `target`)

> **⚠ iOS HANDOFF FIX (`3e8a3e7` + `c32abcd`).** The quick-action links (Website / Google Maps / Phone) and both WhatsApp surfaces (badge + modal Send WhatsApp) are plain `<a href>` with **no `target` attribute** and **no `window.open`**. On iOS Safari, `target="_blank"` (and `window.open(..., '_blank')`) breaks app handoff for `tel:` and universal links (Maps/WhatsApp) and can trigger an iOS 26 page-interactivity-loss bug. Same-tab navigation lets iOS hand `tel:`/`wa.me`/Maps off to the native app. Analytics fire on the element's `onClick` with **no `preventDefault`**, and the tracking `fetch` uses `keepalive: true` so it survives the navigation. The WhatsApp badge additionally keeps `stopPropagation` so it doesn't also open the modal. **The mockup keeps `target="_blank"` on a couple of links only so the demo opens visibly in a sandbox; production renders them with no `target` (see the `quickBtn` comment in the HTML).**

### 2.4 Share button behavior

Tap top-right share: `navigator.share` (mobile native sheet) → `navigator.clipboard.writeText` (desktop, "Copied!") → "Copy failed". Confirmation flashes below the button for 1.8s in green. Fires `public_page_share_click`.

### 2.5 View + click tracking — single events table

> **⚠ SUPERSESSION (Slice 4D + Trust Stack).** All tracking fires to `POST /api/analytics/track` with body `{ event_type, slug, target_id? }`, `keepalive: true`, fire-and-forget. There is **one** table — `model_analytics_events` — with an `event_type` discriminator column (no separate `view_events` / `click_events` tables; the older two-table model is fully superseded). `public_page_view` is fired server-side / on mount by `PublicPageClient`; the server does bot filtering (`isbot`), IP+event rate-limiting (`analyticsLimiter`), ambassador self-view skip, and session-cookie dedupe (`wld_visitor`, 30-day max-age).

**`event_type` values used on this page (the `model_analytics_events` CHECK enum, 12 total — 11 live, `ambassador_instagram_click` pending remote migration `20260515152624`):**

| Event | Fired by |
|---|---|
| `public_page_view` | Server/mount on page render |
| `listing_instagram_click` | Squad avatar → professional IG |
| `listing_media_click` | Squad media orb → lightbox |
| `wish_giftit_click` | Wishlist "Gift it" pill → checkout |
| `wish_instagram_click` | Wishlist row → professional IG (currently inactive — `professional_instagram` column not on `model_wishes`; enum value reserved for future wishlist-IG surface) |
| `public_page_share_click` | Share button (top-right) |
| `wall_of_love_instagram_click` | Wall of Love gifter name → IG |
| `squad_media_swipe_view` | Media lightbox swipe (lightbox spec) |
| `listing_modal_open` | Squad middle column → Pro Info modal (once per open) |
| `listing_whatsapp_badge_click` | Squad WhatsApp badge → wa.me |
| `listing_whatsapp_modal_click` | Modal Send WhatsApp → wa.me |
| `ambassador_instagram_click` | Ambassador IG button (top-left) — *(pending remote migration `20260515152624`)* |

`target_id` carries the listing/wish/gifter identifier where applicable. `listing_modal_open` fires **once per modal open** (guarded; re-arms after the modal closes).

### 2.6 Media lightbox / checkout

Squad media orb → `listing_media_click` then media lightbox (separate spec). Wishlist "Gift it" → `wish_giftit_click` then `/gift/{wish_id}`.

---

## 3. Layout

1. **Cover** — 300px hero: cover photo, gradient fade to black, ambassador name (30px/700), tagline (12px/400 grey). **Ambassador IG button top-left**, **Share button top-right** (mirrored 32×32 circles).
2. **My Beauty Squad** — list of professionals with avatar + WhatsApp badge + category/name/city + **trust row** + media orb.
3. **My Beauty Wishlist** — treatments Sara wants, each with a "Gift it" price pill.
4. **My Wall of Love** — chronological list of gifts received.
5. **Powered by WeLoveDecode** — marketing footer link.
6. **Pro Info modal** — sibling-mounted bottom-sheet overlay, hidden until a squad middle-column tap.

No status bar.

---

## 4. Sections — Detailed

### 4.1 Cover

| Element | Spec |
|---|---|
| Height | 300px |
| Cover image | Ambassador uploads at onboarding; fallback `#222` |
| Gradient overlay | `linear-gradient(transparent, #000)` bottom 120px |
| Ambassador IG button (top-left) | 32×32 circle, `rgba(0,0,0,0.35)` + `backdrop-filter: blur(8px)`, **18×18** IG glyph (intentionally 2px larger than the share icon). Opens `instagram.com/{users.instagram_handle}`. Fires `ambassador_instagram_click` |
| Share button (top-right) | 32×32 circle, same bg/blur, **16×16** share glyph. "Copied!"/"Shared!" toast (`#4ade80`, 11px/600) below |
| Ambassador name | 30px/700 `#fff`, centered, `letter-spacing:-0.3px` |
| Tagline | 12px/400 `#777`, centered. Source `users.tagline`; **hide the row entirely if empty** (no placeholder on a follower's screen) |

> **Schema note:** `instagram_handle` lives on `public.users` (the ambassador), **not** on `model_profiles`. It is threaded through `fetchProfile → PublicProfile → PublicHeader`.

### 4.2 My Beauty Squad — row anatomy

Each row is a flex strip: **avatar (left, fixed) · middle column (flex) · media orb (right, fixed)**, 14px gaps, 14px vertical padding, 1px `#1a1a1a` top-border (last row also bottom-border).

| Element | Spec |
|---|---|
| **Avatar** | 72×72 round, `#333` fallback, 2px `#e91e8c` ring. **Tap → professional Instagram** (`listing_instagram_click`). New tab. |
| **WhatsApp badge** | 26×26 green (`#25d366`) circle, 2px black border, white WhatsApp glyph (14×14). Positioned bottom-right, overlapping the avatar (`right:-2px; bottom:-2px`). **Tap → `wa.me/{number}` same tab** (`listing_whatsapp_badge_click`); `stopPropagation` so the modal does not also open. **Rendered only if the listing has a WhatsApp number.** Pulses (see demand states) when `messaged_30d ≥ 10`. |
| **Category** | 11px/700 `#e91e8c` uppercase, `letter-spacing:1px` |
| **Business name** | 15px/600 `#fff` (no longer a link) |
| **City** | 12px/400 `#777` |
| **Trust row** | 13px `#ddd`, single line, no wrap — see §4.3 |
| **Middle column (whole block)** | `role="button"`, keyboard-activatable (Enter/Space). **Tap → Pro Info modal** (`listing_modal_open`) |
| **Media orb** | 44×44 circle, 1.5px `#e91e8c` ring, transparent bg, pink play glyph. **Tap → media lightbox** (`listing_media_click`). Production may render an extracted video thumbnail behind the glyph (client-side `video-thumbnail.ts`, Chunk 6); fallback is the dark orb shown in the mockup |

### 4.3 Trust row — format & demand states (Q12 locked)

Compact, single line, drops filler words. Format:

```
★ 4.8 (595) · 💬 47 in 30d
```

- **Rating segment:** `★` (filled white) + `{rating to 1dp}` + `({review_count})`. **Omitted entirely** if the listing has no Google rating (no `google_place_id`, or `rating`/`review_count` ≤ 0).
- **Separator:** ` · ` in `#555`.
- **Demand segment:** filled-white chat-bubble glyph (same visual weight as the star) + one of three states:

| Condition | Renders | WhatsApp badge |
|---|---|---|
| `messaged_30d ≥ 10` | `💬 {N} in 30d` | **pulses** (`wa-pulse` 2.4s ease-out infinite) |
| `messaged_30d` 1–9 | `💬 Last msg {X}d ago` | no pulse |
| `messaged_30d` = 0 | `💬 New` | no pulse |

> The "New" state is **always-on for V1** (any listing with 0 messages reads "New"). A post-launch hardening item adds a 60-day `created_at` window so only genuinely new listings show "New" rather than long-stale ones. The chat glyph is the original outline bubble with `stroke→fill="#fff"` so it matches the star's visual weight.

### 4.4 Pro Info modal — structure

Sibling-mounted overlay (not a route). Hidden by default; a squad middle-column tap opens it.

| Layer | Spec |
|---|---|
| Backdrop | `position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end` (bottom-sheet) |
| Sheet | `background: #0a0a0a` (solid, **no gradient, no dividers**); `border-radius: 24px 24px 0 0`; `max-width: 420; width: 100%; max-height: 90vh; overflow-y: auto`; `color: #fff`; slides up via `transform: translateY(100% → 0)` over 200ms ease-out |

**Hero** — `padding: 24px 16px 10px`, centered:

| Element | Spec |
|---|---|
| Category eyebrow | 11px/700 `#e91e8c`, `letter-spacing:0.08em`, uppercase, `margin: 0 0 4px` |
| Name (`h2`) | 20px/500 `#fff`, `line-height:1.2`, `margin: 0 0 3px` |
| City | 12px `#888`, `margin: 0 0 22px` |
| Rating column | `40px`/300 figure (`letter-spacing:-1px`) · 13px stars `#fff` (`letter-spacing:1.5px`) · 10px `#888` "{N} Google reviews" |
| Distribution | 5 rows (5★→1★): label 10px `#aaa` · bar `height:4px`, track `rgba(255,255,255,0.08)` `border-radius:2px`, fill `#e91e8c` growing `0% → pct%` over **1500ms cubic-bezier(0.215,0.61,0.355,1)** on open · count 10px `#888` tabular-nums |

> **Distribution is an estimate (Q4 locked).** Google Places (New) does **not** expose a 5-bucket review histogram. The bars are a J-curve estimate derived from `rating` + `review_count` — directionally honest, not Google's real per-star counts.

**Quick-action row** — `padding: 14px 16px`, `display: grid; grid-template-columns: repeat(N,1fr); gap: 8px` where N is the number of available actions:

| Element | Spec |
|---|---|
| Button | `background: #0a0a0a` (border-only), `0.5px solid #2a2a2a`, `border-radius: 12px`, `padding: 8px 0`, column flex, icon→label gap 4px |
| Icon | 16×16, stroke `#e91e8c`, `stroke-width:2` |
| Label | 11px `#ddd` |
| Actions | **Website** (if `website`), **Google Maps** (if `maps_url`), **Phone** (if `phone`). Each is a native `<a href>` with **no `target`** (Phone is `tel:`). Maps uses the documented universal link `https://www.google.com/maps/search/?api=1&query={name}&query_place_id={placeId}` |

The 24px visual gap above and below this row is composed from the hero's 10px bottom padding + the row's 14px top padding (= 24), and the row's 14px bottom padding + the AI-summary's 10px top padding (= 24).

**AI summary** — `padding: 10px 20px 20px`:

| Element | Spec |
|---|---|
| Label | "AI SUMMARY OF REVIEWS" — 10px `#888`, `letter-spacing:0.08em`, uppercase, `margin: 0 0 4px` |
| Quote | Georgia italic, 14px `#fff`, `line-height:1.5`, `letter-spacing:0.01em`, `text-align:justify`, `hyphens:auto`, wrapped in typographic quotes, `margin: 0 0 4px` |
| Disclosure | "Summarized with Gemini" — 10px `#555`, normal style, sans-serif |

> **Q5/Q6 locked.** Summary generated by **Gemini `gemini-2.5-flash`** (`gemini-1.5-flash` was retired and 404'd silently, leaving the column NULL — fixed). Cached with a 24h TTL alongside the Places response.

**Demand line** — `padding: 0 20px 14px`, 11px `#e91e8c`/500, centered: `"{N} people messaged in the last 30 days"`. **Hidden when `messaged_30d` = 0.**

**Send WhatsApp** — `padding: 0 20px 8px`; button is a native `<a href="https://wa.me/{number}">` (no `target`): `background:#e91e8c; color:#fff; border-radius:12px; padding:16px 0; font-size:15px; font-weight:700; letter-spacing:0.2px`. Fires `listing_whatsapp_modal_click` on click (no `preventDefault`). **Hidden when the listing has no WhatsApp number.**

**Cancel** — `padding: 14px 20px 18px`, centered, `#888`/13px, no border/background.

### 4.5 Pro Info modal — degraded states

The modal renders only the sections whose data exists:

| Missing data | Effect |
|---|---|
| No `google_place_id` (no rating/reviews) | Rating column + distribution **hidden**; AI summary typically also absent; modal still shows category/name/city + any quick actions + WhatsApp |
| No `website` | Website quick-action button omitted; grid recomputes to remaining columns |
| No `maps_url` | Maps button omitted |
| No `phone` | Phone button omitted |
| No quick actions at all | Quick-action row hidden |
| No AI summary | AI-summary block hidden |
| `messaged_30d` = 0 | Demand line hidden |
| No WhatsApp number | Send WhatsApp button hidden (and no badge on the card) |

The modal degrades gracefully to as little as category + name + city if a listing has only an Instagram link.

### 4.6 Pro Info modal — close behavior (no swipe-close)

The modal closes via **Cancel button**, **backdrop tap** (only when the backdrop itself is the event target — interior taps don't bubble-close), or **Escape**.

> **⚠ NO SWIPE-TO-DISMISS IN V1 — locked decision (final state `24a6505`).** Drag/swipe-to-dismiss was attempted four times and dropped. (1) Hand-rolled touch handlers broke the `tel:` user-activation chain three times — a non-passive `touchmove` listener taints iOS's user-activation, so Phone stopped dialing. (2)–(4) The `vaul` library hit a **documented bug** for our exact configuration — a controlled drawer with `modal={false}` whose `open` is set from outside (not via `Drawer.Trigger`): vaul's `useControllableState` never resets `document.body{pointer-events:none}`, leaving the entire page unclickable (vaul issues **#492 / #534 / #509**; `modal={true}` instead froze the screen via a stuck body inert-lock). shadcn-ui **#8507** independently documents vaul's Drawer being unreliable for iOS pointer isolation, with Radix Sheet as the recommended replacement — but Radix has no built-in drag, which reintroduces the hand-rolled-drag problem. Given the constraint set (controlled-open-from-elsewhere + `tel:`/universal-link buttons inside the sheet + no test environment except blind iPhone production deploys), no path delivered drag-to-dismiss without breaking either the conversion buttons or the whole page. Standard Cancel/backdrop/Escape close is shipped. Swipe-close is parked as a post-launch task requiring real on-device debugging tooling, or dropped permanently. It is **not** a launch blocker.

### 4.7 My Beauty Wishlist *(unchanged this slice)*

Each row: category (11px/700 `#e91e8c` uppercase) · business name (15px/600 `#fff`, **plain text** — no `professional_instagram` column) · location (12px/400 `#777`) · "Gift it" pill (1.5px `#e91e8c` outline, 18px radius, transparent, two lines: price 15px/600 `#e91e8c` + "Gift it" 12px/600 `#fff`). Pill → `/gift/{wish_id}` (`wish_giftit_click`). Same row dividers as Squad.

### 4.8 My Wall of Love *(unchanged this slice)*

Heart SVG (pink) inline with heading. Each row: IG icon (16×16, stroke `#e91e8c` real / `#777` anonymous, decorative) · gifter name (15px/600 `#fff`; real names link to IG new-tab `wall_of_love_instagram_click`, Anonymous is plain text) · date (12px/400 `#777`, "12 March 2026") · category (11px/700 `#e91e8c` uppercase) · amount (15px/600 `#fff`, whole + thousands). 12px vertical padding. Load all on first render, no pagination. Anonymous is a server decision (`gifter_display_name: "Anonymous"`, grey icon, no tap).

### 4.9 Footer

"Powered by WeLoveDecode" — 12px/400 `#777`, centered, links to `https://welovedecode.com` same tab.

---

## 5. Data Storage — Schema & API

### 5.1 Schema (Trust Stack additions)

```sql
-- Trust Stack fields on the listing's professional record
-- (verbatim from supabase/migrations/20260514_trust_stack_foundation.sql).
-- 10 nullable columns; no backfill. V1-active vs. V1 forward-compat split:
--   V1 active:        google_place_id, whatsapp_number, google_places_cache,
--                     google_places_cached_at, review_summary_gemini,
--                     review_summary_generated_at
--   V1 forward-compat: review_summary_custom, claimed_by_user_id,
--                     claimed_at, google_business_profile_id
ALTER TABLE model_professionals
  ADD COLUMN google_place_id              TEXT         NULL,
  ADD COLUMN whatsapp_number              TEXT         NULL,
  ADD COLUMN google_places_cache          JSONB        NULL,
  ADD COLUMN google_places_cached_at      TIMESTAMPTZ  NULL,
  ADD COLUMN review_summary_gemini        TEXT         NULL,
  ADD COLUMN review_summary_generated_at  TIMESTAMPTZ  NULL,
  ADD COLUMN review_summary_custom        TEXT         NULL,
  ADD COLUMN claimed_by_user_id           UUID         NULL REFERENCES users(id),
  ADD COLUMN claimed_at                   TIMESTAMPTZ  NULL,
  ADD COLUMN google_business_profile_id   TEXT         NULL;

-- Single analytics events table (event_type discriminator) — NOT
-- separate view_events / click_events tables.
-- model_analytics_events (12 columns):
--   id, model_id (FK model_profiles.id, NOT NULL), event_type,
--   target_id (uuid, nullable), ip_hash, session_id, user_agent,
--   device_type, referrer, country, utm_params (jsonb), created_at
-- event_type CHECK enum — canonical 12 values:
--   public_page_view,
--   listing_instagram_click,
--   listing_media_click,
--   wish_giftit_click,
--   wish_instagram_click,
--   public_page_share_click,
--   wall_of_love_instagram_click,
--   squad_media_swipe_view,
--   listing_modal_open,
--   listing_whatsapp_badge_click,
--   listing_whatsapp_modal_click,
--   ambassador_instagram_click   -- pending remote migration 20260515152624
```

> **Derived fields (NOT stored as columns on `model_professionals`).** `rating`, `review_count`, `distribution[5]`, `maps_uri` (Google Maps universal link), `website_uri`, `phone_number`, and the raw `ai_review_summary` exposed via the API are all **derived at API time from `google_places_cache` (jsonb) + `review_summary_gemini`** — the §5.2 API response shape projects them out of the JSONB blob and the AI-summary text column. They are not separate columns on `model_professionals`. Similarly, `video_thumbnail_url` lives on `model_listings` (Slice 6 video stack), NOT on `model_professionals`. See §5.2 for the canonical API shape.

> `messaged_30d` is **derived**, not stored: a 30-day rolling count of `listing_whatsapp_badge_click` + `listing_whatsapp_modal_click` events for the listing. The "New" / "Last msg Xd ago" / "{N} in 30d" state is computed from it (§4.3).

### 5.2 API response (shape)

```js
// GET /api/public/{slug}  (server-rendered for SEO; Trust Stack
// fields hydrated from the 24h-cached Google Places + Gemini)
{
  profile: { slug, name, tagline, cover_photo_url, instagram_handle },
  listings: [
    {
      id, category, name, city,
      instagram_handle,
      rating, review_count, distribution: [5,4,3,2,1],  // estimate
      ai_review_summary,
      messaged_30d, last_msg_days,
      whatsapp_number, website_uri, google_maps_uri, phone_number,
      video_thumbnail_url
    }, …
  ],
  wishlist: [ { id, professional_name, category, location, price, price_formatted }, … ],
  wall:     [ { id, gifter_display_name, gifter_instagram, date_pretty, category, amount, amount_formatted }, … ]
}
```

Any Trust Stack field may be `null` → the corresponding UI degrades per §4.3 / §4.5. Amounts pre-formatted server-side; client renders verbatim.

### 5.3 Track endpoint

```js
// POST /api/analytics/track
{ event_type: '<one of the 12 enum values>', slug: 'sarajohnson', target_id?: 'uuid' }
// fire-and-forget, keepalive:true, server resolves slug→model_id,
// applies bot filter + rate-limit + self-view skip, inserts one
// model_analytics_events row.
```

---

## 6. Amount Formatting

| Context | Format | Example |
|---|---|---|
| Wishlist "Gift it" price | Whole, thousand separators | `$300`, `$1,200` |
| Wall of Love amount | Whole, thousand separators | `$500`, `$2,500` |
| Trust-row review count | Plain integer in parentheses | `(595)` |
| Modal rating figure | One decimal | `4.8` |
| Modal distribution counts | Plain integers, tabular-nums | `465` |

No decimals on money. Currency symbol from `users.currency` (locked at onboarding).

---

## 7. Empty States

| Section | Empty state |
|---|---|
| Squad (0 listings) | Section hidden entirely |
| Wishlist (0 wishes) | Section hidden entirely |
| Wall of Love (0 gifts) | Section hidden entirely |
| Trust row — no Google rating | Rating segment omitted; demand segment still renders ("New" at minimum) |
| Pro Info modal — degraded | Renders only the sections with data (§4.5); minimum is category + name + city |

Page still renders cover + name + (optional tagline) + footer. No "coming soon" copy. Self-view = same public view (no inline edit controls).

---

## 8. Mockup vs Production

The mockup uses:
- Hardcoded `squad` array (6 listings with full Trust Stack fields) and `gifts` array
- A vanilla-JS sibling-mounted modal with open/close + slide + distribution-grow
- `console.log` instead of the real `keepalive` tracking `fetch`
- `target="_blank"` on a couple of links **only so the demo opens visibly in a sandbox**

Production swaps these for:
- API-driven render over `GET /api/public/{slug}`
- React `ProInfoModal` (greenfield component), conditionally rendered, fired from `SquadRow`
- Real `fetch('/api/analytics/track', { keepalive: true })`
- **No `target` attribute** on any quick-action / WhatsApp link (native same-tab handoff — §2.3)
- Real media lightbox + checkout navigation

All markup, tap routing, spacing, the three demand states, the degraded-state logic, and the close behavior are identical between mockup and production.

---

## 9. Files

- `public_page_final.html` — interactive mockup (full page + working Pro Info modal)
- `public_page_final_UI_Spec.md` — this document

---

## 10. Design Philosophy

- **Public-facing = glanceable.** Whole money numbers, one-decimal ratings, compact trust row that never wraps.
- **One Instagram entry per row.** The avatar is the IG tap; the rest of the row opens the detail modal. Disambiguated, no competing tap zones.
- **Independent trust.** Google rating + estimated distribution + AI-summarised reviews give a stranger a credible second opinion beyond "Sara recommends this."
- **Lowest-friction contact.** WhatsApp is one tap from both the card (badge) and the modal. Demand signalling ("47 in 30d", pulse) creates social proof.
- **Native same-tab links.** `tel:`/`wa.me`/Maps must hand off to the iOS app; `target="_blank"` and `window.open` break that. Analytics ride on `keepalive`.
- **Honest estimates, labelled.** The distribution is a derived J-curve, not Google's real histogram (Google doesn't expose one); the AI summary is disclosed as Gemini-generated.
- **Ship the working interaction.** Swipe-to-dismiss was not worth repeatedly breaking a core surface under blind testing — standard Cancel/backdrop/Escape is reliable and shipped; the gesture is parked, not a launch blocker.
- **Fire-and-forget tracking.** `keepalive: true` so events survive tab-close / app-handoff. A dropped event is acceptable; the conversion still happens.
