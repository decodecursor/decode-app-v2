# Add Wish — UI Spec (Final, with Navigation + Triggers)

**File:** `add_wish_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/wishlist/new`
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Form for an ambassador to add a service as a "wish" — a gift their followers can see on the public page and purchase for them. Gift economy, not crowdfunding. Collects: service (category or custom), professional name, price.

---

## 2. Entry Points

| Source | Element |
|---|---|
| Dashboard | "Add Wish" button (secondary, dark with pink text) |
| Wishlist page | Top-right `+` button (same pattern as Listings page) |

---

## 3. Layout

1. ~~Status bar~~ — REMOVED
2. Back arrow (top-left, 32px circle, `history.back()`) — returns to Dashboard or Wishlist depending on entry
3. Hero: "Add wish" + subtitle "Service you want as a gift"
4. Service dropdown (shared with Add Listing categories)
5. Customize input (revealed when "Customize" selected)
6. Professional name input
7. **Professional location** — City + Country (side-by-side inputs, same pattern as Add Listing)
8. Price input with currency label
9. Create wish CTA

---

## 4. Shared Resources with Add Listing

### 4.1 Categories
- **Same endpoint** `/api/categories`
- **Same cache** `window.WLD_CATEGORIES` — if Add Listing already loaded categories in the session, reused here
- **Same fallback** list if endpoint fails
- **Custom category** saved as free-text on wish record (same monthly-review process as listings: manual query, promote high-frequency entries into categories table)

### 4.2 Currency
- **Pulled from `users.currency`** (locked, no per-wish override)
- Displayed as "USD ($)" / "AED (Ⓓ)" / etc. below the price input
- Price input placeholder = currency symbol

### 4.3 Minimum price
Same as Add Listing:

| Currency | Minimum |
|---|---|
| USD | 10 |
| EUR | 10 |
| GBP | 10 |
| AED | 50 |
| Other | 10 (fallback) |

Lazy validation on blur/Enter.

---

## 5. Create Wish Flow

| State | Trigger | Style |
|---|---|---|
| Disabled | Form invalid | Dark, grey text |
| Ready | Service + name + valid price | Pink, white text |
| Working | Tap | Pink "Creating…" |
| Success | After 900ms | Green "Wish created!" |

**On success:** redirect to `/wishlist` (URL includes `?new={wish_id}` for celebration toast — toast text defined in Wishlist spec, not here).

---

## 6. Data Persistence

- **No autosave, no draft** — same as Add Listing and onboarding
- Batch save on Create wish tap
- Form abandonment → lose data, restart from scratch

---

## 7. Navigation & Triggers (FULL MAP)

### 7.1 Inbound

| Source | Element |
|---|---|
| Dashboard | "Add Wish" button |
| Wishlist page | Top-right `+` button |

### 7.2 Outbound

| Element | Destination |
|---|---|
| Back arrow | Previous page (`history.back()`) |
| Service dropdown | In-page panel |
| Customize row | Reveals custom input |
| Create wish (success) | `/wishlist?new={wish_id}` |

### 7.3 Backend writes

| Action | Trigger |
|---|---|
| Create wish tap | INSERT new row into wishes table |
| Category custom | Stored as free-text on wish row |

---

## 8. Build Notes for Claude Code

### 8.1 Schema suggestion (Claude to decide final fit)

```sql
wishes:
  id, user_id,
  category_id NULL, custom_category TEXT NULL,  -- one or the other
  professional_name TEXT,
  professional_city TEXT,                        -- NEW: from city input
  professional_country TEXT,                     -- NEW: from country input (full name)
  price INT,
  currency CHAR(3),  -- snapshot of user's currency at creation (locked even if user changes currency later)
  status ENUM('open', 'fulfilled', 'deleted'),  -- open = visible on public page, fulfilled = someone bought it
  created_at TIMESTAMP,
  fulfilled_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
```

**Claude Code decides final schema** — this is a suggestion. Claude can also decide whether wishes live in their own table or share infrastructure with listings.

### 8.2 Currency locked at creation

Unlike listings (which pull live from `users.currency`), a wish should **snapshot the currency at creation** — if a follower is mid-checkout and the ambassador changes their currency, the wish price shouldn't change mid-flight.

### 8.3 Celebration toast

URL flag pattern: Create success redirects with `?new={id}`. Wishlist page detects this, shows celebration toast, strips param via `history.replaceState()`. **Toast text defined in Wishlist spec** (out of scope here).

### 8.4 Dead code check

All `onclick` handlers in the HTML map to defined functions:
- `cwToggleDrop` — opens/closes dropdown
- `cwSelectTreat` — picks a service
- `cwCapFirst` — auto-capitalizes inputs
- `cwCustomCheck` — validates custom service text
- `cwPriceInput`, `cwPriceFocus`, `cwPriceBlur` — price field handlers
- `cwValidate` — updates CTA state
- `cwCreate` — submit handler

---

## 9. Files

- `add_wish_final.html` — interactive mockup
- `add_wish_final_UI_Spec.md` — this document
