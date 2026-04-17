# Link No Longer Active — UI Spec (FINAL)

**File:** `payment_link_no_longer_active_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route (suggested):** TBD — dedicated URL session upcoming
**Access:** Public, no authentication. Pure terminal state, no user action possible.

---

## 1. Purpose

Shown when a visitor tries to open a payment-related link that is no longer valid. Acts as a neutral, generic terminal state — covers all cases where a link no longer leads to a usable checkout.

**Scope of coverage:**
| Link type | When this page shows |
|---|---|
| **Listing payment link** (professional checkout) | - Listing was hidden/deleted by Sara<br>- Link is past `payment_link_expires_at` (7 days after creation)<br>- Admin removed the listing |
| **Wish link** (gifter checkout) | - Wish was deleted by Sara before any gift was paid<br>- Wish link is past its expiry (if applicable) |
| **Any other payment-related link** | Link was explicitly revoked by admin |

**Out of scope (handled by different pages):**
| Case | Page shown instead |
|---|---|
| Wish was already paid by someone else | `payment_gift_taken_already_final.html` ("Someone was faster!") |
| Listing was successfully paid and link re-opened | Confirmation page `/listing/confirmation/{pi_xxx}` |

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| Listing payment link (expired) | Professional opens an old WhatsApp/email link → server detects `payment_link_expires_at < NOW()` → redirects or serves this page | **Common case.** Link is 7+ days old. |
| Listing payment link (deleted) | Sara hid/deleted the listing → professional clicks link anyway | Listing row may still exist but `status = 'hidden'` or `deleted_at IS NOT NULL` |
| Wish link (deleted) | Sara deleted her wish before anyone paid → someone who had the link clicks it | Wish row hard-deleted per policy |
| Admin revocation | Admin manually disabled a link for abuse/fraud reasons | Rare |

**Server logic:** all four cases hit the same server endpoint (`GET /api/payment-link/{token}` for listings, `GET /api/wishes/{wish_id}` for wishes). Server returns **410 Gone** in all cases. Frontend interprets 410 → renders this page.

### 2.2 Outbound (single exit)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "Go to WeLoveDecode" button | `/` (homepage) | Same | Always present. Pink CTA. Loading state on tap. |

**Why this exit choice:** unlike the wish-taken page (which knows the ambassador and links back to her page), this page has NO context about which link expired (could be any ambassador's listing or wish). Linking to the homepage is the only safe, generic exit.

### 2.3 Backend reads / writes

**None.** This page is pure static HTML. Zero API calls, zero JavaScript, zero state.

### 2.4 Resolved decisions

| Item | Decision |
|---|---|
| Authentication | None — public |
| Data source | **None.** No fetch, no params, no JS. Pure static HTML. |
| Route | TBD in dedicated URL session |
| Scope | **All invalid payment-related links** — listings (expired/hidden/deleted), wishes (deleted), admin-revoked. EXCLUDES "already paid by someone else" (that's `payment_gift_taken_already_final.html`). |
| Exit buttons | **"Go to WeLoveDecode"** button → links to `/` (homepage). Pink, full-width, with loading state on tap. Consistent with 404 + wish-taken pages. |
| Status bar ("9:41" / battery) | **Removed.** Consistent with all other final pages. |
| "Powered by WeLoveDecode" footer | **Removed.** Consistent with all other final pages. |
| Copy | Title: "Link no longer active" + subtitle: "This payment link is no longer valid." (13px, `#888`). Neutral, minimal, covers all reasons (expired / deleted / removed / revoked) without being admin-specific or repetitive. |
| Pronoun-specific wording | None used — generic copy works for all ambassadors |

---

## 3. Layout (top to bottom)

1. **Empty space** (160px padding-top)
2. **Title** — "Link no longer active" (22px bold, -0.2px letter-spacing, 14px bottom margin)
3. **Subtitle** — "This payment link is no longer valid." (13px, `#888`, line-height 1.6, 40px bottom margin)
4. **Action button** — "Go to WeLoveDecode" → `/` (pink `#e91e8c`, 16px padding, 12px radius, 14px / 600, full width, loading state on tap)

Matches visual language of `not_found_final.html` and `payment_gift_taken_already_final.html`.

---

## 4. Server-side contract

### 4.1 Listing payment link

`GET /api/payment-link/{token}`:

| Condition | Response |
|---|---|
| Token valid, listing `status='pending_payment'` | 200 OK + payload (show checkout) |
| Token valid, listing `status='active'` (already paid) | 409 Conflict → frontend redirects to `/listing/confirmation/{pi_xxx}` |
| Token past `payment_link_expires_at` | **410 Gone** → frontend navigates here |
| Token valid but listing hidden/deleted | **410 Gone** → frontend navigates here |
| Token doesn't exist | 404 Not Found (or 410 — same visual result) → frontend navigates here |

### 4.2 Wish link

`GET /api/wishes/{wish_id}`:

| Condition | Response |
|---|---|
| Wish valid, `is_granted=false` | 200 OK + payload (show checkout) |
| Wish valid, `is_granted=true` | 410 Gone → frontend redirects to `payment_gift_taken_already_final.html` (NOT this page) |
| Wish deleted | **410 Gone** → frontend navigates here |
| Wish doesn't exist | 404 Not Found → frontend navigates here |

### 4.3 Frontend routing

Wherever the checkout page is rendered (either professional `checkout_final.html` or gifter `checkout_for_wish-gifter_final.html`), the fetch handler should check for 410:

```js
fetch(endpoint)
  .then(function(res){
    if (res.status === 410) {
      // Link is no longer valid — any reason (expired, deleted, revoked)
      window.location.replace('/link-no-longer-active');
      return;
    }
    // ... normal flow
  });
```

**Note:** gifter checkout's 410 distinguishes "already paid" (→ "Someone was faster") from "deleted/expired" (→ this page). The server MUST include a reason flag in the 410 response:

```json
{
  "error": "wish_already_granted",
  "ambassador": { "slug": "sarajohnson", "first_name": "Sara" }
}
```
vs.
```json
{
  "error": "wish_not_available"
}
```

If `error === 'wish_already_granted'` → redirect to `payment_gift_taken_already_final.html`
Otherwise → redirect to this page.

---

## 5. Build checklist for Claude Code

### Frontend (this page)
- [ ] Minimal JS for button loading state only (prevents double-tap)
- [ ] No API calls
- [ ] No URL params processed
- [ ] Ensure route is public (no auth middleware)
- [ ] Button is real `<a href="/">` so it works with JS disabled

### Backend
- [ ] `GET /api/payment-link/{token}` returns 410 Gone when link is expired/deleted/revoked
- [ ] `GET /api/wishes/{wish_id}` returns 410 Gone with `error` field:
  - `"wish_already_granted"` → checkout redirects to `payment_gift_taken_already_final.html`
  - anything else (e.g. `"wish_not_available"`, `"wish_deleted"`) → checkout redirects to THIS page
- [ ] Routes: both listing checkout and gifter checkout must handle 410 responses consistently

### Routing
- [ ] Route for this page (URL TBD): must be public, no auth, no session
- [ ] No SEO/indexing (add `<meta name="robots" content="noindex">` optional — this page shouldn't rank in search)

---

## 6. Edge cases

| Case | Behavior |
|---|---|
| User refreshes the page | Same state, nothing fetched, renders instantly |
| User bookmarks the URL | No harm — page is same every time |
| User shares the URL with friends | Same page shown — no context leak, no PII |
| User opens the page and waits 1 hour | No change — page is purely static |
| User has JS disabled | Page renders normally — no JS used |
| Screen reader / accessibility tool | Title + body text are plain — fully accessible |
| Translation tool | All text is in DOM as `textContent` → translation tools work natively |
| Print | Page prints cleanly (no JS guards needed). No `@media print` overrides needed — content is minimal. |

---

## 7. Related files

| File | Purpose | Status |
|---|---|---|
| `checkout_final.html` | Listing checkout — redirects here on 410 | Final |
| `checkout_for_wish-gifter_final.html` | Gifter checkout — redirects here on 410 (except "already granted") | Final |
| `payment_gift_taken_already_final.html` | "Someone was faster" — for wish-already-granted case only | Final |
| **`payment_link_no_longer_active_final.html`** | **This page — generic terminal state** | **Final** |

---

## 8. Testing instructions

Open the file in a browser:
- No params needed → renders immediately
- Page never changes state
- No user actions possible

That's the entire test.

---

## 9. Outstanding items

- [ ] Final route URL (dedicated URL session)
- [ ] Optional: `<meta name="robots" content="noindex">` to keep this page out of search engines
