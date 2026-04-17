# Wishlist Page — UI Spec (Final, with Navigation + Triggers)

**File:** `wishlist_incl_wish_delete_modal_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/wishlist`
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Index of the ambassador's wishes — services she wants as gifts from followers. Followers can pay (via Stripe) to gift a wish; funds go to the platform, which pays the ambassador directly. Ambassador then books + pays the professional outside the system.

---

## 2. Entry Points

| Source | Element |
|---|---|
| Dashboard | "Wishlist" nav card |
| Add Wish success | Auto-redirect with `?created={id}` triggers celebration toast |
| Post-gift notification | Email/push deep-link into `/wishlist` |
| Browser back from Add Wish | Native gesture |

---

## 3. Layout

1. ~~Status bar~~ — REMOVED
2. Header: back arrow (→ Dashboard) + "Wishlist" + `+` button (→ Add Wish)
3. Filter tabs: All / Open / Gifted
4. Celebration toast (only on `?created=...` arrival)
5. Wish cards (load all, client-side filtered)
6. Empty state when 0 wishes

---

## 4. Filter Tabs — Client-Side

All wishes loaded once on mount. Tabs hide/show existing data.

| Tap | Show |
|---|---|
| All | all wishes |
| Open | `status === 'open'` |
| Gifted | `status === 'gifted'` |

---

## 5. Wish Card Interactions

| Element | Action |
|---|---|
| Card body | No action |
| Share icon | Opens WhatsApp (`https://wa.me/?text={encoded}`) → ambassador picks contact → message pre-filled: **"Looking for a gift idea for me? I've got a beauty wish ready 🎁 https://welovedecode.com/wish/{id}/checkout"**. Mobile opens WhatsApp app; desktop opens WhatsApp web. No phone number stored — ambassador uses WhatsApp's own contact picker (same pattern as Send Payment Link) |
| Delete icon (open) | Open "Remove wish?" modal |
| Delete icon (gifted) | **Not shown** — gifted wishes cannot be deleted |
| Gifter name tap | Opens `https://instagram.com/{handle}` (same tab; mobile OS auto-launches Instagram app if installed). Only when `anonymous=false` and `instagram_handle` present |

---

## 6. Delete Wish

- Only for `status='open'` wishes
- Modal: "Remove wish?" — Keep (dark) / Remove (pink)
- Soft delete: `UPDATE wishes SET status='deleted', deleted_at=NOW()`
- Removed from public page + all queries immediately

---

## 7. Celebration Toast

Fires once on arrival with `?created={wishId}`.

- **Title:** "Wish is live"
- **Subline:** "Ready to be gifted"
- **Emoji:** 🎉
- **Position:** `top: 65px`
- **Style:** identical to Listings celebration. Position `top: 65px`, shadow `0 4px 8px rgba(0,0,0,0.6)`, padding 14px, 1200ms fade in + 1200ms fade out with 5000ms hold. See Listings spec §7.5.6/7.5.7 for full details.
- URL param stripped via `history.replaceState()` after firing

---

## 8. Gift Payment Flow

1. Follower on public page `/wish/{id}` → clicks wish
2. Stripe checkout (can choose "Gift anonymously")
3. Payment goes to **platform Stripe account**
4. Platform pays the **ambassador** (via Stripe Connect or manual payout)
5. Ambassador books + pays professional outside the system
6. Stripe webhook flips wish: `status='open'` → `'gifted'`, INSERT into `gifts` table
7. Ambassador notified (email + WhatsApp via AUTHKey)

---

## 9. Gifter Display

| Condition | Display |
|---|---|
| `anonymous=true` | "Anonymous" + grey icon, no IG link |
| `anonymous=false` + IG | Real name + pink icon, clickable → opens Instagram |
| `anonymous=false` + no IG | Real name + pink icon, no click |

---

## 10. Navigation & Triggers (FULL MAP)

### 10.1 Inbound

| Source | Element |
|---|---|
| Dashboard | "Wishlist" nav card |
| Add Wish | Success redirect with `?created={id}` |
| Gift notification | Deep link from email/push |

### 10.2 Outbound

| Element | Destination | Tab |
|---|---|---|
| Back arrow | Dashboard | Same |
| `+` button | `/wishlist/new` | Same |
| Share icon | WhatsApp with pre-filled message + checkout URL | WhatsApp app/web |
| Delete (open wish) | Modal | — |
| Gifter IG tap | `https://instagram.com/{handle}` | Same (OS deep-link to IG app) |
| Empty state CTA | `/wishlist/new` | Same |
| Modal Keep/Remove | Close / soft delete + close | — |

### 10.3 Backend writes

| Action | Trigger |
|---|---|
| Page load | `SELECT * FROM wishes WHERE user_id=? AND status!='deleted' ORDER BY created_at DESC` |
| Filter change | Client-side only |
| Pull-to-refresh | Re-run page-load query |
| Remove confirm | `UPDATE wishes SET status='deleted', deleted_at=NOW()` |
| Gift purchased (Stripe webhook) | `UPDATE wishes SET status='gifted', gifted_at=NOW()` + INSERT `gifts` |

---

## 11. Build Notes for Claude Code

### 11.1 Suggested schema (Claude decides final fit)

```sql
wishes:
  id, user_id,
  category_id NULL, custom_category TEXT NULL,
  professional_name TEXT,
  price INT, currency CHAR(3),  -- snapshot at creation
  status ENUM('open','gifted','deleted'),
  created_at, gifted_at NULL, deleted_at NULL

gifts:
  id, wish_id,
  gifter_user_id NULL,       -- NULL = guest checkout
  anonymous BOOL,
  gifter_name TEXT,
  instagram_handle TEXT NULL,
  stripe_payment_id TEXT,
  amount_paid INT, currency CHAR(3),
  created_at
```

### 11.2 Payment architecture
- Stripe funds → platform account
- Platform → ambassador (via Stripe Connect or manual payout — Claude Code decides)
- Ambassador → professional (outside system, not tracked)

### 11.3 Public wish page (separate build)
- Route: `/wish/{id}` — server-rendered with OG meta for rich link previews
- Stripe checkout embedded on page
- Returns 404 for `gifted` or `deleted` wishes

### 11.4 Pull-to-refresh
Standard mobile gesture — re-runs page-load query.

---

## 12. Empty State

- Copy: "No wishes yet. Add your first beauty wish to show data here."
- CTA: "Add beauty wish" → `/wishlist/new`

---

## 13. Files

- `wishlist_incl_wish_delete_modal_final.html` — interactive mockup with delete modal
- `wishlist_incl_wish_delete_modal_final_UI_Spec.md` — this document
