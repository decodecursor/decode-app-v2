# Page Not Found (404) — UI Spec (FINAL)

**File:** `not_found_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** No explicit route — rendered by the server for ANY non-existent URL. HTTP status: `404 Not Found`.
**Access:** Public. Anyone who hits a bad URL.

---

## 1. Purpose

Universal fallback page shown when a requested URL doesn't match any route in the app. Covers typos, stale bookmarks, old shared links, guessed ambassador slugs that don't exist, deleted resources. Single page, single message, single exit.

---

## 2. Scope of coverage

| Scenario | Example URL |
|---|---|
| Typo in URL | `welovedecode.com/dashbord` |
| Old shared link | `welovedecode.com/old-feature` |
| Guessed ambassador slug that doesn't exist | `welovedecode.com/randomname` |
| Deleted ambassador's page | `welovedecode.com/olduser` |
| Random bot crawling | `welovedecode.com/wp-admin` |
| Anything else not matched by the router | — |

**Out of scope (handled by dedicated pages):**

| Case | Page shown instead |
|---|---|
| Expired/deleted payment link | `/expired` |
| Wish already gifted | `/wish/taken` |
| Broken email auth link | `/model/auth/email-error` |

The 404 is the **generic catch-all** — any URL not matched by router OR by the dedicated state pages above.

---

## 3. Navigation — Full Map

### 3.1 Inbound

**Any non-matching URL.** Server returns HTTP 404 + this HTML.

### 3.2 Outbound (single exit)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "Go to WeLoveDecode" button | `/model` (logged in) or `/model/auth` (logged out) | Same | Default href `/model`; the app's auth guard redirects to `/model/auth` if no session |

### 3.3 Backend reads / writes

**None.** Stateless page. No API calls. No session lookup required (the auth guard on `/model` handles that).

### 3.4 Browser back behavior

No history manipulation. Standard browser back returns user to wherever they were before hitting the bad URL (the referring page, a bookmark list, a search result, etc.).

---

## 4. HTTP status

**MUST be `404 Not Found`.** Not `200 OK`. Reasons:

- Search engines won't index it (correct SEO behavior)
- Link checkers can detect broken inbound links to the site
- Browsers can handle it appropriately (e.g. restore previous page cache)

Do NOT soft-redirect to `/model` — always render the 404 page at the original URL so the user sees what was wrong.

---

## 5. Layout (top to bottom)

1. **Empty space** (160px padding-top)
2. **Title** — `Page not found` (22px / 700, -0.2px letter-spacing)
3. **Subtitle** — `This page doesn't exist.` (13px, `#888`, 1.6 line-height, 40px bottom margin)
4. **Button** — `Go to WeLoveDecode`, pink `#e91e8c`, full width

No status bar. No icon. No search bar. No secondary links. Minimal by design.

---

## 6. Color System

| Token | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Button background |
| White | `#fff` | Title, button label |
| Gray 888 | `#888` | Subtitle |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Black | `#000` | Page background |

Matches `/expired` and `/model/auth/email-error` — same neutral visual language for all terminal-state pages.

---

## 7. Button behavior

| State | Trigger | Style |
|---|---|---|
| Idle | Default | Pink `#e91e8c`, clickable |
| Loading | Tap | Pink, 70% opacity, label → `Loading…`, further taps ignored |

---

## 8. Build checklist for Claude Code

### Frontend
- [ ] No JS logic required beyond loading state
- [ ] No API calls
- [ ] Button is a real `<a href>` so it works with JS disabled

### Backend / routing
- [ ] Next.js: create `app/not-found.tsx` — Next automatically serves it for unmatched routes
- [ ] Ensure HTTP status is `404` (Next.js does this automatically when `notFound()` is called or `not-found.tsx` is matched)
- [ ] `<meta name="robots" content="noindex">` already included — keeps dead URLs out of search
- [ ] Also trigger this page when a dynamic route resolves to nothing:
  - `/{slug}` where slug doesn't match any ambassador → call `notFound()`
  - `/sarajohnson/wish/{code}` where code doesn't match any wish → call `notFound()`
  - `/sarajohnson/listing/{code}` where code doesn't match any listing → call `notFound()`

### Auth-aware button href (optional enhancement)
- [ ] Server-render `/model/auth` instead of `/model` if no session cookie present
- [ ] Or leave default `/model` and let the auth guard handle it (simpler, equally correct)

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| User refreshes | Same page, same state |
| User bookmarks the 404 URL | Bookmark works, always shows 404 (URL is still wrong) |
| Bot crawler hits a random URL | 404 returned, bot moves on |
| User lands on `/sarajohnson` but Sara deleted her account | `/{slug}` route calls `notFound()` → this page renders |
| User lands on a URL with injected `<script>` | Server renders 404, no user content echoed to page, safe |
| JS disabled | Page renders, button works (plain `<a href>`) |
| Screen reader | Title + body + button are plain text, fully accessible |
| Print | Prints cleanly, no issues |

---

## 10. Related files

| File | Purpose | Status |
|---|---|---|
| `not_found_final.html` | **This page — universal 404** | **Final** |
| `email_error_final.html` | Specific case: bad email auth link | Final |
| `payment_link_no_longer_active_final.html` | Specific case: expired/deleted payment link | Final |
| `payment_gift_taken_already_final.html` | Specific case: wish already gifted | Final |

The 404 is the generic fallback. The three specific pages above handle known failure states with more context. Router logic prefers the specific pages when conditions match; falls back to 404 otherwise.

---

## 11. Testing instructions

| URL | Expected |
|---|---|
| `welovedecode.com/this-does-not-exist` | 404 page renders, HTTP 404 |
| `welovedecode.com/sarajohnson-typo` | 404 page (slug doesn't exist) |
| `welovedecode.com/dashbord` | 404 page (typo for /model) |
| Tap button | Navigates to `/model` (or `/model/auth` if not logged in) |
| Open dev tools → network tab | Status code = 404, not 200 |

---

## 12. Outstanding items

None. Design locked, copy locked, routing pattern standard.
