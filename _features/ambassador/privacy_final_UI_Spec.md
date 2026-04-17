# Privacy Policy — UI Spec (FINAL)

**File:** `privacy_final.html`
**Project:** DECODE — Beauty Pay + Beauty Deals platform
**Route:** `/privacy`
**Access:** Public — no authentication, SEO-indexable

---

## 1. Purpose

Legal Privacy Policy for the DECODE platform, governing how the company collects, uses, discloses, and safeguards personal information under **UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data**.

Applies uniformly to all platform users (Beauty Businesses, clients, website visitors). Single long-form page — no tabs, no sections requiring segmentation by audience. Unlike Terms of Service which has product-specific schedules, Privacy practices are identical for all audiences.

---

## 2. Content

Final legal text provided by DECODE. Last updated: **November 2025**.

Canonical identity used in the document:
- **DECODE LLC**, Dubai, United Arab Emirates
- Support contact: `support@welovedecode.com`
- Governing law: UAE

Key commitments baked into the document:
- No sale, trade, or rental of personal information
- No cookies or tracking technologies used
- AES-256 encryption for financial data
- PCI DSS Level 1 compliant payment processors
- 7-year retention for bank account details (UAE financial regulatory requirement)
- 30-day response window for user rights requests
- Children under 18 excluded from services

---

## 3. Navigation — Full Map

### 3.1 Inbound (entry points)

| Source | Element | Lands on |
|---|---|---|
| Terms of Service §5 (Data Protection) | inline "Privacy Policy" link | `/privacy` |
| Auth page footer | "Privacy Policy" link | `/privacy` |
| Settings page | "Privacy Policy" row | `/privacy` |
| Onboarding page | Checkbox reference | `/privacy` |
| Email footer (transactional + marketing) | "Privacy" link | `/privacy` |
| Direct URL / bookmark / search engine | — | `/privacy` |

### 3.2 Outbound (exits)

| Element | Destination | Tab | Notes |
|---|---|---|---|
| Back arrow (top-left, 32px circle) | `history.back()`; fallback to `/` if no history | Same | JS click handler with fallback `href="/"` for no-JS case |
| `/terms` link (inline, §17 acknowledgment) | Terms of Service | Same | Cross-link |
| `mailto:support@welovedecode.com` (§13 contact card) | Email client | Email client | Standard `mailto:` |

### 3.3 Backend reads / writes

**None.** Fully static page. No API calls, no session check, no state, no analytics beyond standard page-view.

---

## 4. Layout (top to bottom)

1. **Top bar** — 32px circular back arrow (left)
2. **Hero** — title "Privacy Policy" (22px / 700) + last-updated line "Last updated: November 2025" (9px / `#666`)
3. **Body** — 17 numbered sections with `<h2>` headings, nested `<h3>` subheadings in §2 and §5, paragraphs, bullet lists, bold-labeled items
4. **Contact card** (§13) — `DECODE LLC`, email, address grouped in a bordered card

The contact card in §13 is the only non-standard element — it groups the contact lines (name, email, address) in a dark card (`#0a0a0a` bg, `#1a1a1a` border, 10px radius) to visually emphasize the page's primary call-to-action: how to exercise data rights.

No tabs. No footer. Terms link is inline in §17 (not as a footer pair).

---

## 5. Color & Typography

Matches the DECODE / WLD design system. Identical tokens to the Terms page, so both legal pages feel like siblings.

| Element | Token |
|---|---|
| Page background (outer) | `#111` |
| Frame background | `#000` |
| Frame border | `2px #1a1a1a` |
| Title (22px / 700) | `#fff` |
| Last-updated (9px) | `#666` |
| Body text (13px / 1.65) | `#ccc` |
| `<h2>` (13px / 600) | `#fff` |
| `<h3>` (12px / 600) | `#fff` |
| `<strong>` | `#fff` weight 600 |
| Links — default | `#e91e8c` pink |
| Links — `mailto:` | `#ccc` body color (not pink) |
| Contact card bg | `#0a0a0a` |
| Contact card border | `1px #1a1a1a` |
| Contact label ("Email", "Address") | `#888` 11px |

---

## 6. Section inventory

| § | Heading | Notes |
|---|---|---|
| 1 | Introduction | UAE regulatory reference (Federal Decree-Law 45/2021) |
| 2 | Information we collect | Three subsections: 2.1 provided info, 2.2 auto-collected, 2.3 cookies (none used) |
| 3 | How we use your information | 11-item bullet list |
| 4 | Legal basis for processing | 4 bold-labeled grounds (contractual, consent, legitimate, legal) |
| 5 | Information sharing and disclosure | Four subsections: 5.1 service providers, 5.2 business transfers, 5.3 legal requirements, 5.4 protection of rights |
| 6 | Data security | Includes enhanced security subsection for financial data (AES-256, PCI DSS L1) |
| 7 | Data retention | 7-year bank data retention highlighted |
| 8 | Your rights and choices | 7 bold-labeled user rights |
| 9 | Marketing communications | Opt-out instructions |
| 10 | Third-party links and services | Disclaimer |
| 11 | Children's privacy | Under-18 exclusion |
| 12 | International data transfers | Cross-border clause |
| 13 | Contact us | **Contact card** with email + address |
| 14 | Changes to this Privacy Policy | Notification mechanism |
| 15 | Governing law and jurisdiction | UAE |
| 16 | Data protection compliance | Ongoing review commitment |
| 17 | Acknowledgment | Inline link to `/terms` |

Section numbers are part of the `<h2>` text content (e.g. "1. Introduction") — no CSS numbering. Editors can reorder without touching styles.

---

## 7. Interactions summary

| Element | Action | Result |
|---|---|---|
| Page load | — | Full page renders top-to-bottom; no async work |
| Back arrow | Tap | History back or fallback to `/` |
| Terms link (§17) | Tap | Navigate to `/terms` |
| Email link (§13 contact card, any inline) | Tap | Open mail client (body color, underlines on hover) |
| Scroll | Normal scroll | Browser-native |
| JS disabled | Load | Full page readable; back arrow becomes a plain link to `/` (graceful degradation) |
| Screen reader | Navigate | Semantic `<h2>`, `<h3>`, `<ul>`, `<strong>` announced correctly |

---

## 8. Build checklist for Claude Code

### Routing
- [ ] Next.js: `app/privacy/page.tsx` renders this HTML
- [ ] Public route, no auth middleware
- [ ] Allow SEO crawling (no `noindex`)
- [ ] Add `/privacy` to `sitemap.xml`

### Content lifecycle
- [ ] "Last updated" currently hardcoded as `November 2025` — update text when policy is revised
- [ ] Per §14, send email notification to users on material changes (requires email workflow)

### Cross-links
- [ ] Confirm `/terms` page exists (linked in §17)
- [ ] Confirm `support@welovedecode.com` mailbox is monitored and staffed to respond within 30 days (per §13)

### Legal review
- [ ] Legal counsel final review before production launch
- [ ] Verify Federal Decree-Law No. 45 of 2021 reference is current at launch
- [ ] Confirm 7-year bank data retention claim matches current UAE financial regulations
- [ ] Verify PCI DSS Level 1 claim applies to actual payment processors used
- [ ] Confirm AES-256 encryption claim is technically accurate for production systems

### SEO
- [ ] `<meta name="description">` already included
- [ ] Consider Open Graph tags (`og:title`, `og:description`) for social sharing

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| User opens in new tab (no history) | Back arrow falls back to `/` |
| User prints (Ctrl+P) | Page prints cleanly — full document in one go |
| JS disabled | All content accessible; back arrow works via fallback `href="/"` |
| Translation tool (e.g. Google Translate) | Works — all text is DOM text content |
| Screen reader | Semantic structure fully announced |
| Slow connection | Single HTML, no external assets — loads fast |
| User scrolls to §17 and taps Terms link | Navigates to Terms; back returns to Privacy |
| User exercises data rights (per §8) | Contacts via §13 email; 30-day response SLA per UAE law |

---

## 10. Related files

| File | Purpose | Status |
|---|---|---|
| **`privacy_final.html`** | **This page — Privacy Policy** | **Final** |
| `terms_final.html` | Sister legal page (tabbed, 4 sections) | Final |
| `auth_page_final.html` | Links here from footer | Final |
| `settings.html` | Links here from footer | Final |

---

## 11. Outstanding items

- [ ] Legal counsel sign-off on final text
- [ ] Confirm `support@welovedecode.com` inbox can handle data-rights requests within 30-day SLA
- [ ] If a dedicated `privacy@welovedecode.com` alias is preferred for data rights, update §13 before launch
