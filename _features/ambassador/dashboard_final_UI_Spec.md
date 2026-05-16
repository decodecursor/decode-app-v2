# Ambassador Dashboard — UI Spec (Final, with Navigation + Triggers)

**File:** `dashboard_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/dashboard/ambassador` (URL TBD — to be specified)
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Home screen after login. Three jobs:
1. Show ambassador how her page is performing (page visits, top listings by clicks)
2. Let her take the two most common actions (add listing, add wish)
3. Navigate to the four deeper surfaces (listings, wishlist, analytics, settings)

---

## 2. Entry Points

| Source | Condition | Result |
|---|---|---|
| Onboarding "You're live!" | After registration complete | Redirect with first-visit greeting |
| WhatsApp verify success | `is_registered: true` | Direct redirect |
| Magic link click (in email) | `is_registered: true` | New tab → dashboard |
| App launch | Session valid | Direct landing |

---

## 3. Greeting Logic

| Condition | Greeting |
|---|---|
| `model_profiles.dashboard_first_seen_at IS NULL` | **"Sara, you're live! 🎉"** |
| `model_profiles.dashboard_first_seen_at IS NOT NULL` | **"Hello Sara"** |

**Flag write timing:** set `dashboard_first_seen_at = NOW()` **on page load** (immediately, server-side), so the celebration only ever shows once. Compute the greeting decision *before* the write so the first-visit copy still renders on that initial load.

> Schema note: ambassador profile fields live on `model_profiles`, not `users`. The flag column is `dashboard_first_seen_at` (not `first_dashboard_seen_at`).

---

## 4. Layout

1. ~~Status bar~~ — REMOVED (real device handles)
2. Cover banner (140px) — user's cover photo + greeting + URL + 2 round action icons (post-`ccd5a52` polish, 2026-04-27 — bumped from 110px, softer 3-stop gradient, tighter heading-URL gap)
3. Stats row: Page visits (left, 108px) + Top listings (right, flex, up to 3 animated per-listing bars)
4. Primary actions: Add Listing (pink) + Add Wish (dark, pink text)
5. Navigation cards: Listings · 1 expiring soon / Wishlist / Analytics / Settings (optional hint — see §12.1)

**No logout on this page.** Logout lives inside `/settings`.

---

## 5. Data Refresh Strategy

- **Fetch on page load** — fresh Supabase queries for all data
- **Pull-to-refresh supported** — native gesture re-runs all queries
- **No polling, no realtime, no app-level caching**
- Standard mobile dashboard pattern

---

## 6. Two Distinct Event Types

The system tracks two distinct interactions, both stored in the **single polymorphic `model_analytics_events` table**, distinguished by `event_type`. The full CHECK enum (12 values post-Trust-Stack + ambassador IG button) is canonical in `public_page_final_UI_Spec.md` §2.5 / §5.1 — this dashboard surface only consumes a subset:

| Event | Definition | event_type filter |
|---|---|---|
| **View** | Someone visits the public page `welovedecode.com/{slug}` | `event_type = 'public_page_view'` |
| **Click** (Top listings aggregation) | Someone taps an Instagram link, a media orb, or swipes the squad-media lightbox on a listing | `event_type IN ('listing_instagram_click','listing_media_click','squad_media_swipe_view')` |

Left card = **Page visits** (page traffic). Right card = **Top listings** (per-listing engagement — each row identifies a specific listing by `category · professional_name`, with `clicks` bar derived from the click-event filter above). Per-listing rows replaced the earlier per-category aggregation in commit `a4d6b31` (Slice 6A pattern alignment).

> **⚠ KNOWN GAP — Top Listings undercounts post-Trust-Stack engagement.** The click filter intentionally excludes the three Trust Stack high-intent events (`listing_modal_open`, `listing_whatsapp_badge_click`, `listing_whatsapp_modal_click`). A follower can open the Pro Info detail modal and message the salon on WhatsApp without ever firing `listing_instagram_click` / `listing_media_click` — so the bar values systematically under-represent real listing engagement. Tracked as a backlog item (own slice: DB migration + behavior change; equal-weight for V1 with weighting deferred). **Not yet changed in the dashboard query or in the legacy `get_top_click_categories` RPC** — see PROJECT_STATE hardening backlog.

---

## 7. Stats Calculations

### 7.1 Page visits (left card)
```sql
-- Total
SELECT COUNT(*) FROM model_analytics_events
  WHERE model_id = $profile_id
  AND event_type = 'public_page_view';

-- This week (ISO Mon-start, UTC — see timezone note below)
SELECT COUNT(*) FROM model_analytics_events
  WHERE model_id = $profile_id
  AND event_type = 'public_page_view'
  AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC');
```
Subtitle: "+N this week" (when total > 0). When total = 0, replace with "Share your page to get started" (see §15).

> Timezone note: there is no `users.timezone` column, so the week boundary is computed in UTC. Acceptable for v1; revisit if ambassadors in extreme timezones report wrong "this week" counts.

### 7.2 Top listings (right card)

**Per-listing rows, dynamic per user — no hardcoded categories.** Each row identifies a specific listing as `{category} · {professional_name}` with a right-aligned click count and an animated bar.

**Live implementation (current):** server-rendered via a direct supabase-js query in `app/(ambassador)/model/page.tsx`. Two parallel queries (listing metadata + click events) followed by a JS aggregation — pattern mirrors the Slice 6A `analytics-aggregate` per-listing approach (Principle E), shipped in commit `a4d6b31`. Pseudocode:

```sql
-- 1. Listing metadata (with category label + professional name via FK joins)
SELECT id, created_at, category_custom,
       category:model_categories(label),
       professional:model_professionals(name)
FROM model_listings
WHERE model_id = $profile_id;

-- 2. Click events for this ambassador (any listing)
SELECT target_id FROM model_analytics_events
WHERE model_id = $profile_id
  AND event_type IN ('listing_instagram_click','listing_media_click','squad_media_swipe_view')
  AND target_id IS NOT NULL;

-- 3. JS-side: COUNT(target_id) per listing, JOIN to metadata,
--    filter clicks > 0, sort clicks DESC then created_at DESC (tiebreak), LIMIT 3.
```

Row shape: `{ listing_id, category, professional_name, clicks }`. Category falls back through `model_categories.label → model_listings.category_custom → 'Other'`.

Bar fill %: `(row.clicks / max(clicks)) * 100` — top listing always 100%, others relative.

> **⚠ Legacy RPC retained but unused.** `public.get_top_click_categories(p_model_id, p_limit)` still exists in the live database with this verbatim filter — `event_type IN ('listing_instagram_click','listing_media_click')` (only two values; no `squad_media_swipe_view`, no Trust Stack events) — and produces per-category rows. It has **zero callers in the repo** post-`a4d6b31` and is logged for deletion in a post-V1 hygiene slice (PROJECT_STATE hardening backlog). Documented here so the discrepancy between RPC filter (2 values, per-category) and the live dashboard query (3 values, per-listing) does not cause confusion.

> **⚠ KNOWN GAP (same as §6).** The live dashboard query's click filter excludes `listing_modal_open`, `listing_whatsapp_badge_click`, and `listing_whatsapp_modal_click`, so Trust Stack-driven engagement (modal opens + WhatsApp messages) is invisible to this ranking. Tracked, not yet changed — see PROJECT_STATE hardening backlog.

---

## 8. Bar Animation

Two-layer `background-image` with animated `background-size`. Pink fill grows from 0% to target% over 1500ms with `cubic-bezier(.2,.7,.2,1)` easing.

**Bar height: 2px** (whole pixel — avoids sub-pixel rendering inconsistency).

---

## 9. Cover Photo Handling

- `<img src="{users.cover_photo_url}">` from Supabase Storage
- **Browser HTTP cache handles caching** — no custom JS needed
- New uploads change the URL (new filename/version), so cache invalidates automatically
- Add a dark gradient background as placeholder so cover area never flashes empty

---

## 10. Cover Banner Actions

| Element | Action | Result |
|---|---|---|
| URL text | Tap | Open `welovedecode.com/{slug}` in **same tab** |
| View page icon | Tap | Open `welovedecode.com/{slug}` in **same tab** |
| Copy icon | Tap | Clipboard write + green checkmark icon + green "Copied!" label above button (no border/bg) — both effects sync at 1500ms |

Same-tab navigation chosen for better mobile back-button UX.

---

## 11. Primary Actions

| Button | Style | Destination | Type |
|---|---|---|---|
| Add Listing | Pink filled, white text | `/listings/new` | New page |
| Add Wish | Dark, pink text | `/wishlist/new` | New page |

---

## 12. Navigation Cards

All open as new pages (not modals).

| Card | Destination | Notes |
|---|---|---|
| Listings | `/listings` | Shows "N expiring soon" alert when any active/free-trial listing's `COALESCE(paid_until, free_trial_ends_at) < now() + 7 days` |
| Wishlist | `/wishlist` | — |
| Analytics | `/analytics` | Existing page |
| Settings | `/settings` | Existing page (contains logout). May show a missing-data hint (see §12.1) |

### Layout details
- Icon ↔ label gap: **10px**
- Label: 14px / 600 white
- Alert: 11px / 400 pink, baseline-aligned with label
- Dot separator: 3×3 grey, optical-centered

### 12.1 Settings nav-card hint (Slice 8)

The Settings nav card carries a single-line **pink hint** when the ambassador is missing payout-side or identity-side data the platform needs for V1. Hint and alert share the same `11px / 400 #e91e8c` styling as the Listings-card "N expiring soon" alert — baseline-aligned with the label, dot-separated.

**Stacking priority (bank > email, both missing collapses to a single label):**

| Bank state | Email state | Hint |
|---|---|---|
| Missing | Missing | "Bank + Email missing" |
| Missing | Present | "Bank missing" |
| Present | Missing | "Email missing" |
| Present | Present | (no hint) |

**Derivation (server-side, page load):** computed in `app/(ambassador)/model/page.tsx` and passed as `settingsHint` prop to `DashboardClient`.

- `bankMissing` — `EXISTS` probe on `user_bank_accounts WHERE user_id = $auth_user_id AND is_primary = true` (HEAD count query). Slice 8 locked Q2=A pattern: no schema column, no maintenance trigger — derived at server-render time.
- `emailMissing` — `!user.email || isInternalEmail(user.email)`. Internal-email check filters synthetic/legacy `@welovedecode.internal` addresses created by the Slice 1 phantom-cleanup path; those count as "no real email" for hint purposes.

Returned hint values: `'Bank + Email missing' | 'Bank missing' | 'Email missing' | null`.

**Rendering:** when `settingsHint !== null`, render the hint after a dot separator on the Settings nav card row, identically to the Listings card's expiring-soon alert pattern.

---

## 13. Navigation & Triggers (FULL MAP)

### Inbound

| Source | Result |
|---|---|
| Onboarding Go live | Redirect with first-visit greeting |
| WhatsApp verify (returning user) | Direct land, returning greeting |
| Magic link (returning user) | New tab → returning greeting |
| App launch (session valid) | Direct land |

### Outbound

| Element | Destination | Tab |
|---|---|---|
| URL text | `welovedecode.com/{slug}` | Same |
| View page icon | `welovedecode.com/{slug}` | Same |
| Copy icon | Clipboard only | — |
| Add Listing | `/listings/new` | Same |
| Add Wish | `/wishlist/new` | Same |
| Listings card | `/listings` | Same |
| Wishlist card | `/wishlist` | Same |
| Analytics card | `/analytics` | Same |
| Settings card | `/settings` | Same |

### Backend writes

| Action | Trigger |
|---|---|
| Page load | Fetch greeting flag, cover URL, slug, view counts, top per-listing clicks, expiring count, settings-hint sources (bank/email) |
| Page load (first ever visit) | Immediately set `model_profiles.dashboard_first_seen_at = NOW()` (see §3 / §14 — column lives on `model_profiles`, NOT `users`) |
| Pull-to-refresh | Re-run all fetch queries |
| Copy icon tap | Frontend only (`navigator.clipboard.writeText`) |

---

## 14. Build Notes for Claude Code

### Supabase queries

```sql
-- Profile fields all live on model_profiles (NOT users).
-- cover_photo_position_y controls vertical framing of the cover image
-- (passed to DashboardClient and applied as background-position-y).
SELECT id, slug, first_name, last_name, cover_photo_url,
       cover_photo_position_y, gifts_enabled, is_published, is_suspended,
       dashboard_first_seen_at
FROM model_profiles WHERE user_id = $auth_user_id;

-- First-visit flag (server-side, on page load)
UPDATE model_profiles SET dashboard_first_seen_at = NOW()
  WHERE id = $profile_id AND dashboard_first_seen_at IS NULL;

-- Page visits
SELECT COUNT(*) FROM model_analytics_events
  WHERE model_id = $profile_id AND event_type = 'public_page_view';

-- This week (UTC)
SELECT COUNT(*) FROM model_analytics_events
  WHERE model_id = $profile_id
  AND event_type = 'public_page_view'
  AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC');

-- Top listings (direct query — see §7.2 for full shape)
-- NOTE: the legacy get_top_click_categories RPC is dead code post-a4d6b31;
-- it still exists in the DB (filter: 'listing_instagram_click','listing_media_click')
-- but is not called by the dashboard. Drop in post-V1 hygiene slice.
SELECT id, created_at, category_custom,
       category:model_categories(label),
       professional:model_professionals(name)
FROM model_listings WHERE model_id = $profile_id;

SELECT target_id FROM model_analytics_events
  WHERE model_id = $profile_id
  AND event_type IN ('listing_instagram_click','listing_media_click','squad_media_swipe_view')
  AND target_id IS NOT NULL;
-- JS aggregate: count per target_id → JOIN to metadata → clicks > 0 → sort
-- clicks DESC, created_at DESC tiebreak → LIMIT 3.

-- Expiring-soon count (active/free-trial listings expiring within 7d)
SELECT COUNT(*) FROM model_listings
  WHERE model_id = $profile_id
  AND status IN ('active','free_trial')
  AND COALESCE(paid_until, free_trial_ends_at) < NOW() + INTERVAL '7 days';
```

### Removed / changed

- Status bar (time + battery) removed
- "Total clicks" → **"Total views"** (left card only; right stays "Top clicks")
- "Total views" → **"Page visits"** (left); "Top clicks" → **"Top listings"** (right) — per partner decision 2026-04-29
- Bar height 1.5px → 2px
- Greeting toggle in mockup is preview-only — not in production

### Pull-to-refresh

Implement via standard mobile gesture — no custom JS needed if built as native or PWA. Web fallback: native browser pull-to-refresh.

---

## 15. Empty States

| Scenario | Behavior |
|---|---|
| First visit, 0 views | "Sara, you're live! 🎉" / Page visits: 0 / "Share your page to get started" |
| 0 listings | Listings card shows just "Listings", no alert |
| No cover photo | Pink gradient fallback `linear-gradient(135deg, #e91e8c, #ff6b9d)` |
| Only 1–2 categories | Show 1–2 bar rows, card adjusts naturally |

---

## 16. Files

- `dashboard_final.html` — interactive mockup
- `dashboard_final_UI_Spec.md` — this document

**Cross-references:**

- `public_page_final_UI_Spec.md` — canonical for the public ambassador page, including the full `model_analytics_events.event_type` enum, the Pro Info modal (introduced by the Trust Stack slice, final state commit `24a6505`), the ambassador IG button, and native same-tab link rationale. The dashboard never restates Pro Info modal styling — defer to that doc.
- `DECODE_PROJECT_STATE.md` — canonical schema (Table 8 `model_analytics_events` post-Trust-Stack enum) and the hardening backlog item that tracks the Top-listings Trust-Stack-events gap (§6 / §7.2 callouts above).
