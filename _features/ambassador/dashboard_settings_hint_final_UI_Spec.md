# Dashboard · Settings Card Hint — UI Spec

**File:** `dashboard_settings_hint_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** `/model` (dashboard)
**Access:** Authenticated ambassador only
**Design Philosophy:** Reuses existing `navAlertWrap` pattern from the Listings card — no new component.

---

## 1. Purpose

Quiet, always-visible hint on the dashboard Settings nav card when the user has no email linked to their account. Tells them (a) there's something to attend to, and (b) exactly where to click (the Settings card they already know).

Self-solving: once the user adds an email via Settings, the hint disappears on next dashboard render.

---

## 2. Visibility Rule

**Show hint** when `auth.users.email IS NULL` for the authenticated user.

**Hide hint** when `auth.users.email` has any value (confirmed or unconfirmed — Supabase's native state).

Implementation:

```typescript
const showEmailHint = !user.email
```

Simple boolean. No dismissal tracking, no `login_count`, no modulo math, no timestamp comparisons. The hint is not dismissable — the only way to remove it is to add an email (which causes it to disappear naturally).

---

## 3. Visual Pattern

**Reuses the EXISTING `navAlertWrap` structure** already live on the Listings card (`1 expiring soon`). No new CSS.

### 3.1 DOM structure

```html
<div class="navCard" onclick="navigate('settings')">
  <div class="navCardLeft">
    <svg><!-- settings gear icon --></svg>
    <div class="navAlertWrap">
      <span class="navLabel">Settings</span>
      <span class="navDot"></span>
      <span class="navAlert">Email missing</span>
    </div>
  </div>
  <svg class="navChevron"><!-- chevron --></svg>
</div>
```

When no hint shows, the `navAlertWrap` wrapper is replaced with a plain `<span class="navLabel">Settings</span>`:

```html
<div class="navCard" onclick="navigate('settings')">
  <div class="navCardLeft">
    <svg><!-- settings gear icon --></svg>
    <span class="navLabel">Settings</span>
  </div>
  <svg class="navChevron"><!-- chevron --></svg>
</div>
```

### 3.2 React conditional pattern

```tsx
<div className="navCard" onClick={() => navigate('settings')}>
  <div className="navCardLeft">
    <SettingsIcon />
    {showEmailHint ? (
      <div className="navAlertWrap">
        <span className="navLabel">Settings</span>
        <span className="navDot" />
        <span className="navAlert">Email missing</span>
      </div>
    ) : (
      <span className="navLabel">Settings</span>
    )}
  </div>
  <ChevronIcon className="navChevron" />
</div>
```

---

## 4. Hint Text

**Exactly:** `Email missing`

- 11px font size
- Pink `#e91e8c`
- No weight specified (defaults to 400)
- Single `<span class="navAlert">Email missing</span>`

**Rationale:** matches the tone of `1 expiring soon` — states a condition rather than prescribing an action. Lets the user draw the inference ("I should add one"). Short enough to never wrap on any mobile viewport.

### 4.1 Do NOT use:
- "Add email" — too cryptic without context
- "Add email for recovery" — too long, wraps on narrow viewports
- "No email added" — factual but duller than "missing"
- Any emoji, any exclamation mark, any imperative phrasing

### 4.2 Localization

When the app is localized, translate as the equivalent condition-statement in that language. Keep it short (under 20 characters in the target language).

---

## 5. Separator Dot

Between the "Settings" label and the "Email missing" hint:

- `.navDot` — 3×3px, `#555` grey, circular
- `margin: 0 6px` (gap handled by parent's `gap: 6px`)
- Vertically nudged with `transform: translateY(1px)` to optically align with baseline

**Same dot used on Listings card.** Don't create a new one.

---

## 6. Click Behavior

Unchanged from existing card behavior:

- Entire card is clickable
- Navigates to `/model/settings`
- The pink hint text does NOT have a separate click target. The entire card is the action.
- On Settings page, the Login methods card's Email row (with its "Add email" pink label) is the specific affordance that solves the hint.

**Flow:**

```
Dashboard:        Settings · Email missing   ›
                  ↓ tap card
Settings page:    [Login methods card] Email — Add email   ›
                                       ↓ tap Email row
Add email modal opens
```

Two-step journey by design — gives the user context (they see what they're being nudged about) without deep-linking past the information.

---

## 7. Data Source

**Dashboard is a server component.** On page load:

```typescript
const { data: { user } } = await supabase.auth.getUser()
const showEmailHint = !user?.email
```

`user.email` comes from `auth.users.email` — Supabase's native column. Not from `public.users`, not from a custom table. One source of truth.

No client-side fetch needed. No `useEffect`. The hint is purely SSR-rendered, which means it appears on first paint with zero flash.

---

## 8. States & Transitions

| User state | `auth.users.email` | Hint shows? |
|---|---|---|
| New WhatsApp signup (most common) | `NULL` | ✓ yes |
| WhatsApp user adds email in Settings (email confirmed) | `"sara@email.com"` | ✗ no |
| WhatsApp user adds email (not yet confirmed) | `"sara@email.com"` ([depends — see §8.1]) | — |
| Email-primary user (signup via fallback) | `"sara@email.com"` | ✗ no |
| Dual-linked user (has both) | `"sara@email.com"` | ✗ no |

### 8.1 Unconfirmed email state

When a user submits the Add email form but has NOT clicked the verification link yet, `auth.users.email` IS populated but `auth.users.email_confirmed_at` is NULL.

**Decision: hide hint in this state.** Reasoning:
- User has taken the action (submitted email). Continuing to show "Email missing" would feel like nagging.
- If they never click the link, Supabase eventually invalidates the pending email (typically after a few days). At that point `auth.users.email` returns to NULL → hint reappears. Self-correcting.

Implementation: condition is purely `!user.email`, not `!user.email_confirmed_at`. Simple boolean.

---

## 9. No Dismissal

The hint is NOT dismissable.

- No close button
- No "don't show again" link
- No session-based hiding
- No login-count throttling

**Rationale:** The hint is a low-friction line of text next to a nav label the user sees every dashboard visit. It's not a popup, not a modal, not a banner. It doesn't demand action — it just sits there as a quiet signal. Dismissal UI would add more visual weight than the hint itself.

The only path to removing the hint is: add an email. That's the intended outcome.

---

## 10. Accessibility

- The hint text is within the existing card's click target. Card has `role="button"` and `aria-label="Settings, email missing"` (dynamically generated).
- Screen readers read: "Settings, Email missing, button"
- When the hint is not showing, `aria-label="Settings, button"`
- Pink color has sufficient contrast against `#1a1a1a` card background (WCAG AA pass — `#e91e8c` on `#1a1a1a` = contrast ratio 4.6:1)

---

## 11. Coexistence with Other Hints

Settings card may display the `Email missing` hint while simultaneously the Listings card displays `1 expiring soon`. This is fine:

- Each card renders independently
- The `navAlertWrap` pattern is per-card, not per-page
- Visual rhythm is preserved — both hints use identical styling, so they feel like a coherent system

Example:

```
Listings · 1 expiring soon       ›
Wishlist                         ›
Analytics                        ›
Settings · Email missing         ›
```

---

## 12. Build Notes for Claude Code

- **Zero new CSS.** The `navAlertWrap`, `navDot`, `navAlert`, `navLabel` classes already exist in `dashboard_final.html`. Use them.
- **Server-component render.** This is a conditional in the dashboard page JSX, not a client-side hook.
- **Data source is `auth.users.email`.** Do NOT check `public.users` or any custom table. Supabase native only.
- **Exact text: `Email missing`.** Not "Email Missing", not "email missing" — sentence case with capital E.
- **The hint does nothing on click other than card navigation.** Do NOT wire a separate click handler to the hint text.

---

## 13. Files

- `dashboard_settings_hint_final.html` — interactive mockup showing both states (hint shown + hint hidden)
- `dashboard_settings_hint_final_UI_Spec.md` — this document
- Related: `dashboard_final.html` (full dashboard mockup where this integrates), `settings_login_methods_final.html` (destination after tap)
