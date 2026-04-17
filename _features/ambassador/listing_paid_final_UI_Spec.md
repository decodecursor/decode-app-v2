# Listing Already Paid — UI Spec (FINAL)

**File:** `listing_paid_final.html`
**Project:** DECODE — Beauty Pay
**Route:** `/listing/paid`
**Access:** Public, no authentication. Reached only via server-side redirect from the listing checkout page when the listing was already paid by someone else.

---

## 1. Purpose

Terminal page shown when a **second (or third, fourth…) person** from the professional's business clicks a listing payment link **after the listing has already been paid** by a colleague.

**Real-world scenario:** A professional salon has a single payment link, and the admin sends it to three people at the company (owner, accountant, manager). One of them pays. When a later colleague opens the link, they must NOT:
1. See a checkout form for a listing that no longer needs payment
2. Be redirected to the first payer's receipt (which would leak personal payment details)

This page is the neutral "race condition safety net" for listings — the mirror of `/wish/taken` (which handles the equivalent race condition for gifts).

---

## 2. Sibling relationship

This page is the **listing equivalent** of `/wish/taken`:

| | Gift flow | Listing flow |
|---|---|---|
| Checkout URL | `/{slug}/wish/{code}` | `/{slug}/listing/{code}` |
| Race-condition URL | `/wish/taken` | `/listing/paid` |
| Title copy | "Someone was faster!" | "Someone was faster!" |
| Body copy | "This beauty wish has already been gifted by someone else." | "This listing has already been paid by someone else." |

Same pattern, same language, same tone. Users who've seen one recognize the other instantly.

---

## 3. Why this page exists (privacy reasoning)

Without this page, the existing spec would redirect person 3 to the **actual receipt** at `/listing/L8473921` — which would show person 1's:
- Exact amount paid
- Payment date + time
- Reference number
- Package duration chosen

This is private financial information. Person 3 (the colleague) should not see it.

This neutral page shows no financial data at all — just confirms the listing is already paid and sends them to the ambassador's public page.

---

## 4. Navigation — Full Map

### 4.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| Listing checkout — server 409 Conflict | `GET /api/payment-link/{token}` returns 409 when `listings.status = 'active'` → frontend redirects here with `?slug=&first=` params | **The ONLY legitimate path.** |
| Bookmarked URL / direct visit | User saved URL and opens later | Edge case. On load, if no valid slug → immediately redirect to `/` (homepage). User never sees this page standalone. |
| Browser back from ambassador page | After tapping "Back to {name}'s page", user presses back | **Blocked by `history.replaceState()`** — this page removes itself from history on load, so back skips past it to wherever the user was BEFORE the checkout. Prevents infinite loop. |

**Server-side prerequisite (critical for Claude Code):**

When `listings.status = 'active'` and the token is still valid:

```json
HTTP 409 Conflict
{
  "error": "listing_already_paid",
  "ambassador": {
    "slug": "sarajohnson",
    "first_name": "Sara"
  }
}
```

The frontend builds the redirect URL:
```
/listing/paid?slug={ambassador.slug}&first={ambassador.first_name}
```

### 4.2 Outbound (all exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "Go to {first_name}'s page" button | `/{slug}` | **Same tab** | The only action on this page. If `first_name` failed validation → label reads "Go to their page". |
| Invalid/missing `slug` (on load) | `/` (homepage) | Same | Redirects via `window.location.replace()` — no history entry created. |
| Browser back | Page BEFORE the listing checkout | Same | `history.replaceState()` on load removes this page from history. |

### 4.3 Backend reads / writes

**None.** This page makes zero API calls. Everything is derived from URL params.

### 4.4 Resolved decisions

| Item | Decision |
|---|---|
| Authentication | None — public URL |
| Data source | URL params `?slug=` + `?first=` only. No fetch. No listing lookup. No payment data shown. |
| Missing/invalid `slug` (production) | Redirect to `/` via `window.location.replace()`. No hardcoded fallback name. |
| Missing/invalid `slug` (mockup, `file://`) | Falls back to demo data (`slug=sarajohnson`, `first=Sara`) so the page can be design-reviewed. **Mockup-only — must be removed in production build.** |
| Missing/invalid `first_name` | Fallback to generic "their" → button reads "Back to their page" |
| Pronoun in body copy | Removed entirely — "someone else" works for all ambassadors. |
| Browser back behavior | `history.replaceState()` called on load — removes this page from history. |
| Loading state | None on page load (URL params are synchronous). Loading state ADDED on button tap to prevent double-taps. |
| Footer | None. No "Powered by DECODE", no support link. Minimal by design. |
| XSS / malformed params | Validated against strict regex. `textContent` used (never `innerHTML`). Button `href` uses regex-validated slug only. |

---

## 5. Data handling

### 5.1 URL format
```
/listing/paid?slug=sarajohnson&first=Sara
```

### 5.2 Validation regex (locked)

**slug:**
```
/^[a-z0-9_.-]{1,30}$/i
```
- Lowercase/uppercase letters, digits, underscore, dot, dash
- 1–30 chars
- **Invalid or missing → `window.location.replace('/')`**

**first_name:**
```
/^[\p{L}\s]{1,50}$/u
```
- Unicode letters from any language (`\p{L}` with `/u` flag)
- Plus spaces
- 1–50 chars
- **Invalid or missing → fallback to string "their"** (button reads "Go to their page")

Identical rules to `/wish/taken`. One validation function could serve both pages.

### 5.3 Render logic

```js
if (firstName === 'their') {
  span.textContent = 'their page';             // "Go to their page"
} else {
  span.textContent = firstName + '\u2019s page'; // "Go to Sara's page"
}

button.href = '/' + slug;

history.replaceState(null, '', window.location.href);
```

### 5.4 Mockup-only fallback (REMOVE IN PRODUCTION)

For design review via `file://`, a fallback renders demo data when the protocol is `file:` or all params are missing. **Remove this block in production** — only server-redirected entries with valid params should render the page.

### 5.5 Security notes

- No `innerHTML` — only `textContent`. Attempted `<script>` injection renders as literal text.
- Button `href` built from regex-validated slug only. Can't contain `javascript:` or any other scheme.
- Regex validation is strict (anchored with `^` and `$`, bounded length).

---

## 6. Layout (top to bottom)

1. **Empty space** (160px padding-top)
2. **Title** — "Someone was faster!" (22px / 700, -0.2px letter-spacing)
3. **Subtitle** — "This listing has already been<br>paid by someone else." (13px, `#888`, 1.6 line-height)
4. **Button** — pink `#e91e8c`, 16px padding, 12px radius, 15px bold → "Go to {first_name}'s page"

No status bar. No footer. No support link. No receipt info. Nothing else.

---

## 7. Color System

| Token | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Button background |
| White | `#fff` | Title, button label |
| Gray 888 | `#888` | Subtitle |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Black | `#000` | Page background |

Identical to `/wish/taken` and `/expired` — consistent visual language across terminal pages.

---

## 8. Build checklist for Claude Code

### Frontend (this page)
- [ ] **Remove the mockup-only fallback block** (`if (isMockup) { ... }` in `init()`) — it exists only for design preview when opening the HTML file directly
- [ ] Read `slug` + `first` from URL query string
- [ ] Validate `slug` against `/^[a-z0-9_.-]{1,30}$/i` — redirect to `/` on failure
- [ ] Validate `first` against `/^[\p{L}\s]{1,50}$/u` — fallback "their" on failure
- [ ] Render button label: `"Go to " + firstName + "'s page"` (or `"Go to their page"` for fallback)
- [ ] Render button href: `/{slug}`
- [ ] Call `history.replaceState(null, '', window.location.href)` on load
- [ ] Use `textContent` (never `innerHTML`) for all dynamic text
- [ ] Add loading state on button tap to prevent double-tap
- [ ] No API calls — page is fully static after URL parse

### Backend
- [ ] On `GET /api/payment-link/{token}`, when `listings.status = 'active'`:
  - Return HTTP 409 Conflict with body:
    ```json
    {
      "error": "listing_already_paid",
      "ambassador": { "slug": "...", "first_name": "..." }
    }
    ```
  - `first_name` comes from `users.first_name`
  - `slug` comes from `users.slug`
- [ ] Do NOT redirect to the receipt page (that would leak person 1's payment data)

### Frontend routing (checkout page)
- [ ] Update checkout page's fetch handler to distinguish 409 responses:
  - If `error === 'listing_already_paid'` → redirect to `/listing/paid?slug=...&first=...`
  - If `error === 'listing_refunded'` or other → handle separately (if/when refunded state is added)

### Routing
- [ ] Route `/listing/paid` renders this HTML
- [ ] No authentication required
- [ ] No rate limiting needed
- [ ] No SEO / indexing (already has `<meta name="robots" content="noindex">`)

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| User bookmarks URL and opens it later with valid slug | Renders normally. Button works. Back button goes to their prior page (history-replaced on load so checkout isn't in stack). |
| User lands here via malformed URL `?slug=<>&first=` | Redirected to `/` immediately (regex fails). |
| User lands without any params | Redirected to `/` immediately (no slug). |
| User lands with `slug=sarajohnson` but no `first` | Renders with "Back to their page". |
| Slug has uppercase letters | Regex allows case-insensitive (`/i` flag). |
| First name in Arabic / Chinese / Cyrillic | Regex uses `\p{L}` + `/u` flag — any Unicode letter passes. |
| First name with emoji | Fails regex. Falls back to "their". |
| Attempted XSS via `?first=<script>` | `textContent` renders as literal string. No script execution. |
| Browser back after pressing the button | Goes to whatever was before the listing checkout. Doesn't loop. |
| Double-tap the button | Second tap ignored — loading state blocks further clicks. |
| User opens in translator tool / screen reader | All text is `textContent` — fully accessible. |

---

## 10. Related files

| File | Purpose | Status |
|---|---|---|
| `checkout_for_listing-professional_final.html` | Listing checkout (where 409 is triggered) | Final |
| **`listing_paid_final.html`** | **This page — "Someone was faster" (listings)** | **Final** |
| `listing_payment_confirmation_final.html` | Success receipt (person 1 goes here) | Final |
| `payment_gift_taken_already_final.html` | Sibling page — "Someone was faster" (wishes) | Final |
| Sara's public page `/{slug}` | Where the user returns after tapping the button | Existing |

---

## 11. Testing instructions (manual)

Open the file in a browser with these URLs to test each state.

**Note:** When opened directly via `file://` (or any URL with NO params at all), the page falls back to mockup demo data. This fallback exists for design preview only and is removed for production.

| URL | Expected behavior |
|---|---|
| `listing_paid_final.html` (no params, `file://`) | **Mockup mode** — renders with demo data: "Go to Sara's page" |
| `listing_paid_final.html?slug=sarajohnson&first=Sara` | Renders: "Go to Sara's page" → links to `/sarajohnson` |
| `listing_paid_final.html?slug=sarajohnson` | Renders: "Go to their page" (no first name) |
| `listing_paid_final.html?slug=sarajohnson&first=Café` | Renders: "Go to Café's page" (Unicode letters supported) |
| `listing_paid_final.html?slug=<script>&first=x` | Redirects to `/` (slug regex fails — production behavior) |
| `listing_paid_final.html?slug=sarajohnson&first=<script>` | Renders: "Go to their page" (first regex fails) |

---

## 12. Outstanding items

None. Route locked, copy locked, design locked, navigation locked.
