# Slice 7B — Lighthouse Audit

**Captured:** 2026-04-26 (Slice 7B step 6).
**Per Slice 7B locked Q2 (2b):** capture + report only — remediation scope is a partner decision after seeing the report.
**Constraint:** the WSL environment used to build Slice 7 has no Chrome/Chromium installed and no `lighthouse` package on PATH; this doc captures the audit *procedure* + targets and leaves score capture for the partner via Chrome DevTools or pagespeed.web.dev. Scores get pasted into the table below once captured.

---

## URLs to audit

All on `app.welovedecode.com` (production app subdomain). For each URL, run **mobile** + **desktop** profiles. Mobile is the priority — V1 traffic is dominantly iPhone Safari per Phase 1 #13.

| # | URL | Notes for the auditor |
|---|---|---|
| 1 | `https://app.welovedecode.com/sarajohnson` (or any live ambassador slug) | Real slug needed; `/{slug}` is ISR-cached, so first hit may be slower |
| 2 | `https://app.welovedecode.com/expired` | Static, no params |
| 3 | `https://app.welovedecode.com/listing/paid?slug=sarajohnson&first=Sara` | URL-param-driven |
| 4 | `https://app.welovedecode.com/wish/taken?slug=sarajohnson&first=Sara` | URL-param-driven |
| 5 | `https://app.welovedecode.com/terms` | Static, indexable |
| 6 | `https://app.welovedecode.com/privacy` | Static, indexable |

For comparison, also capture (already-shipped, Slice 4A):
| 7 | `https://app.welovedecode.com/[any-non-existent-path]` | Triggers `app/not-found.tsx`, status 404 |

---

## Targets

Lighthouse scores (out of 100 each):

| Category | Green | Yellow | Red (flag) |
|---|---|---|---|
| Performance | ≥ 90 | 50–89 | < 50 |
| Accessibility | ≥ 90 | 50–89 | < 50 |
| Best Practices | ≥ 90 | 50–89 | < 50 |
| SEO | ≥ 90 | 50–89 | < 50 |

Per-axis priorities:
- **Performance** — most likely to fail given the 498 KB shared baseline (see `slice-7b-bundle-audit.md`). Mobile slow-3G LCP ≥ 2.5 s, FCP ≥ 1.8 s would yellow-flag.
- **Accessibility** — public terminal pages should hit 95+ since they're text + one button. Profile + checkout pages are the test.
- **Best Practices** — should be near-perfect; flag any HTTPS / mixed-content / console-error issues.
- **SEO** — terminal pages are correctly `noindex` (per Slice 7A); they should NOT score 100 on SEO (the audit checks for crawler accessibility, which we deliberately suppress). Public pages (`/{slug}`, `/terms`, `/privacy`) should hit 100.

---

## How to run

### Option A — Chrome DevTools (recommended for partner-side, no install)

1. Open Chrome on a desktop or mobile-emulated device.
2. Navigate to the URL.
3. Open DevTools → Lighthouse tab.
4. Select **Mobile** + all 4 categories + Mode: Navigation.
5. Click "Analyze page load."
6. Capture all 4 scores + paste into the table below.
7. Repeat for **Desktop** profile.
8. Repeat for each URL.

### Option B — pagespeed.web.dev (browser, fastest)

1. Open https://pagespeed.web.dev/
2. Paste each URL.
3. Capture Mobile + Desktop scores (page shows both).
4. Paste into the table below.

### Option C — Lighthouse CLI (requires npm install + Chrome)

```bash
npx lighthouse "https://app.welovedecode.com/expired" \
  --preset=desktop --output=json --output-path=./lighthouse-expired-desktop.json --chrome-flags="--headless"
npx lighthouse "https://app.welovedecode.com/expired" \
  --form-factor=mobile --output=json --output-path=./lighthouse-expired-mobile.json --chrome-flags="--headless"
```

Repeat per URL, parse JSON for `categories.performance.score * 100` etc.

---

## Scores — fill in after capture

### Mobile

| URL | Performance | Accessibility | Best Practices | SEO | Date |
|---|---|---|---|---|---|
| `/{slug}` (e.g. `/sarajohnson`) | _ | _ | _ | _ | _ |
| `/expired` | _ | _ | _ | _ | _ |
| `/listing/paid?slug=&first=` | _ | _ | _ | _ | _ |
| `/wish/taken?slug=&first=` | _ | _ | _ | _ | _ |
| `/terms` | _ | _ | _ | _ | _ |
| `/privacy` | _ | _ | _ | _ | _ |
| 404 (`/typo-path`) | _ | _ | _ | _ | _ |

### Desktop

| URL | Performance | Accessibility | Best Practices | SEO | Date |
|---|---|---|---|---|---|
| `/{slug}` | _ | _ | _ | _ | _ |
| `/expired` | _ | _ | _ | _ | _ |
| `/listing/paid?slug=&first=` | _ | _ | _ | _ | _ |
| `/wish/taken?slug=&first=` | _ | _ | _ | _ | _ |
| `/terms` | _ | _ | _ | _ | _ |
| `/privacy` | _ | _ | _ | _ | _ |
| 404 | _ | _ | _ | _ | _ |

---

## Predicted findings (before run)

Based on the bundle audit (`slice-7b-bundle-audit.md`) — these are the most likely yellow/red flags:

1. **Performance on mobile slow-3G** — the 498 KB shared baseline + parse cost will likely push LCP past 2.5 s on slower connections. Predicted Performance score 60–80 mobile, 80–95 desktop. Remediation A from bundle audit (lazy-load Stripe) would lift this directly.

2. **Largest Contentful Paint** — likely flagged on `/{slug}` because the cover photo is the LCP element and may not have `priority` set or a sized placeholder.

3. **CLS (Cumulative Layout Shift)** — the public profile renders sections (Wishes, Wall of Love) post-mount via client fetch (Pattern 2). CLS could spike if those sections insert above-fold content. Worth watching but probably under the 0.1 threshold given they're below the cover hero.

4. **Static pages (terms / privacy / expired) should green across the board** on Performance + Accessibility. They're 499 KB First Load but most of that is cached after the first page in a session. Standalone Lighthouse runs simulate a cold load each time.

5. **SEO on terminal pages will score lower (~80–90)** because of the `noindex` meta — that's correct behavior, NOT a bug. Flag for the auditor's awareness.

---

## What to do with the findings

Per locked Q2 2b: **partner decides remediation scope after seeing scores.** This audit captures the data. If any score is red:

1. Paste the score + the page-specific failure reasons (from the Lighthouse "Diagnostics" section) below the table.
2. Surface the specific failure to the partner via Convention B (e.g. "Performance is 42 on mobile because LCP is 4.8s — fix is X / Y / Z").
3. Decide whether the fix lands as a hotfix this slice, a dedicated post-V1 perf slice, or as a deferred backlog item.

Don't auto-implement remediation without partner acknowledgment — Lighthouse fixes can be invasive (changing image strategies, adding `next/dynamic` boundaries, server-component conversions), and the partner's V1-launch timeline may favor "yellow but ship" over "green but delayed."

---

## Re-running

After the partner runs the audit, scores go in the tables above. After any remediation lands (whether bundle-audit's option A, an image optimization, etc.), re-run on the same URLs and compare.

This file is git-tracked so before/after captures live alongside the codebase.
