# Add Listing — UI Spec (Final, with Navigation + Triggers)

**File:** `add_listing_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/listings/new`
**Access:** Authenticated ambassadors only

---

## 1. Purpose

Form to list a beauty professional on the ambassador's public page. Collects identity (name, photo, category, location, IG), media (1 video OR up to 3 photos), pricing (30/60/90 days), and an optional free-trial toggle.

---

## 2. Entry Points

| Source | Trigger |
|---|---|
| Dashboard | "Add Listing" button (pink primary) |
| Listings page | Top-right `+` button |

---

## 3. Layout

1. ~~Status bar~~ — REMOVED (real device handles)
2. Back arrow (top-left, 32px circle) — `history.back()` returns to previous page
3. Hero — `Add listing` + subtitle
4. Professional section — name, photo+category, city/country, Instagram
5. Media section — 1 video OR up to 3 photos
6. Pricing — 30/60/90 day boxes with pink "X% OFF" badges (currency from user profile)
7. Free 30-day trial toggle (collapses pricing when on)
8. Create listing CTA

---

## 4. Data Sources & Storage

### 4.1 Reference data (read)

| Field | Source | Notes |
|---|---|---|
| Categories list | **Categories endpoint — TBD, to be developed by Claude Code** | Suggested: `categories` Supabase table with `id, name, display_order, active`. Cached on `window.WLD_CATEGORIES`. |
| User currency | `users.currency` + `users.symbol` | Pulled on page load. **Locked — no per-listing override.** |

### 4.2 File uploads — Supabase Storage

| File | Bucket | Upload timing |
|---|---|---|
| Profile photo (cropped) | **Bucket name TBD by Claude** (suggested: `profile-photos`) | **Immediately after crop** (small files, fast upload, instant preview confidence) |
| Media (video/photos) | **Bucket name TBD by Claude** (suggested: `listing-media`) | **Batched on Create listing tap** (videos can be large; show progress at submit) |

### 4.3 Form data persistence

- **No autosave, no draft** — same model as onboarding
- If user leaves the page, all entered data is lost (session-only state)
- Batch save on Create listing tap

### 4.5 Video transcoding — REQUIRED for production

**Problem:** iPhones default to recording in HEVC (H.265) codec. Firefox and older Android browsers **cannot decode HEVC**. Without transcoding, ~30% of uploaded videos will fail to play for visitors.

**Required behavior:**

1. User uploads video (any codec) → file lands in `listing-media` bucket
2. **Server-side transcoding job triggers automatically** (via Supabase Edge Function, webhook, or queue worker)
3. Job converts to **H.264 MP4** with AAC audio (universally supported)
4. Original file replaced or marked obsolete; transcoded file URL stored in `listings.media_urls`
5. Public page only ever serves the transcoded H.264 version

**Recommended services (pick one):**

| Service | Cost | Best for |
|---|---|---|
| **Cloudflare Stream** | ~$5 per 1000 min stored | Easiest — handles transcoding + delivery + adaptive bitrate + player |
| **Mux** | More expensive | Professional video tooling |
| **Self-hosted FFmpeg worker** | Cheapest | Most setup work |

**Recommendation:** Cloudflare Stream — minimum integration, handles everything end-to-end, includes a fast global CDN.

**Frontend behavior during transcoding:**
- Show a "Processing video…" state on the listing for the first ~30 seconds after upload
- Once transcoded webhook confirms ready, swap to the playable URL
- Listing remains in `pending_payment` or `active_trial` status during processing — content just isn't playable yet

**This is a hard requirement, not optional.** A platform that loses 30% of video plays in Firefox is broken in production.

---

### 4.4 Custom category handling

When user picks "Customize" and enters a free-text category:
- **Saved as free-text on this listing only** (not added to global categories table)
- Stored in a dedicated column (e.g. `listings.custom_category`) for monthly review
- **Monthly review process:** ambassador team checks frequently-used custom categories and promotes them into the official `categories` table

---

## 5. Color & Typography

(Unchanged from previous spec — pink accents, green for success only, sentence case CTAs.)

---

## 6. Pricing Section

- 3 boxes: 30 / 60 / 90 days
- Currency label pulled from `users.currency` (read-only)
- Pink "X% OFF" badges on 60-day and 90-day when discounted
- Hidden when free-trial toggle is ON

### 6.1 Minimum price per box

| Currency | Minimum |
|---|---|
| USD | 10 |
| EUR | 10 |
| GBP | 10 |
| AED | 50 |
| Other | 10 (fallback) |

Approximate USD-equivalent floors, rounded to clean whole numbers (no decimals).

### 6.2 Validation rules + lazy triggering

- 30 < 60 < 90 (ordering)
- Each box >= currency minimum
- **Lazy trigger:** validation runs on `blur` or `Enter` key — never while typing
- Pink border on violating box (matches brand attention color)
- Error line below pricing, 11px pink, centered:
  - "Minimum {symbol}{X}" (e.g. "Minimum AED 50")
  - "60-day price must be higher than 30-day"
  - "90-day price must be higher than 60-day"
- On Create listing tap: validation re-runs even on never-blurred fields (catches users who typed and immediately submitted)

---

## 7. Free 30-day Trial Toggle

When ON, three coordinated 300ms animations:
1. Toggle knob slides + track turns pink
2. Trial row border turns pink
3. Pricing section collapses (max-height + opacity + margin)

---

## 8. Create Listing Button

| State | Trigger | Style |
|---|---|---|
| Disabled | Form invalid | Dark, grey text |
| Ready | All required fields valid | Pink, white text |
| Success (paid) | Tap → Supabase save | Green flash → redirect |
| Success (trial) | Tap → Supabase save | Green flash → redirect |

---

## 9. Submit Behavior — Routing

| Path | Listing status set | Redirect destination |
|---|---|---|
| **Paid** | `pending_payment` (not yet visible on public page) | **Send Payment Link page** (URL TBD) |
| **Free trial** | `active_trial` (already live on public page) | **Listings page** (`/listings`) |

**Why this routing:**
- Paid users' next action is "send the payment link to the professional" → take them straight there
- Trial users' next action is "see my new listing in context" → take them to listings index

---

## 10. Navigation & Triggers (FULL MAP)

### 10.1 Inbound

| Source | Element |
|---|---|
| Dashboard | "Add Listing" button |
| Listings page | Top-right `+` button |

### 10.2 Outbound

| Element | Destination | Tab |
|---|---|---|
| Back arrow | Previous page (`history.back()`) | Same |
| Profile photo tap | Cropper modal (in-page) | — |
| Category dropdown | In-page panel | — |
| Customize row | Reveals secondary input | — |
| Media uploader | Native file picker | — |
| Create listing (paid success) | Send Payment Link page (URL TBD) | Same |
| Create listing (trial success) | `/listings` | Same |

### 10.3 Backend writes

| Action | Trigger |
|---|---|
| Profile photo crop confirmed | Upload to Supabase Storage → store URL in form state |
| Create listing tap | Batch upload media files + INSERT into `listings` table |
| Listing created (paid) | Set `status = 'pending_payment'` |
| Listing created (trial) | Set `status = 'active_trial'`, `trial_ends_at = NOW() + 30 days` |

---

## 11. Build Notes for Claude Code

### 11.1 To be developed

- **Categories endpoint** — Supabase table or REST endpoint, cached client-side
- **Supabase Storage buckets** — `profile-photos` (recommended) + `listing-media` (recommended). Claude to confirm naming.
- **Send Payment Link page URL** — TBD

### 11.2 Form state (session-only, no persistence)

```js
{
  name, profile_photo_url, category_id | custom_category,
  city, country, instagram_handle,
  media: { type: 'video' | 'photo', urls: [] },
  pricing: { p30, p60, p90 },
  free_trial: bool
}
```

### 11.3 Listings table (suggested schema)

```sql
listings:
  id, user_id, name, profile_photo_url,
  category_id NULL, custom_category TEXT NULL,  -- one or the other
  city, country, instagram_handle,
  media_type ENUM('video','photo'),
  media_urls TEXT[],
  price_30, price_60, price_90 INT NULL,        -- NULL if trial
  is_free_trial BOOL,
  status ENUM('pending_payment','active_trial','active_paid','expired'),
  trial_ends_at TIMESTAMP NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
```

### 11.4 Monthly custom-category review

- Cron/admin job: `SELECT custom_category, COUNT(*) FROM listings WHERE custom_category IS NOT NULL GROUP BY custom_category ORDER BY count DESC;`
- Team reviews and promotes high-frequency entries into `categories` table

---

## 12. Files

- `add_listing_final.html` — interactive mockup (back arrow added, status bar removed)
- `add_listing_final_UI_Spec.md` — this document
