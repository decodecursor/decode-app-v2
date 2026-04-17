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
| `users.first_dashboard_seen_at IS NULL` | **"Sara, you're live! 🎉"** |
| `users.first_dashboard_seen_at IS NOT NULL` | **"Hello Sara"** |

**Flag write timing:** set `first_dashboard_seen_at = NOW()` **on page load** (immediately), so the celebration only ever shows once.

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

The system tracks two separate events:

| Event | Definition | Where |
|---|---|---|
| **View** | Someone visits the public page `welovedecode.com/{slug}` | `view_events` table |
| **Click** | Someone taps a specific listing/link on the public page | `click_events` table |

Left card = **Total views** (page traffic). Right card = **Top clicks** (engagement per category).

---

## 7. Stats Calculations

### 7.1 Total views (left card)
```sql
-- Total
SELECT COUNT(*) FROM view_events WHERE user_id = current_user;

-- This week (Mon–Sun, user's timezone)
SELECT COUNT(*) FROM view_events
  WHERE user_id = current_user
  AND created_at >= date_trunc('week', NOW() AT TIME ZONE user_tz);
```
Subtitle: "+N this week"

### 7.2 Top clicks (right card)

**Dynamic per user — no hardcoded categories.**

```sql
SELECT category, COUNT(*) as clicks FROM click_events
  WHERE user_id = current_user
  GROUP BY category ORDER BY clicks DESC LIMIT 3;
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
| Listings | `/listings` | Shows "1 expiring soon" alert when any listing's `expires_at < now() + 7 days` |
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
SELECT first_name, first_dashboard_seen_at, cover_photo_url, slug, timezone
FROM users WHERE id = current_user_id;

UPDATE users SET first_dashboard_seen_at = NOW()
  WHERE id = current_user_id AND first_dashboard_seen_at IS NULL;

SELECT COUNT(*) FROM view_events WHERE user_id = current_user_id;
SELECT COUNT(*) FROM view_events
  WHERE user_id = current_user_id
  AND created_at >= date_trunc('week', NOW() AT TIME ZONE user_tz);

SELECT category, COUNT(*) as clicks FROM click_events
  WHERE user_id = current_user_id
  GROUP BY category ORDER BY clicks DESC LIMIT 3;

SELECT COUNT(*) FROM listings
  WHERE user_id = current_user_id
  AND expires_at < NOW() + INTERVAL '7 days';
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
