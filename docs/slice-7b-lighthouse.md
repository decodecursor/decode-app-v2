# Slice 7B — Lighthouse Audit

**Captured:** 2026-04-26 (Slice 7B step 6). Scores landed via partner-side run on Chrome DevTools / pagespeed.web.dev.
**Per Slice 7B locked Q2 (2b):** capture + report only — remediation scope is a partner decision after seeing the report.
**Constraint at audit time:** the WSL build environment had no Chrome/Chromium installed and no `lighthouse` package on PATH; partner ran the audit and pasted scores into the tables below.

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

## Scores — captured 2026-04-26

Notes:
- **SEO 60 on /expired, /listing/paid, /wish/taken is expected + intentional** — those pages ship `<meta robots noindex>` per Slice 7A spec adherence. The Lighthouse SEO audit penalizes for `noindex` since its definition of "good SEO" assumes you want to be indexed. This is correct behavior; not a remediation target.
- **Best Practices 96 across the board** — solid. The −4 is consistent across pages, likely an HSTS / single-warning class shared by Vercel default headers.
- **Performance: all desktop ≥94, all mobile ≥74. No reds.** Mobile floor is `/yannijohnson` at 74 (only data-heavy public page in the audit; ISR + media). Within Phase 12 §17–18 soft targets, no remediation triggered. Bundle audit findings (`slice-7b-bundle-audit.md`) remain as the actionable surface if mobile Performance becomes a partner priority post-V1.
- **Accessibility 82–86 across all pages** — clusters tightly. Not red, not flagged as 7B remediation per locked Q2 (capture + report only). Consistent pattern across surfaces strongly suggests a single root cause: muted text contrast (likely `#888` and `#666` on `#000` failing WCAG AA 4.5:1 contrast ratio for normal text). **Logged as hardening item 35** — accessibility audit + contrast pass. Partner decides V1-polish vs. post-V1.

### Mobile

| URL | Performance | Accessibility | Best Practices | SEO | Date |
|---|---|---|---|---|---|
| `/yannijohnson` (sample slug) | 74 | 86 | 96 | 100 | 2026-04-26 |
| `/expired` | 78 | 85 | 96 | 60 ⓘ | 2026-04-26 |
| `/listing/paid?slug=&first=` | 83 | 85 | 96 | 60 ⓘ | 2026-04-26 |
| `/wish/taken?slug=&first=` | 81 | 85 | 96 | 60 ⓘ | 2026-04-26 |
| `/terms` | 83 | 85 | 96 | 100 | 2026-04-26 |
| `/privacy` | 95 | 82 | 96 | 100 | 2026-04-26 |

### Desktop

| URL | Performance | Accessibility | Best Practices | SEO | Date |
|---|---|---|---|---|---|
| `/yannijohnson` (sample slug) | 94 | 86 | 96 | 100 | 2026-04-26 |
| `/expired` | 99 | 85 | 96 | 60 ⓘ | 2026-04-26 |
| `/listing/paid?slug=&first=` | 97 | 85 | 96 | 60 ⓘ | 2026-04-26 |
| `/wish/taken?slug=&first=` | 98 | 85 | 96 | 60 ⓘ | 2026-04-26 |
| `/terms` | 100 | 85 | 96 | 100 | 2026-04-26 |
| `/privacy` | 99 | 82 | 96 | 100 | 2026-04-26 |

ⓘ SEO 60 = expected `noindex` penalty on terminal pages. Not a remediation target.

---

## Findings (post-run)

1. **No reds anywhere.** Lowest single score across both form-factors is mobile Performance on `/yannijohnson` at 74 — yellow but not red. Within Phase 12 §17–18 soft targets and locked Q2 capture-only.

2. **Accessibility cluster at 82–86 is the most actionable signal.** Same score pattern across all 6 URLs strongly suggests a single root cause rather than per-page bugs. The most likely culprit is color-contrast — the design system uses muted greys (`#888` and `#666`) on a `#000` background for subtitles + helper text, and those pairs fail WCAG AA 4.5:1 contrast for normal-size body text. Logged as **hardening item 35**.

3. **Mobile Performance floor is `/yannijohnson` at 74 with LCP 6.6s (red).** That's the only data-heavy public page in the audit (cover photo + media squad rows + Wishes + Wall of Love + analytics fire). PageSpeed diagnostics captured at run time identified the dominant LCP culprits:
   - Cover photo rendered as raw `<img>` or CSS background, NOT `next/image` — no responsive `srcset`, no automatic WebP/AVIF, no `priority` prop on the LCP element
   - Supabase Storage `Cache-Control` too short on `model-media` bucket — cover photo refetches on cold load instead of CDN-edge caching
   - Render-blocking requests ~750ms (likely CSS-in-JS layout-tree injection cost)
   - LCP request discovery flagged (image isn't preloaded/hinted)
   Top PageSpeed savings: image delivery ~309 KiB, cache lifetimes ~308 KiB, render-blocking ~750ms.
   **Logged as hardening item 36** — partner-scoped as Slice 7C-candidate (post-7B close, pre-V1 ship). Bundle audit's remediation A (lazy-load Stripe) is a natural sibling — both are public-page perf wins; could land together. The other 5 audit surfaces are static-text + one CTA; their mobile Performance scores (78–95) are not the LCP problem.

4. **Static pages green on desktop, yellow on mobile.** Desktop Performance on the 4 terminal pages clusters at 97–99. Mobile drops to 78–83 because of the same 498 KB shared baseline parse cost. Architecturally consistent.

5. **SEO scoring is correct for both audiences.** Indexable pages (`/{slug}`, `/terms`, `/privacy`) score 100. Terminal pages (`/expired`, `/listing/paid`, `/wish/taken`) score 60 because of the deliberate `noindex` meta — that's the spec, not a regression.

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
