# "Someone Was Faster" — UI Spec (FINAL)

**File:** `payment_gift_taken_already_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route (suggested):** `/wish/already-gifted` — final route TBD in dedicated URL session
**Access:** Public page, no authentication. Reached only via server-side redirect.

---

## 1. Purpose

Shown to a gifter who tries to pay for a beauty wish that was **already paid by another gifter** in the meantime. Prevents charging twice for the same wish.

This page is the race-condition safety net — rare but guaranteed to never break (see `checkout_for_wish-gifter_final_UI_Spec.md §9`).

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| Wish checkout — server 409 Conflict | `POST /api/checkout/wish` returns 409 → frontend redirects here with `?slug=&first=` params | **The ONLY legitimate path.** |
| Bookmarked URL / direct visit | User saved URL and opens later | Edge case. On load, if no valid slug → immediately redirect to `/` (homepage). User never sees this page standalone. |
| Browser back from ambassador page | After tapping "Go to {name}'s page", user presses back | **Blocked by `history.replaceState()`** — this page removes itself from history on load, so back skips past it to wherever the user was BEFORE the wish checkout. Prevents infinite loop. |

**Server-side prerequisite (critical for Claude Code):**
The 409 response body MUST include:
```json
{
  "error": "wish_already_granted",
  "ambassador": {
    "slug": "sarajohnson",
    "first_name": "Sara"
  }
}
```
The frontend builds the redirect URL from these fields:
```
/wish/already-gifted?slug={ambassador.slug}&first={ambassador.first_name}
```

### 2.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "Go to {first_name}'s page" button | `/{slug}` | **Same tab** | The only action on this page. If `first_name` failed validation → label reads "Go to their page". |
| Invalid/missing `slug` (on load) | `/` (homepage) | Same | Redirects via `window.location.replace()` — no history entry created, user can't come back here via browser back. |
| Browser back | Page BEFORE the wish checkout (e.g. Sara's public page where they tapped "Gift it") | Same | `history.replaceState()` on load removes this page from history so back button skips it. Prevents infinite redirect loop with the checkout page (which would 410 and bounce back here). |

### 2.3 Backend reads / writes

**None.** This page makes zero API calls. Everything is derived from URL params.

### 2.4 Resolved decisions

| Item | Decision |
|---|---|
| Authentication | None — public URL |
| Data source | URL params `?slug=` + `?first=` only. No fetch. No ambassador lookup. |
| Missing/invalid `slug` (production) | **Redirect to `/`** via `window.location.replace()`. No hardcoded fallback name. |
| Missing/invalid `slug` (mockup, file://) | Falls back to demo data (`slug=sarajohnson`, `first=Sara`) so the page can be design-reviewed. **Mockup-only — must be removed in production build (see §3.5).** |
| Missing/invalid `first_name` | Fallback to generic "their" → button reads "Go to their page" |
| Pronoun in body copy | **Removed entirely.** Copy is now "This beauty wish has already been gifted by someone else." (no "her" / "him" / "them"). |
| "Go to {name}" button | Same tab, links to `/{slug}` |
| Browser back behavior | `history.replaceState()` called on load — removes this page from history so back skips it. Prevents infinite loop with checkout page. |
| Loading state | None. URL params are synchronous. Instant render. |
| Footer | None. No "Powered by WeLoveDecode" line, no support link, no status bar. Minimal by design. |
| XSS / malformed params | Validated against strict regex (see §3.3). `textContent` used (never `innerHTML`). Button href uses regex-validated slug only. |

---

## 3. Data handling

### 3.1 URL format
```
/wish/already-gifted?slug=sarajohnson&first=Sara
```

### 3.2 Param reading
```js
var params = new URLSearchParams(window.location.search);
var slug = params.get('slug');
var firstName = params.get('first');
```

### 3.3 Validation regex (locked)

**slug:**
```regex
/^[a-z0-9_.-]{1,30}$/i
```
- Lowercase/uppercase letters, digits, underscore, dot, dash
- 1–30 chars
- Matches the ambassador slug format set during onboarding/Settings
- **Invalid or missing → `window.location.replace('/')`** (user is sent to homepage, this page removed from history)

**first_name:**
```regex
/^[\p{L}\s]{1,50}$/u
```
- Unicode letters from any language (`\p{L}` with `/u` flag)
- Plus spaces
- 1–50 chars
- Matches the name sanitization used on the wish checkout gifter name input
- **Invalid or missing → fallback to string "their"**

### 3.4 Render logic

```js
// Label
if (firstName === 'their') {
  span.textContent = 'their page';         // "Go to their page"
} else {
  span.textContent = firstName + '\u2019s page';  // "Go to Sara's page"
}

// Button href
button.href = '/' + slug;

// Remove page from history
history.replaceState(null, '', window.location.href);
```

### 3.5 Mockup-only fallback (REMOVE IN PRODUCTION)

For design review purposes, the HTML includes a fallback that renders demo data when:
- Page is opened via `file://` protocol, OR
- Both `slug` and `first` URL params are missing

```js
// MOCKUP-ONLY block — Claude Code MUST remove this for production
var isMockup = window.location.protocol === 'file:' || (!slug && !firstName);
if (isMockup && !slug) {
  slug = 'sarajohnson';
  firstName = firstName || 'Sara';
}
```

Without this fallback, opening the file directly would immediately redirect to `/`, making the page impossible to preview. **In production, this entire `if (isMockup)` block must be removed** — only server-redirected entries with valid params should render the page.

### 3.6 Security notes

- **No `innerHTML`** anywhere — only `textContent`. Any attempted `<script>` injection via URL params would render as literal text.
- **Button `href`** built from regex-validated slug only. Can't contain `javascript:` or any other scheme.
- **Regex validation is strict** (anchored with `^` and `$`, bounded length). Prevents path traversal, injection, and length-based DoS.
- Belt + suspenders: even if a regex was accidentally loosened, `textContent` still protects from XSS.

---

## 4. Layout (top to bottom)

1. **Empty space** (160px padding-top)
2. **Title** — "Someone was faster!" (22px bold, -0.2px letter-spacing)
3. **Subtitle** — "This beauty wish has already been<br>gifted by someone else." (13px, `#888`, line-height 1.6) — pronoun-neutral
4. **Action button** — pink `#e91e8c`, 16px padding, 12px radius, 15px bold → "Go to {first_name}'s page"

No status bar. No footer. No support link. Nothing else.

---

## 5. Build checklist for Claude Code

### Frontend (this page)
- [ ] **Remove the mockup-only fallback block** (`if (isMockup) { ... }` in `init()`) — it exists only for design preview when opening the HTML file directly. In production, missing/invalid params MUST redirect to `/`.
- [ ] Read `slug` + `first` from URL query string
- [ ] Validate `slug` against `/^[a-z0-9_.-]{1,30}$/i` — redirect to `/` on failure
- [ ] Validate `first` against `/^[\p{L}\s]{1,50}$/u` — fallback "their" on failure
- [ ] Render button label: `firstName + "'s page"` (or `"their page"` for fallback)
- [ ] Render button href: `/{slug}`
- [ ] Call `history.replaceState(null, '', window.location.href)` on load
- [ ] Use `textContent` (never `innerHTML`) for all dynamic text
- [ ] No API calls — page is fully static after URL parse

### Backend
- [ ] On `POST /api/checkout/wish`, when `wish.is_granted === true`:
  - Return HTTP 409 Conflict with body:
    ```json
    {
      "error": "wish_already_granted",
      "ambassador": { "slug": "...", "first_name": "..." }
    }
    ```
  - `first_name` comes from `users.first_name`
  - `slug` comes from `users.slug`

### Routing
- [ ] Route `/wish/already-gifted` renders this HTML
- [ ] No authentication required
- [ ] No rate limiting needed
- [ ] No SEO / indexing (add `<meta name="robots" content="noindex">` if desired — race-condition page shouldn't appear in search)

---

## 6. Edge cases

| Case | Behavior |
|---|---|
| User bookmarks URL and opens it later with valid slug | Renders normally. Button works. Back button goes to their prior page (history-replaced on load so checkout isn't in stack). |
| User lands here via malformed URL `?slug=<>&first=` | Redirected to `/` immediately (regex fails). |
| User lands without any params | Redirected to `/` immediately (no slug). |
| User lands with `slug=sarajohnson` but no `first` | Renders with "Go to their page". |
| Slug has uppercase letters | Regex allows case-insensitive (`/i` flag). Ambassador slug is typically lowercase but we don't enforce here. |
| First name in Arabic / Chinese / Cyrillic | Regex uses `\p{L}` + `/u` flag — any Unicode letter passes. |
| First name with emoji | Fails regex. Falls back to "their". |
| Attempted XSS via `?first=<script>` | `textContent` renders as literal string. No script execution. Regex fails too — fallback to "their". |
| Browser back after pressing the button | Goes to whatever was before the wish checkout (typically Sara's public page). Doesn't loop back to checkout or this page. |
| User opens in translator tool / screen reader | All text is `textContent` — fully accessible. No ARIA needed for such a simple layout, but a `lang="en"` on `<html>` would help translation tools (currently not set — could be added). |

---

## 7. Related files

| File | Purpose | Status |
|---|---|---|
| `checkout_for_wish-gifter_final.html` | Wish gifter checkout (where 409 is triggered) | Final |
| **`payment_gift_taken_already_final.html`** | **This page — "Someone was faster"** | **Final** |
| `wish-gift_payment_confirmation_for_gifter_final.html` | Success receipt (the lucky first gifter goes here) | Final |
| Sara's public page `/{slug}` | Where the user eventually returns | Already built |

---

## 8. Testing instructions (manual)

Open the file in a browser with these URLs to test each state.

**Note:** When opened directly via `file://` (or any URL with NO params at all), the page falls back to mockup demo data. This fallback exists for design preview only and is removed for production (see §3.5).

| URL | Expected behavior |
|---|---|
| `payment_gift_taken_already_final.html` (no params, file://) | **Mockup mode** — renders with demo data: "Go to Sara's page" |
| `payment_gift_taken_already_final.html?slug=sarajohnson&first=Sara` | Renders: "Go to Sara's page" button → links to `/sarajohnson` |
| `payment_gift_taken_already_final.html?slug=sarajohnson` | Renders: "Go to their page" (no first name) |
| `payment_gift_taken_already_final.html?slug=sarajohnson&first=Café` | Renders: "Go to Café's page" (Unicode letters supported) |
| `payment_gift_taken_already_final.html?slug=<script>&first=x` | Redirects to `/` (slug regex fails — production behavior) |
| `payment_gift_taken_already_final.html?slug=sarajohnson&first=<script>` | Renders: "Go to their page" (first regex fails) |

**In production (HTTPS, real route):**
- No params at all → redirect to `/`
- Invalid slug → redirect to `/`
- Valid slug + invalid/missing first → "Go to their page"

---

## 9. Outstanding items

- [ ] Final route for this page (dedicated URL session)
- [ ] Optional: add `<meta name="robots" content="noindex">` if we don't want this page indexed by search engines
