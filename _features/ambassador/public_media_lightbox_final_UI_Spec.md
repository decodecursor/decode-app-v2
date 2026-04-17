# Public Media Lightbox — UI Spec (FINAL)

**File:** `public_media_lightbox_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** Not a standalone route. Rendered as an overlay on the ambassador's public page `/{slug}`.
**Access:** Public. Anyone viewing an ambassador page can open it.
**Design philosophy:** Ultramodern, restrained, typography-led. Full-bleed media, quiet chrome, native-feeling navigation on every device.

---

## 1. Purpose

A full-screen media viewer for a single professional in an ambassador's Beauty Squad. Supports two media types:

- **Video** (single clip, autoplays, muted by default, tap-to-pause)
- **Image carousel** (1–3 images, swipeable on mobile, arrow/keyboard/dot navigable on desktop)

Every lightbox instance shows one professional's name, category, location, and opens their Instagram (app if installed, website otherwise) when the info bar is tapped.

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| "My Beauty Squad" section on ambassador public page (`/{slug}`) | Each professional row has a **pink play-button (▶) on the right side** of the row. Tapping it calls `openLightbox(professionalPayload)` which mounts the lightbox overlay. | **Primary and only path.** The play-button is a circular pink outline icon positioned at the right of the row (photo left, name/category/location middle, play button right). Tapping triggers the lightbox. |

**No authentication.** Any visitor to the public page can trigger it.

**No button when media is missing:** listings require media at creation time (mandatory on add-listing page). If somehow a listing has no media — e.g. legacy data — the play button is simply not rendered. No broken state, no greyed-out button.

### 2.2 Outbound (all exits)

| Element | Destination | Behavior | Notes |
|---|---|---|---|
| **Close button** (X, top-right) | Dismiss overlay | Lightbox disappears. Ambassador public page still in the background. | Top-right is convention (Instagram, TikTok, YouTube). |
| **Click outside the frame** (dark backdrop) | Dismiss overlay | Same as close button | Standard modal pattern. Host page attaches a click handler on the backdrop; clicks inside the frame propagation-stop. |
| **Escape key** | Dismiss overlay | Same as close button | Works on all devices with physical keyboards |
| **Info bar** (professional photo + name + category + location) | `https://www.instagram.com/{handle}` | **Opens in new tab** (`target="_blank"` + `rel="noopener noreferrer"`). On mobile with Instagram installed, iOS/Android auto-intercepts the `instagram.com` link and opens the Instagram app natively. On desktop or if app not installed → opens Instagram web. Lightbox stays open in background. | Fires `instagram_click` analytics event (see §5). |

**There is NO navigation between professionals.** Each lightbox shows exactly one professional. To view another professional, user closes this lightbox and taps another button in the squad. (Vertical-swipe Reels-style browsing = explicit future v2 feature, not in scope.)

### 2.3 In-lightbox interactions (no navigation — just state)

| Element | Action |
|---|---|
| **Tap media** (video frame) | Toggle play/pause |
| **Tap mute icon** (video frame) | Toggle mute |
| **Swipe** (image frame, mobile) | Navigate carousel |
| **Click left/right arrow** (image frame, desktop hover) | Smooth scroll to prev/next slide |
| **Click dot** (image frame) | Jump to that slide |
| **Key ←** / **→** | Navigate carousel |
| **Key Space** | Toggle play/pause (video) |
| **Key M** | Toggle mute (video) |
| **Key Esc** | Close lightbox |

---

## 3. Data contract

### 3.1 `openLightbox(payload)` — called from the public page

The public ambassador page already has all the data loaded in DOM (from the server-side render of `/{slug}`). When the user taps a squad member's show-media button, the page passes a payload object directly — **no extra API fetch, no loading state, instant open**.

**Payload shape:**
```js
{
  professional: {
    id: "prof_salon_luxe",           // Used for analytics event target
    name: "Salon de Luxe",
    category: "Hair",
    location: "Dubai, UAE",
    instagram: "salondeluxe",        // Used to build instagram.com URL (no @ prefix)
    photo_url: "https://..." | null  // null → show initials fallback (first letters of name)
  },
  media: {
    type: "video",                   // "video" | "image"
    // If type === "video":
    video_url: "https://...",
    video_poster_url: "https://..." | null,   // Frame shown before play starts
    // If type === "image":
    images: [
      { url: "https://..." },
      { url: "https://..." },
      { url: "https://..." }
    ]
  }
}
```

### 3.2 Constraint: one media type per professional

Each professional has EITHER a video OR 1–3 images — **never mixed**. This is v1 scope.

If Sara uploaded a video for a professional → `media.type === "video"` → video frame renders.
If Sara uploaded 1–3 images → `media.type === "image"` → image carousel renders.

### 3.3 Where the data was stored

Sara filled the professional's details + uploaded media on the **Add Listing** page. The server stored:
- Professional name, category, location, Instagram handle → `listings` table
- Uploaded media files → storage bucket, URLs saved on the `listings` row (or related media table)

The public page `/{slug}` renders all squad members with their buttons; tapping a button passes the already-loaded data to `openLightbox()`.

### 3.4 Browsing between professionals (v2 — not implemented)

Vertical swipe (Instagram Reels-style) to move between professionals is **out of scope for v1**. Each lightbox shows exactly one professional. To view another, user closes and taps another squad button.

Estimated effort for v2: 2–3 days (preloading, gesture handling, desktop equivalents, state management, analytics on every swipe).

---

## 4. Layout structure

Full-frame. All elements are absolutely positioned over the media:

1. **Media layer** (video or image carousel) — fills the entire frame
2. **Top scrim** — 90px gradient `rgba(0,0,0,0.55) → transparent` — keeps top buttons legible
3. **Top buttons** — mute (video only, left) + close (always present, right), 32×32 each
4. **Navigation arrows** (desktop only, image frame only) — 40×40 circular, hover-fade-in
5. **Progress bar** (video only) — 1px, pink fill advances with video time
6. **Dot indicators** (image only, hidden when 1 slide) — above the info bar
7. **Bottom scrim** — 130px gradient `transparent → rgba(0,0,0,0.92)` — keeps info bar legible
8. **Info bar** (anchor element) — photo + name + category + location, full-width tap target, opens Instagram
9. **Toast** — transient confirmation message above info bar

---

## 5. Analytics (critical)

Two separate event types, fired independently to `/api/analytics/event`:

### 5.1 `lightbox_opened`

**Fired:** once, by the public ambassador page, when `openLightbox()` is called.
**Why:** counts "views" of each professional's media.

```
POST /api/analytics/event
Content-Type: application/json

{
  "event": "lightbox_opened",
  "professional_id": "prof_salon_luxe",
  "at": "2026-04-14T09:41:00.000Z"
}
```

### 5.2 `instagram_click`

**Fired:** when the user taps the info bar (Instagram link).
**Why:** counts conversions — the user saw the media AND decided to visit Instagram.

```
POST /api/analytics/event
Content-Type: application/json

{
  "event": "instagram_click",
  "professional_id": "prof_salon_luxe",
  "handle": "salondeluxe",
  "at": "2026-04-14T09:41:00.000Z"
}
```

### 5.3 Implementation rules

- **Fire-and-forget** with `fetch(..., { keepalive: true })`. Keeps the request alive even as the page unloads (important since Instagram click opens a new tab).
- **Silent fail**. `.catch(function(){})` on every call. Analytics must never break the UX.
- **Don't `preventDefault()`** on the Instagram click — let the `<a target="_blank">` open naturally. The analytics call runs alongside it.

### 5.4 Admin dashboard — what the data powers

Admin can see per professional / per listing:
- **Lightbox opened count** — how many people viewed this professional's media
- **Instagram click count** — how many of those converted to an Instagram visit
- **Conversion rate** — clicks / opens (derived)

These are stored **separately** in the analytics table so admin queries can show both numbers independently.

### 5.5 Analytics schema suggestion

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event VARCHAR(40) NOT NULL,               -- 'lightbox_opened' | 'instagram_click'
  professional_id VARCHAR(64),              -- Nullable if the event isn't professional-scoped
  ambassador_id UUID,                       -- Derived server-side from professional_id
  handle VARCHAR(100),                      -- Instagram handle (for instagram_click only)
  visitor_ip_hash VARCHAR(64),              -- Server hashes IP for anti-bot deduping
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_professional ON analytics_events(professional_id, event, created_at);
CREATE INDEX idx_events_ambassador ON analytics_events(ambassador_id, event, created_at);
```

Rollups can be computed nightly into `analytics_professional_counts` for fast dashboard queries.

---

## 6. Color system

| Color | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Progress bar fill, active dot, photo border, category label |
| White | `#fff` | Icons, name, active dot text |
| Gray 888 | `#888` | Location, separator dots |
| Black | `#000` | Frame bg, photo circle bg |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Arrow scrim | `rgba(0,0,0,0.35)` + `backdrop-filter: blur(8px)` | Nav arrow background |
| Inactive dot | `rgba(255,255,255,0.35)` | Carousel dots |
| Progress track | `rgba(255,255,255,0.15)` | Under the pink fill |
| Top scrim | `rgba(0,0,0,0.55) → 0` | Over the top of media |
| Bottom scrim | `0 → rgba(0,0,0,0.92)` | Over the bottom of media |
| Toast | `rgba(28,28,28,0.95)` bg + `#333` border | Transient message |

---

## 7. Typography

All `system-ui, -apple-system, sans-serif`.

| Element | Size | Weight | Color |
|---|---|---|---|
| Professional name | 14px | 600 | `#fff` |
| Category label | 11px | 600 | `#e91e8c` |
| Location | 11px | 400 | `#888` |
| Photo initials | 12px | 600 | `#fff` |
| Toast | 12px | 400 | `#fff` |

---

## 8. Navigation arrows (desktop-only, image frame)

- **40×40 circles**, `rgba(0,0,0,0.35)` + `backdrop-filter: blur(8px)`
- Centered vertically: `top:50%; transform:translateY(-50%)`
- Left: `left:14px`, right: `right:14px`
- **Hidden by default** (`opacity:0`), fade in on frame hover (0.2s)
- **`@media (hover: hover) and (pointer: fine)`** — only rendered on devices with true hover. Touch devices never paint them. Mobile experience untouched.
- **Click** → `navSlide(±1)` → smooth-scrolls the carousel one slide

---

## 9. Keyboard shortcuts (desktop power users)

| Key | Action |
|---|---|
| ← | Previous slide (image carousel) |
| → | Next slide (image carousel) |
| Space | Toggle play/pause (video). `preventDefault` so page doesn't scroll. |
| M / m | Toggle mute (video) |
| Esc | Close lightbox |

---

## 10. Resolved decisions

| Item | Decision |
|---|---|
| Authentication | None — public |
| Data source | **`openLightbox(payload)`** — host page passes already-loaded data. No extra fetch, no loading state. |
| Multiple professionals per open | **No.** One professional per lightbox. Vertical swipe between professionals = v2, not in scope. |
| Media type per professional | **Exclusive.** Either one video OR 1–3 images. No mixing in v1. |
| Media mandatory at listing creation | **Yes.** Sara MUST upload media on add-listing. No listings without media. Play button on public page only renders if media exists (defensive — shouldn't occur in practice). |
| Play-button location | Right side of the squad row (circular pink outline ▶ icon). Photo on left, name/category/location middle, play button right. |
| Media storage URLs | **Public CDN URLs.** Not signed, don't expire. Fast, cacheable. Beauty-marketing media is not sensitive. |
| Video autoplay | Muted by default (required by iOS Safari). On unmute, playback **continues from current position** (not restart). `videoEl.muted = false`. |
| Close behavior | Dismiss overlay. Ambassador public page remains in background. No navigation. Triggered by close X (top-right), Esc key, or click outside the frame. |
| Close button position | **Top-right.** Convention (Instagram, TikTok, YouTube). |
| Click outside the frame | **Closes the lightbox.** Standard modal pattern. Host page attaches backdrop click handler. |
| Esc key | Closes lightbox on all devices. |
| Instagram link | `https://www.instagram.com/{handle}` with `target="_blank"` + `rel="noopener noreferrer"`. On mobile with Instagram app installed, iOS/Android auto-intercepts. No app = opens Instagram web. |
| Analytics events | **Two separate**: `lightbox_opened` (fired by host page **immediately** when `openLightbox()` is called, before any animation) + `instagram_click` (fired on info bar tap). Stored separately. |
| Analytics double-counting | **Each open fires one event, no debounce.** User opening 5 times = 5 events. Honest count of intent. Server-side dedupe can be added later if needed. |
| Analytics consent (GDPR/cookies) | Out of scope for this spec. Handled at the host page's script loader. The lightbox fires events unconditionally — whether they reach the server depends on the consent gate. |
| Analytics transport | `fetch(..., { keepalive: true })` fire-and-forget. Silent fail. Never blocks UX. |
| Toast duration | 1.4s (shorter than other pages' 1.8s — lightbox is already a transient view) |
| Stacked frames in mockup file | **Mockup-only.** Production renders ONE lightbox as overlay. `body` flex layout is mockup-only. |

---

## 11. Build checklist for Claude Code

### Frontend (this file)
- [ ] Host page "My Beauty Squad" section: render each listing row with photo + name/category/location + **pink play-button (▶) on right side**. Button binds to `openLightbox(payload)` with that professional's already-loaded data.
- [ ] Host page calls `trackLightboxOpened(professional.id)` **immediately** when `openLightbox()` is called — before any animation
- [ ] Production: render one `.frame` inside a full-screen overlay with dark backdrop
- [ ] **Click-outside-to-close**: attach click handler on the backdrop; if click target is NOT inside `.frame`, dismiss overlay
- [ ] Video frame: wire `<video>` element to `togglePlayPause()` — use `videoEl.paused`/`play()`/`pause()` instead of the mockup's `isPlaying` boolean
- [ ] Video mute: `videoEl.muted = false` when unmuting — playback continues from current position, no restart
- [ ] Video progress bar: listen to `timeupdate` event on `<video>` — set `progressFill.style.width = (videoEl.currentTime / videoEl.duration * 100) + '%'`
- [ ] Remove the mockup's `setInterval` fake progress
- [ ] Image frame: render 1–3 slides from `media.images[]` (each `url` is a public CDN URL)
- [ ] Dots auto-hide for 1-slide carousels (already handled)
- [ ] `@media (hover: hover) and (pointer: fine)` gates desktop arrow visibility
- [ ] `document.keydown` listener for keyboard shortcuts (already wired)
- [ ] Close button dismisses the overlay (calls host page close handler, doesn't navigate)
- [ ] Info bar is an `<a href="https://www.instagram.com/{handle}" target="_blank" rel="noopener noreferrer">`
- [ ] `trackInstagramClick()` fires on info bar click — does NOT `preventDefault`
- [ ] **Remove the mockup-only `showToast` confirmations** in `closeLightbox()` and `trackInstagramClick()` (the `if (window.location.protocol === 'file:')` branch) — production does the real action

### Backend
- [ ] `POST /api/analytics/event` endpoint that accepts `{ event, professional_id, handle?, at }`
- [ ] Server resolves `professional_id` → `ambassador_id` for the listing owner
- [ ] Server hashes visitor IP + stores user-agent (for anti-bot deduping, not for double-tap prevention — that's accepted as honest intent)
- [ ] Admin dashboard queries `analytics_events` grouped by `professional_id` + `event` to show counts per professional
- [ ] Rate limiting on the analytics endpoint (prevent abuse)

### Validation on add-listing page
- [ ] **Media upload is mandatory.** Form cannot submit without at least one image OR one video. Applies to both initial creation and edit flows.

### Database
- [ ] Create `analytics_events` table per §5.5
- [ ] Optional: nightly rollup job into `analytics_professional_counts` for fast dashboard queries

### Admin dashboard (later)
- [ ] Table of listings with columns: `Professional` / `Lightbox opens` / `Instagram clicks` / `CTR%`
- [ ] Time-range filter (7d / 30d / all-time)

---

## 12. Related files

| File | Purpose | Status |
|---|---|---|
| **`public_media_lightbox_final.html`** | **This lightbox (video + image carousel stacked for design review)** | **Final** |
| Public ambassador page `/{slug}` | Hosts the squad + triggers `openLightbox()` | Already built |
| `add_listing_final.html` | Where Sara uploaded the media + professional details | Final |

---

## 13. Edge cases

| Case | Behavior |
|---|---|
| Professional has no Instagram handle | Info bar: either remove the tap target (convert from `<a>` to `<div>`) OR hide the info bar entirely. Recommend: show the info bar but make it non-tappable (no Instagram icon, no click handler). |
| Professional photo URL is null/404 | Falls back to initials (first letters of name) in the 40×40 circle. Already handled via the `.photo span` child. |
| Video fails to load | Show poster image if available, otherwise dark frame. Progress bar stays at 0%. Toast: "Video could not load" (optional). |
| Image URL 404 | Slide renders as solid dark background. User can still navigate past it. |
| Only 1 image | Dots hidden. Arrows still appear on desktop hover but clicking them does nothing (`navSlide` clamps to 0). |
| User taps close while video is playing | Overlay dismisses. `<video>` element is removed from DOM — playback stops automatically. |
| User opens lightbox on an already-deleted listing | Host page shouldn't render the button if listing is deleted. If it somehow does, `openLightbox()` gets stale data — renders with placeholder. Recommend: host page filters deleted listings before render. |
| Slow network | `keepalive: true` on analytics fetch ensures events deliver even if user navigates away immediately. |
| User has JS disabled | Lightbox doesn't open. Public page still shows the squad. Acceptable for v1. |

---

## 14. Outstanding items

- [ ] Final overlay mount/unmount logic on the host page (host page spec, not this file)
- [ ] Admin dashboard design (separate session)
- [ ] v2 feature: vertical swipe between professionals (separate session, deferred)
- [ ] Poster image fallback handling in production video element
