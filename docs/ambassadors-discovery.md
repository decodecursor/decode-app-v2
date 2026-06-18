# "Other Ambassadors" — Discovery (read-only recon)

> Goal: a small badge on each public listing card that opens a modal listing the **other
> ambassadors who feature the same pro**. This doc is reconnaissance only — no code or DB
> was changed. Schema introspected live via Supabase MCP on 2026-06-18.

---

## TL;DR

- **Ambassador** = `model_profiles`. **Pro** = `model_professionals`. **Endorsement spine** =
  `model_listings` (`model_id → model_profiles.id`, `professional_id → model_professionals.id`).
- "Pro X is endorsed by ambassador A" **== A has a live `model_listings` row pointing at X.**
  Confirmed. "Live" = `effective_status IN ('active','free_trial')` (use the
  `model_listings_live` view, not the raw `status` column).
- The ambassador's **Instagram handle lives on `users.instagram_handle`** (not on
  `model_profiles`), joined via `model_profiles.user_id`.
- **There is no usable ambassador profile-photo.** `users.profile_photo_url` is **NULL for all 8
  ambassadors**, and `model_profiles` has no avatar field — only `cover_photo_url` (populated for
  all 8). Use `cover_photo_url` as the row avatar.
- ⚠️ **With today's production data the modal is empty for every pro** — every professional has
  exactly **one** live ambassador. The badge must be count-gated.
- The public page fetches **server-side with the service-role client** (RLS bypassed), so RLS is
  not a blocker if the feature is fetched the same way. RLS also permits anon reads if done client-side.

---

## 1. Database

### a) Ambassador / public-profile table — `model_profiles` (8 rows)

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | **FK → users** (`model_profiles_user_id_fkey`), unique |
| slug | text NOT NULL | **URL slug**, unique, indexed (`idx_model_profiles_slug`) |
| first_name | text NOT NULL | |
| last_name | text NOT NULL | |
| cover_photo_url | text | **only photo on this table** (no avatar/profile field) |
| cover_photo_position_y | int | |
| currency | text | |
| tagline | text | |
| gifts_enabled | bool | |
| **is_published** | bool (def true) | visibility flag |
| **is_suspended** | bool (def false) | visibility flag |
| created_at / updated_at | timestamptz | |

- URL slug ✓ (`slug`), first/last name ✓, published/visibility flag ✓ (`is_published` +
  `is_suspended`).
- **Profile photo ✗ on this table.** **Instagram handle ✗ on this table** → it is on `users`.

### b) Professionals table — `model_professionals` (32 rows)

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | ✓ |
| city / country | text NOT NULL | ✓ |
| instagram_handle | text NOT NULL | the **pro's** IG, unique, indexed |
| avatar_photo_url | text NOT NULL | ✓ pro photo |
| whatsapp_number | text | ✓ (nullable) |
| google_place_id | text | |
| google_places_cache | jsonb | **rating + review_count live here** (`rating`, `userRatingCount`) |
| google_places_cached_at | timestamptz | |
| review_summary_gemini / _custom / _generated_at | text/ts | AI summary for Pro Info modal |
| claimed_by_user_id / claimed_at | uuid/ts | |
| created_by | uuid | FK → users |

- name/city/country/photo/whatsapp ✓.
- **category ✗ here** — category is per-listing (`model_listings.category_id → model_categories`).
- **rating + review-count are NOT columns** — derived from `google_places_cache` JSONB
  (`rating`, `userRatingCount`). The page projection surfaces them as `rating` / `review_count`.
- **No video field here.** Video lives on `model_listings`.

### c) Endorsement relationship — `model_listings` (15 rows)

- Links ambassador → pro. FKs confirmed:
  - `model_id → model_profiles.id` (`model_listings_model_id_fkey`)
  - `professional_id → model_professionals.id` (`model_listings_professional_id_fkey`)
  - `category_id → model_categories.id`
- **"Active / live / visible" flag:** `status`. Distinct values seen:
  `active` (5), `free_trial` (6), `expired` (2), `pending_payment` (2).
- **Canonical live filter = `effective_status IN ('active','free_trial')`** via the
  **`model_listings_live` view** — `effective_status` also demotes date-expired rows
  (`paid_until` / `free_trial_ends_at` past) even before the background expiry job runs. Prefer
  this over raw `status`.
- **Assumption confirmed:** "pro X is endorsed by ambassador A" == "A has a live `model_listings`
  row pointing at X." Exactly how it works.

### d) Video/media on the card

- From **`model_listings`**: `media_type` (`video`|`photos`), `video_url`,
  `video_thumbnail_url`, `photo_url_1..3`. **Not** on the pro. (Card video = `MediaOrb` — do not touch.)

### e) RLS for anonymous/public read

| table | RLS | anon SELECT policy |
|---|---|---|
| model_profiles | on | `Public read published non-suspended profiles` → `is_published AND NOT is_suspended` |
| model_professionals | on | `Public read professionals` → `true` (all readable) |
| model_listings | on | `Public read active listings` → `status IN ('active','free_trial') AND model_id's profile published & not suspended` |
| model_categories | on | `Public read active categories` → `is_active` |
| **users** | **OFF** | RLS disabled → fully readable; also has `Users can view public profiles` qual `true` |

- ✅ A logged-out visitor **can** read everything this feature needs (ambassador rows, IG handle
  on `users`, cover photo).
- ⚠️ **Security note (pre-existing, surfaced by advisor):** `public.users` and
  `public.payment_links` have **RLS disabled** — fully exposed to the anon key. Not caused by this
  feature, but relevant because we read `users.instagram_handle` publicly. Flag to owner; do not
  auto-remediate.
- Note: the public page currently fetches via **service-role client** (`createServiceRoleClient()`),
  which bypasses RLS entirely — so RLS only matters if this feature is done client-side instead.

---

## 2. Core query (drafted against the real schema)

"Given a professional and the current ambassador's page, return the OTHER live ambassadors for
that pro — name, slug, IG handle, avatar — plus total count."

### SQL
```sql
SELECT
  mp.id,
  mp.slug,
  mp.first_name,
  mp.last_name,
  u.instagram_handle,           -- ambassador IG is on users, NOT model_profiles
  mp.cover_photo_url            -- only usable avatar (users.profile_photo_url is all NULL)
FROM model_listings ml
JOIN model_profiles mp ON mp.id = ml.model_id
JOIN users          u  ON u.id  = mp.user_id
WHERE ml.professional_id = :professional_id
  AND ml.status IN ('active','free_trial')   -- or effective_status via the live view
  AND mp.is_published = true
  AND mp.is_suspended = false
  AND mp.id <> :current_model_profile_id      -- exclude the ambassador whose page we're on
ORDER BY mp.first_name;
-- total count = same WHERE with COUNT(*)
```

### Supabase client (PostgREST, mirrors existing page style)
```ts
// Prefer the live view so effective_status is honored.
const { data, count } = await supabase
  .from('model_listings_live')
  .select(
    `model_id,
     model_profiles!model_listings_model_id_fkey (
       id, slug, first_name, last_name, cover_photo_url,
       users:user_id ( instagram_handle )
     )`,
    { count: 'exact' }
  )
  .eq('professional_id', professionalId)
  .in('effective_status', ['active', 'free_trial'])
  .neq('model_id', currentModelProfileId)
// Then filter to published/non-suspended profiles (RLS already enforces this for anon;
// service-role fetch must filter in code).
```
> Embedding `users` through `model_profiles` requires the `model_profiles → users` FK
> (`model_profiles_user_id_fkey`, exists). If PostgREST embedding of the nested `users` join is
> awkward, do a two-step (fetch model_ids, then fetch profiles+users) or a server-side SQL/RPC.

### Indexes
- ✅ Present: `idx_model_listings_professional_id`, `idx_model_listings_status`,
  `idx_model_profiles_slug`, `idx_model_profiles_user_id`, `users` PK on `id`.
- The query is well-served by existing indexes at this scale (15 listings, 8 profiles). A composite
  `(professional_id, status)` would be a micro-optimization only — **not needed**.

---

## 3. Codebase

**a) Public ambassador page** — `app/(public)/[slug]/page.tsx`
Server component (`async`). Resolves `model_profiles` by `.eq('slug', slug)`; fetches listings from
the **`model_listings_live`** view with `PUBLIC_LISTING_SELECT`, `.eq('model_id', profile.id)`,
`.in('effective_status', ['active','free_trial'])`, using **`createServiceRoleClient()`** (RLS
bypassed). Data passed to `<PublicPageClient data={...} />`. Projection shape:
`lib/public/slug-page-shape.ts` (`PublicListingRow`, `PUBLIC_LISTING_SELECT`).

**b) Listing-card component** — `components/public/SquadRow.tsx`
- Avatar: lines ~156–199, IG-gradient border, links to `instagram.com/${listing.professional_instagram}`,
  image = `listing.professional_avatar_url`; fires `listing_instagram_click`.
- WhatsApp badge: lines ~205–260, green `#25D366`, `wa.me/${digits}?text=...`, renders only if
  `whatsapp_number`; pink pulse animation; fires `listing_whatsapp_badge_click`.
- **Video button: `<MediaOrb>` (`components/public/MediaOrb.tsx`), props `videoUrl /
  videoThumbnailUrl / posterUrl / hasPhotos / isActive`. Uses the shared `orbMediaPool` singleton
  for iOS autoplay/decoder limits. DO NOT TOUCH.** ← the new badge must not alter this.

**c) Modal pattern to match** — `components/public/ProInfoModal.tsx`
Vanilla fixed-overlay (no portal lib): `position:fixed; inset:0; zIndex:100`. Opens via parent
`useState<string|null>` (`PublicPageClient` `setProInfoModalListingId(id)`), conditionally rendered
`{id && <ProInfoModal/>}`. Closes via internal `closing` flag + 200ms animation then `onClose()`.
Includes focus-trap, Escape-to-close, body-scroll-lock (iOS-safe), reduced-motion. **Match this
exactly** for the new "Other Ambassadors" modal.

**d) Styling** — Inline `CSSProperties` + Tailwind + `globals.css`. Brand accent `#e91e8c` is
**not centralized** — hard-coded inline across `SquadRow`, `ProInfoModal`, `MediaOrb`. Font: `Inter`
(Google Fonts, `app/layout.tsx`); stack `'Inter','Segoe UI',-apple-system,sans-serif`. (Georgia
serif only inside Pro Info summary text.)

**e) URL pattern** — `/{slug}` → `app/(public)/[slug]/page.tsx`; slug = `model_profiles.slug`.
Row links to another ambassador resolve to `/${slug}` directly.

**f) Existing "ambassadors-for-a-pro" query/util** — **None.** No pro→ambassador mapping or count
exists. `lib/ambassador/analytics-aggregate.ts` aggregates per-ambassador stats only;
`model_analytics_events` tracks per-listing clicks. This feature needs a **new** query (section 2).

---

## 4. Gaps & Risks

1. **No data yet — modal is empty for every pro.** Every professional has exactly **one** live
   ambassador today. The "other ambassadors" set is currently empty everywhere → **gate the badge
   on count > 0** so it doesn't render an empty modal. Test data will be needed to see it work.
2. **No ambassador profile photo.** `users.profile_photo_url` is NULL for all 8; `model_profiles`
   has no avatar field. **Use `model_profiles.cover_photo_url`** (populated for all 8) as the row
   avatar — but it's a wide cover image, not a square headshot, so expect cropping/object-fit work.
3. **IG handle is on a different table.** Ambassador IG = `users.instagram_handle` (via
   `model_profiles.user_id`), and is **nullable** (the page already hides the IG button when null).
   Some rows may have no handle.
4. **Two `instagram_handle` columns** — `users` (ambassador) vs `model_professionals` (the pro).
   Easy to grab the wrong one. For this feature we want the **ambassador's** = `users`.
5. **`users` RLS is disabled (pre-existing).** Reading `instagram_handle` publicly works, but the
   table is fully exposed to the anon key — a standing security issue to flag (don't fix as part of
   this feature).
6. **Fetch path choice.** The page uses service-role server-side (RLS bypassed) → if the feature
   fetches that way, **must replicate the published/non-suspended filter in code** (RLS won't do it).
   If fetched client-side with the anon key, RLS already enforces it.
7. **"Exclude current ambassador" is trivial** — `model_id <> current profile id` (or `slug <>`).
   No awkwardness.
8. **PostgREST nested embed** (`model_profiles → users`) may be fiddly; a two-step fetch or a small
   SQL/RPC is a clean fallback. FK `model_profiles_user_id_fkey` exists, so embedding should work.
