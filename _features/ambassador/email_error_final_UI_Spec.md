# Email Error — UI Spec (FINAL)

**File:** `email_error_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/model/auth/email-error`
**Access:** Public, no authentication. Reached only via Supabase server-side redirect on a rejected email token.

---

## 1. Purpose

Single universal page shown when an email-related auth link fails for **any** reason. Replaces 4 separate error pages referenced in the original change-email spec (`email-link-expired`, `email-already-confirmed`, `email-link-invalid`, generic `error`) with one page that covers all cases.

The user-facing copy is identical across all 4 cases — from the ambassador's point of view, all failures mean the same thing: "this link won't do anything, get a new one."

---

## 2. Audience

**Ambassador users only.** External users (gifters, professionals) never receive email auth links in this system, so they can never land on this page.

| Email flow that can fail | Recipient |
|---|---|
| Magic-link login | Registered ambassador |
| Email change verification | Ambassador currently changing their email |
| Password reset (future) | Registered ambassador |

---

## 3. Scope of coverage

| Failure case | Trigger | Supabase response |
|---|---|---|
| **Expired** | Link clicked >10 minutes after it was sent | Token expired |
| **Already used** | Link already consumed (single-use tokens) | Token consumed |
| **Invalid** | Link tampered, malformed, or doesn't exist | Token invalid |
| **Generic error** | Supabase/network failure during verification | Any other failure |

All four resolve to this page. The optional `?reason=` query param lets analytics distinguish them, but the UI shows identical copy.

**Security rationale:** not telling the user *which* error happened prevents attackers from probing the system. "Invalid token" vs "expired token" leaks info. One generic message is safer. This matches Stripe, Auth0, and Supabase conventions.

---

## 4. Navigation — Full Map

### 4.1 Inbound (entry points)

| Source | Mechanism |
|---|---|
| Email magic-link click → Supabase rejects token | Supabase redirects to `/model/auth/email-error` (optionally with `?reason=` param) |
| Email change link click → Supabase rejects token | Same as above |
| Direct URL typed by user | Renders normally (stateless page, no harm) |

### 4.2 Outbound (single exit)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| "Go to login" button | `/model/auth` | Same | User signs in, can then retry the email change from Settings if that's what they were doing |

### 4.3 Backend reads / writes

**None.** Stateless page. No API calls. Optional analytics log of `reason` param on page load (fire-and-forget).

### 4.4 Browser back behavior

`history.replaceState()` called on load — removes this page from the history stack so the back button skips past it. Prevents the browser back → email client → click link → back here loop.

---

## 5. Data handling

### 5.1 URL format
```
/model/auth/email-error
/model/auth/email-error?reason=expired
/model/auth/email-error?reason=used
/model/auth/email-error?reason=invalid
```

### 5.2 Param validation

Only values `expired`, `used`, `invalid` are accepted. Anything else is ignored (treated as generic error). This prevents log spam from URL tampering.

```js
var VALID_REASONS = ['expired', 'used', 'invalid'];
var raw = params.get('reason');
var reason = (raw && VALID_REASONS.indexOf(raw) !== -1) ? raw : null;
```

### 5.3 Copy (locked)

| Element | Text |
|---|---|
| Title | `Link doesn't work` |
| Subtitle | `This email link is no longer valid.` / `Request a new one after signing in.` |
| Button | `Go to login` |

All four failure cases show identical copy.

---

## 6. Layout (top to bottom)

1. **Empty space** (160px padding-top)
2. **Title** — `Link doesn't work` (22px / 700, -0.2px letter-spacing)
3. **Subtitle** — 2 lines, 13px, `#888`, 1.6 line-height, 40px bottom margin
4. **Button** — `Go to login`, pink `#e91e8c`, 16px padding, 12px radius, 14px / 600

No status bar. No icon. No footer. No secondary links. Single-purpose page.

---

## 7. Color System

| Token | Hex | Usage |
|---|---|---|
| Pink | `#e91e8c` | Button background |
| White | `#fff` | Title, button label |
| Gray 888 | `#888` | Subtitle |
| Gray 1a1a1a | `#1a1a1a` | Frame border |
| Black | `#000` | Page background |

No green, no red, no semantic accents. Neutral by design — failures shouldn't feel dramatic.

---

## 8. Button behavior

| State | Trigger | Style |
|---|---|---|
| Idle | Default | Pink `#e91e8c`, clickable |
| Loading | Tap | Pink, 70% opacity, label → `Loading…`, further taps ignored |

`transition: filter` on hover, `transform: scale(0.99)` on active tap, matching the rest of the auth flow.

---

## 9. Build checklist for Claude Code

### Frontend
- [ ] Read `?reason=` from URL, validate against whitelist, ignore invalid values
- [ ] Fire analytics event on page load (fire-and-forget) — optional, for reason tracking
- [ ] Call `history.replaceState()` on load to skip this page on browser back
- [ ] Add loading state on button tap to prevent double-navigation
- [ ] No API calls — page is fully static

### Backend / Supabase config
- [ ] Configure Supabase Auth settings → all email-related redirects on failure point to `/model/auth/email-error`
- [ ] Append `?reason=expired|used|invalid` where Supabase can distinguish (optional — helps analytics)
- [ ] Do NOT include any sensitive info in the error URL (no token, no user ID, no email)

### Routing
- [ ] Route is public, no auth middleware
- [ ] `<meta name="robots" content="noindex">` already included — keeps page out of search

---

## 10. Edge cases

| Case | Behavior |
|---|---|
| User refreshes | Page re-renders identically, no state lost |
| User lands with `?reason=<script>` | Param fails validation, treated as generic error |
| User lands with no param | Renders normally (generic case) |
| User lands with valid reason | Renders normally (logged for analytics) |
| User bookmarks URL | No harm — page is stateless |
| User already logged in, taps button | Lands on `/model/auth` which detects session and redirects to `/model` |
| JS disabled | Page renders; button still navigates (plain `<a href>`) |
| Screen reader | Title + body + button are plain text, fully accessible |

---

## 11. Related files

| File | Purpose | Status |
|---|---|---|
| `auth_page_final.html` | Where user lands after tapping the button | Final |
| `change_email_confirmation_final.html` | Success page (the happy path this error page mirrors) | Final |
| `auth_magic_link_email_sent_final.html` | Where user came from before clicking the failed link | Final |
| `settings_UI_Spec.md` | Defines the email-change flow that can produce this error | Final |
| **`email_error_final.html`** | **This page — universal email error** | **Final** |

---

## 12. Testing instructions

Open the file in a browser:

| URL | Expected |
|---|---|
| `email_error_final.html` | Renders normally (generic case) |
| `email_error_final.html?reason=expired` | Same render, reason logged |
| `email_error_final.html?reason=used` | Same render, reason logged |
| `email_error_final.html?reason=invalid` | Same render, reason logged |
| `email_error_final.html?reason=hack` | Same render, reason ignored (failed validation) |
| Tap button | Navigates to `/model/auth` |
| Press browser back after landing | Skips this page (history replaced) |

---

## 13. Outstanding items

None. Route locked, copy locked, design locked, navigation locked.
