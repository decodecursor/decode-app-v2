# Terms of Service — UI Spec (FINAL)

**File:** `terms_final.html`
**Project:** DECODE — Beauty Pay + Beauty Deals platform
**Route:** `/terms` (deep links: `/terms#a`, `/terms#b`, `/terms#c`, or `?tab=a|b|c`)
**Access:** Public — no authentication, SEO-indexable

---

## 1. Purpose

Legal Terms of Service for the DECODE platform. Covers **General Terms** applicable to all users plus three **Schedules** governing each product:

| Section | Audience | Scope |
|---|---|---|
| **General** | Everyone | Company, definitions, eligibility, IP, data protection, prohibited use, force majeure, amendments, dispute resolution, governing law, general provisions |
| **Schedule A — Beauty Pay** | Beauty Businesses using payment links | Merchant agreement: platform role, KYC, tiered fees, payouts, refunds, VAT, security, suspension, liability |
| **Schedule B — Deals Business** | Beauty Businesses listing on Beauty Deals | Partner agreement: marketplace role, 9% commission, VAT, Wednesday payouts, QR redemption, clawback, termination, liability |
| **Schedule C — Deals Client** | Clients buying vouchers | Purchase terms: marketplace nature, voucher validity (3 months), QR redemption, refund policy (3-day cooling-off + 24-hour post-redemption complaint window), liability |

Displayed as a tabbed single page — one URL covers all four audiences.

---

## 2. Content ownership

All legal text is final, provided by DECODE. Last updated: **March 2026**. Effective: upon account registration or first purchase.

Canonical company identity:
- **DECODE LLC**, Meydan Free Zone, Dubai, UAE
- Platform: `www.welovedecode.com`
- Support: `support@welovedecode.com`
- Governing law: UAE (DIAC arbitration, Dubai seat)

Key commercial terms baked into the document:
- Beauty Pay — tiered fees 7% (low) to 3.2% (AED 75k+)
- Beauty Deals — flat 9% commission on VAT-exclusive price
- Payouts — weekly, released every Wednesday
- Voucher validity — 3 months from purchase
- Client refund windows — 3 days change-of-mind + 24 hours post-redemption complaint
- Transaction data retention — 7 years (UAE regulatory)

---

## 3. Navigation — Full Map

### 3.1 Inbound (entry points)

| Source | Element | Opens |
|---|---|---|
| Auth page footer | "Terms" link | `/terms` (General) |
| Settings page | "Terms" row | `/terms` (General) |
| Onboarding page | Checkbox reference | `/terms` (General) |
| Email footer (transactional + marketing) | "Terms" link | `/terms` (General) |
| Beauty Pay signup confirmation | "Schedule A" deep link | `/terms#a` |
| Beauty Deals business signup confirmation | "Schedule B" deep link | `/terms#b` |
| Beauty Deals client checkout | "Schedule C" deep link | `/terms#c` |
| Privacy Policy page body | inline "Terms" link | `/terms` (General) |
| Direct URL / bookmark / search engine | — | Deep link respected |

### 3.2 In-page tab navigation

Four tabs in a horizontal row, analytics-page pattern (text-only, pink underline on active):

```
General  Beauty Pay  Deals Business  Deals Client
───────  ──────────  ──────────────  ────────────
  ↑ active tab gets the pink underline
```

Tap a tab:
1. Activates that section (others hidden via `display:none`)
2. Updates URL hash (`#a`, `#b`, `#c`; empty for General)
3. Smooth-scrolls to top of frame

Uses `history.replaceState` so browser back doesn't accumulate tab-switch entries — user returns to the page they came from, not to the previous tab.

### 3.3 Outbound (exits)

| Element | Destination | Mechanism |
|---|---|---|
| Back arrow (top-left) | `history.back()` if history exists, else `/` | JS click handler + fallback href `/` |
| `/privacy` link (inline, §5 data protection) | Privacy Policy page | Same tab |
| `www.welovedecode.com` link (inline, §1 who we are) | Canonical site | Same tab |
| `mailto:support@welovedecode.com` (multiple places) | Email client | Standard `mailto:` |
| `mailto:legal@welovedecode.com` (§8 contact) | Email client | Standard `mailto:` |

### 3.4 Backend reads / writes

**None.** Pure static page. No API calls, no session check, no state.

---

## 4. Layout (top to bottom)

1. **Top bar** — 32px circular back arrow (left)
2. **Hero** — title (22px / 700) + effective-date line (11px / `#666`) + last-updated (9px / `#666`)
3. **Tab bar** — 4 text tabs, 1px bottom border across full row, pink 1.5px underline on active
4. **Active section body:**
   - For General: intro paragraph + bullet list of schedules + numbered sections (§1–§11)
   - For Schedules A/B/C: header block (pink "Schedule X" label + title + sub-description) + numbered sections

All four sections stay present in the DOM, toggled via `display:none` / `display:block`. This means:
- Search engines index all content
- Screen readers can navigate all 4 sections
- Content is printable by switching tabs

---

## 5. Color & Typography

Matches the DECODE / WLD design system used across Settings, Analytics, and Auth pages.

| Element | Token |
|---|---|
| Page background (outer) | `#111` |
| Frame background | `#000` |
| Frame border | `2px #1a1a1a` |
| Title (22px / 700) | `#fff` |
| Effective line (11px) | `#666` |
| Last-updated (9px) | `#666` |
| Tab idle | `#777` weight 600 |
| Tab hover | `#aaa` |
| Tab active | `#fff` + `1.5px solid #e91e8c` underline |
| Tab row bottom border | `1px #1f1f1f` |
| Body text (13px / 1.65) | `#ccc` |
| Intro paragraph | `#aaa` |
| `<h2>` (13px / 600) | `#fff` |
| `<h3>` (12px / 600) | `#fff` |
| `<strong>` | `#fff` weight 600 |
| Links — default | `#e91e8c` pink |
| Links — `mailto:` | `#ccc` (body color, not pink) |
| Schedule badge ("Schedule A" etc) | `#e91e8c` plain text, 11px weight 600 |
| Schedule title | `#fff` 16px weight 700 |
| Schedule sub-description | `#ccc` 13px (same as body) |
| Table header | `#1c1c1c` bg, `#fff` text, 11px uppercase |
| Table row | `#ccc` text, `1px #1f1f1f` dividers |
| Table total row | `#161616` bg, `#fff` text, weight 600 |

---

## 6. Tables (3 in the document)

| Location | Content | Layout |
|---|---|---|
| Schedule A §3.2 | Beauty Pay fee table (8 rows): service-amount bands → fee percentage | 2 columns |
| Schedule B §3.3 | Commission calculation example (5 rows, 2 highlighted totals): offer price, VAT, client total, commission, amount due | 2 columns |
| Schedule C §3 | Refund policy (3 rows, 3 columns): situation / window / resolution | 3 columns |

All tables wrap in `.tp-table-wrap` with rounded corners + 1px border matching frame palette.

---

## 7. Tab behavior (detail)

Pure JS, no framework. Key logic:

```js
TABS = ['general','a','b','c']

// On load:
//   Read URL hash (#a/#b/#c) or ?tab= query param
//   If valid → activate that tab
//   Else → default 'general'

// On tab click:
//   Switch visible section
//   Update URL hash via history.replaceState (no history entry added)
//   Smooth-scroll frame to top

// On back arrow click:
//   If history.length > 1 → history.back()
//   Else → window.location.href = '/'
//   (Fallback href='/'  works even if JS disabled)
```

### Deep-linking URLs

| URL | Opens |
|---|---|
| `/terms` | General |
| `/terms#a` | Schedule A (Beauty Pay) |
| `/terms#b` | Schedule B (Deals Business) |
| `/terms#c` | Schedule C (Deals Client) |
| `/terms?tab=a` | Schedule A (query-param fallback for emails) |
| `/terms?tab=b` | Schedule B |
| `/terms?tab=c` | Schedule C |

---

## 8. Interactions summary

| Element | Action | Result |
|---|---|---|
| Page load | — | Read hash/query param → activate correct tab |
| Back arrow | Tap | History back or fallback to `/` |
| Any tab | Tap | Switch section, update URL hash, smooth-scroll to top |
| Body link (non-mailto) | Tap | Navigate (pink, underlined on hover) |
| Email link | Tap | Open mail client (body color, underlined on hover) |
| Table row | — | Not interactive (reference only) |
| JS disabled | Load | All 4 sections visible stacked — graceful degradation |
| Screen reader | Navigate | Semantic `<h2>`, `<h3>`, `<ul>`, `<table>` announced |

---

## 9. Build checklist for Claude Code

### Routing
- [ ] Next.js: `app/terms/page.tsx` renders this HTML
- [ ] Public route, no auth middleware
- [ ] Allow SEO crawling (no `noindex`)
- [ ] Add `/terms` to `sitemap.xml`
- [ ] Support hash-based deep linking (default Next.js behavior works)
- [ ] Support `?tab=` query param as fallback for email links

### Content lifecycle
- [ ] "Last updated" date currently hardcoded as `March 2026` — update on each revision
- [ ] Consider moving to a CMS field or config value if revisions become frequent

### Cross-links
- [ ] Confirm `/privacy` page exists before launch (referenced inline)
- [ ] Confirm `support@welovedecode.com` and `legal@welovedecode.com` are provisioned
- [ ] Confirm `www.welovedecode.com` is live and canonical

### Legal review
- [ ] Legal counsel final review before production launch
- [ ] Verify UAE decree-law references (No. 8/2017 for VAT, No. 45/2021 for Personal Data)
- [ ] Confirm DIAC as arbitration body is current
- [ ] Verify Meydan Free Zone registration details
- [ ] **Reconcile complaint window inconsistency**: Schedule B §7.1 says "48 hours" post-redemption; Schedule C §2.3 and §3 say "24 hours" — legal team to align

### SEO
- [ ] `<meta name="description">` already included
- [ ] Consider Open Graph tags (`og:title`, `og:description`) for social sharing

---

## 10. Edge cases

| Case | Behavior |
|---|---|
| User lands via `/terms#a` and taps General tab | Activates General, updates URL to `/terms` |
| User bookmarks `/terms#b` | Bookmark reopens Schedule B |
| User opens `/terms` in new tab (no history) | Back arrow falls back to `/` |
| User prints (Ctrl+P) | Only active tab prints; user can switch tabs to print each |
| JS disabled | All 4 sections visible stacked (tabs don't filter); content remains accessible |
| Translation tool (Google Translate) | Works — all text is DOM text content |
| Screen reader | Semantic HTML elements all announced correctly |
| Slow connection | Single HTML page, no external assets — loads fast |
| Content updated mid-session | No effect until page reload (legal text doesn't auto-refresh) |

---

## 11. Related files

| File | Purpose | Status |
|---|---|---|
| **`terms_final.html`** | **This page — tabbed Terms of Service** | **Final** |
| `privacy_final.html` | Sister legal page (same template) | To build |
| `auth_page_final.html` | Links here from footer | Final |
| `settings.html` | Links here from footer | Final |

---

## 12. Outstanding items

- [ ] Build `/privacy` as sibling page — same tab-free design (single long page is fine for Privacy)
- [ ] Legal counsel sign-off on final text
- [ ] Reconcile 24h vs 48h complaint window across Schedules B and C
- [ ] Provision `legal@welovedecode.com` mailbox if not already live
