# Ambassador Dashboard — UI Spec (Final, with Navigation + Triggers)

**File:** `dashboard_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/dashboard/ambassador` (URL TBD — to be specified)
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Home screen after login. Three jobs:
1. Show ambassador how her page is performing (total views, top click categories)
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
2. Cover banner (110px) — user's cover photo + greeting + URL + 2 round action icons
3. Stats row: Total views (left, 108px) + Top clicks (right, flex, 3 animated bars)
4. Primary actions: Add Listing (pink) + Add Wish (dark, pink text)
5. Navigation cards: Listings · 1 expiring soon / Wishlist / Analytics / Settings

**No logout on this page.** Logout lives inside `/settings`.

---

## 5. Data Refresh Strategy

- **Fetch on page load** — fresh Supabase queries for all data
- **Pull-to-refresh supported** — native gesture re-runs all queries
- **No polling, no realtime, no app-level caching**
- Standard mobile dashboard pattern

---

## 6. Two Distinct Event Types

The system tracks two distinct interactions, both stored in the **single polymorphic `model_analytics_events` table**, distinguished by `event_type`:

| Event | Definition | event_type filter |
|---|---|---|
| **View** | Someone visits the public page `welovedecode.com/{slug}` | `event_type = 'public_page_view'` |
| **Click** | Someone taps a specific listing/link on the public page | `event_type IN ('listing_instagram_click','listing_media_click')` |

Left card = **Total views** (page traffic). Right card = **Top clicks** (engagement per category — categorisation flows through `target_id → model_listings.category_id → model_categories.label`, with `model_listings.category_custom` as the fallback bucket name when `category_id IS NULL`).

---

## 7. Stats Calculations

### 7.1 Total views (left card)
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

### 7.2 Top clicks (right card)

**Dynamic per user — no hardcoded categories.** Aggregated via the `get_top_click_categories(p_model_id, p_limit)` RPC, which JOINs through listings:

```sql
SELECT COALESCE(c.label, l.category_custom, 'Other') AS category,
       COUNT(*)::bigint AS clicks
FROM model_analytics_events e
JOIN model_listings l ON l.id = e.target_id
LEFT JOIN model_categories c ON c.id = l.category_id
WHERE e.model_id = $profile_id
  AND e.event_type IN ('listing_instagram_click','listing_media_click')
  AND e.target_id IS NOT NULL
GROUP BY 1
ORDER BY clicks DESC
LIMIT 3;
```

Bar fill %: `(category_clicks / max_category_clicks) * 100` — top category always 100%, others relative.

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
| Settings | `/settings` | Existing page (contains logout) |

### Layout details
- Icon ↔ label gap: **10px**
- Label: 14px / 600 white
- Alert: 11px / 400 pink, baseline-aligned with label
- Dot separator: 3×3 grey, optical-centered

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
| Page load | Fetch greeting flag, cover URL, slug, view counts, top click categories, expiring count |
| Page load (first ever visit) | Immediately set `users.first_dashboard_seen_at = NOW()` |
| Pull-to-refresh | Re-run all fetch queries |
| Copy icon tap | Frontend only (`navigator.clipboard.writeText`) |

---

## 14. Build Notes for Claude Code

### Supabase queries

```sql
-- Profile fields all live on model_profiles (NOT users)
SELECT id, slug, first_name, last_name, cover_photo_url,
       cover_photo_position_y, gifts_enabled, is_published, is_suspended,
       dashboard_first_seen_at
FROM model_profiles WHERE user_id = $auth_user_id;

-- First-visit flag (server-side, on page load)
UPDATE model_profiles SET dashboard_first_seen_at = NOW()
  WHERE id = $profile_id AND dashboard_first_seen_at IS NULL;

-- Total views
SELECT COUNT(*) FROM model_analytics_events
  WHERE model_id = $profile_id AND event_type = 'public_page_view';

-- This week (UTC)
SELECT COUNT(*) FROM model_analytics_events
  WHERE model_id = $profile_id
  AND event_type = 'public_page_view'
  AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC');

-- Top 3 click categories (via RPC — see §7.2)
SELECT * FROM get_top_click_categories($profile_id, 3);

-- Expiring-soon count (active/free-trial listings expiring within 7d)
SELECT COUNT(*) FROM model_listings
  WHERE model_id = $profile_id
  AND status IN ('active','free_trial')
  AND COALESCE(paid_until, free_trial_ends_at) < NOW() + INTERVAL '7 days';
```

### Removed / changed

- Status bar (time + battery) removed
- "Total clicks" → **"Total views"** (left card only; right stays "Top clicks")
- Bar height 1.5px → 2px
- Greeting toggle in mockup is preview-only — not in production

### Pull-to-refresh

Implement via standard mobile gesture — no custom JS needed if built as native or PWA. Web fallback: native browser pull-to-refresh.

---

## 15. Empty States

| Scenario | Behavior |
|---|---|
| First visit, 0 views | "Sara, you're live! 🎉" / Total views: 0 / "Share your page to get started" |
| 0 listings | Listings card shows just "Listings", no alert |
| No cover photo | Pink gradient fallback `linear-gradient(135deg, #e91e8c, #ff6b9d)` |
| Only 1–2 categories | Show 1–2 bar rows, card adjusts naturally |

---

## 16. Files

- `dashboard_final.html` — interactive mockup
- `dashboard_final_UI_Spec.md` — this document
