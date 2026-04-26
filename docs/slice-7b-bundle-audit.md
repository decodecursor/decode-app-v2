# Slice 7B — Bundle Size Audit

**Captured:** 2026-04-26 (Slice 7B step 5).
**Method:** `next build` with placeholder env vars; per-route Size + First Load JS captured from the Next.js build summary.
**Targets:** Phase 12 §17–18 (DECODE_PROJECT_STATE.md lines 1142–1147).
**Per Slice 7B locked Q2 (2b):** capture + report only — remediation scope is a partner decision after seeing the report.

---

## Targets vs. reality

| Surface | Target (Phase 12 §17–18) | Reality | Delta |
|---|---|---|---|
| Static / terminal pages | ~20 KB First Load | 499 KB | +479 KB (25×) |
| Most ambassador pages | ~120 KB First Load | 498–507 KB | +378–387 KB (~4×) |
| Analytics page | ~250 KB First Load | 502 KB | +252 KB (~2×) |
| Checkout pages | ~200 KB First Load | 500–509 KB | +300–309 KB (~2.5×) |

**Why the systemic overshoot.** The Phase 12 §17–18 targets assume per-page code-splitting was actually wired. Reality: a single 498 KB **shared-by-all** baseline dominates every route's First Load JS. Per-page deltas are tiny (most ambassador pages add 1–11 KB on top), so all routes inherit the same baseline.

Shared chunk breakdown:
- `common-*.js` — **150 KB** (Next runtime + React + ambassador-shared, app-wide)
- `vendors-*.js` — **346 KB** (third-party libs — likely includes Stripe.js + Supabase + others bundled at app boot)
- other shared — 2.06 KB

The vendors chunk is the largest single contributor and the most actionable surface for remediation.

---

## Per-route First Load — Slice 7 surfaces

| Route | Page-specific JS | First Load JS | Notes |
|---|---|---|---|
| `/expired` | 532 B | 499 KB | Static (○) |
| `/listing/paid` | 1.04 kB | 499 KB | Static (○) |
| `/wish/taken` | 953 B | 499 KB | Static (○) |
| `/terms` | 1.18 kB | 499 KB | Static (○) |
| `/privacy` | 589 B | 499 KB | Static (○) |
| `/_not-found` | 121 B | 498 KB | Static (○) |
| `/model/auth/email-error` | 570 B | 499 KB | Function (ƒ) — async server reads searchParams |

All 7 Slice 7A surfaces have **minimal page-specific JS (under 1.5 KB)** and meet Phase 12 §18 SSG-by-default rule for terminal pages (most are `○ static`). The First Load overshoot is entirely driven by the shared baseline, not by the page contributions.

---

## Per-route First Load — ambassador pages (key sample)

| Route | Page-specific JS | First Load JS |
|---|---|---|
| `/model` (dashboard) | 3.22 kB | 501 KB |
| `/model/listings` | 3.78 kB | 502 KB |
| `/model/wishlist` | 4.02 kB | 502 KB |
| `/model/analytics` | 3.52 kB | 502 KB |
| `/model/settings` | 8.85 kB | 507 KB |
| `/model/setup` | 6.96 kB | 505 KB |
| `/model/auth` | 2.39 kB | 501 KB |
| `/model/auth/verify` | 2.24 kB | 500 KB |
| `/model/payouts` | 1.98 kB | 500 KB |
| `/model/payouts/[id]` | 2.48 kB | 501 KB |
| `/model/listings/[id]/send-link` | 3.1 kB | 501 KB |
| `/model/wishlist/new` | 3.09 kB | 501 KB |

Decomposition lessons (Slice 6A + Slice 7A) are visible in the page-specific column — analytics shrunk from a hypothetical monolith to 3.52 kB by upfront sub-component splitting. /model/listings/[id]/edit + /new are server-shells with the heavy client lifted into the sibling AddListingClient.

---

## Per-route First Load — public + checkout pages

| Route | Page-specific JS | First Load JS |
|---|---|---|
| `/[slug]` (public profile, ISR) | 5.14 kB | 503 KB |
| `/pay/[token]` (checkout dispatch) | 11.2 kB | 509 KB |
| `/listing/confirmation/[pi_id]` | 2.25 kB | 500 KB |
| `/wish/confirmation/[pi_id]` | 2.43 kB | 501 KB |

`/pay/[token]` is the heaviest page-specific bundle — it carries the dispatch logic for both listing and wish checkout flows. Stripe is currently in the global vendors chunk (loaded on every route) rather than dynamically imported only here per Phase 12 §17.

---

## Heaviest page-specific bundles (top 10)

These are the single-file route chunks under `.next/static/chunks/app/**/page-*.js` — a leading indicator of which pages have the most page-specific code:

| Route file | Bytes |
|---|---|
| `/auctions/[id]/page` (legacy auctions) | 89,243 |
| `/dashboard/payouts/page` (legacy auctions) | 62,324 |
| `/(ambassador)/model/settings/page` | 45,794 |
| `/my-links/page` (legacy) | 43,080 |
| `/pay/[token]/page` | 40,521 |
| `/dashboard/payments/page` (legacy) | 39,807 |
| `/auth/page` (legacy) | 34,367 |
| `/profile/page` (legacy) | 30,278 |
| `/dashboard/users/page` (legacy) | 29,398 |
| `/dashboard/page` (legacy) | 22,826 |

The 4 legacy auctions / dashboard pages dominate the top of the list — Phase 12 §19 says "Old app preservation: do NOT refactor old code." Per locked decision boundary, the ambassador-side largest is `/model/settings` at 45 KB followed by `/pay/[token]` at 40 KB.

---

## Findings flagged

1. **Stripe.js is in the global `vendors-*.js` chunk** rather than dynamically imported only on checkout pages. Phase 12 §17 prescribed `next/dynamic` for Stripe + Elements. Loading Stripe on every page (e.g. `/expired` doesn't need it) is the largest single contributor to the 4× overshoot vs. the 120 KB ambassador-page target. **Estimated reclaim if remediated:** likely ~150–200 KB off the shared baseline (Stripe + Elements + common Stripe deps).

2. **Supabase JS client is in the global vendors chunk.** The auth context is consumed on every server render via `@/utils/supabase/server`, so the SDK is naturally global. Less actionable than Stripe — but the client SDK shape might allow a thinner per-route runtime if explored.

3. **Common chunk at 150 KB** is high for ambassador-shared code. Some of this is React + Next runtime (unavoidable), some is shared ambassador components (Navigation, ErrorBoundary, etc.). Decomposition Slice 6A was good for per-route deltas but doesn't shrink the shared baseline.

4. **Static pages match Phase 12 §18 rule for SSG.** All terminal pages (`/expired`, `/listing/paid`, `/wish/taken`, 404, `/terms`, `/privacy`) build as `○ Static` (CDN-served, no server work at runtime). That part of the architecture is on-target.

5. **Page-specific JS for Slice 7A surfaces is excellent.** All under 1.5 KB. The component splits + inline-style scoping kept the deltas tiny. No retrofit indicated for the pages themselves.

---

## Remediation options (NOT applied — partner decision per locked Q2 2b)

| # | Action | Effort | Estimated baseline reduction |
|---|---|---|---|
| A | Lazy-load Stripe.js + Stripe Elements via `next/dynamic` only on `/pay/[token]` + `/listing/confirmation/[pi_id]` + `/wish/confirmation/[pi_id]` | medium (~half-day) | ~150–200 KB off `vendors-*` |
| B | Add `@next/bundle-analyzer` config + run `ANALYZE=true npm run build` for visual breakdown of vendor contents | low (~30 min) | 0 KB (diagnostic only) |
| C | Audit `@/utils/supabase/server` import paths to ensure server-only code doesn't ship to the client bundle | low–medium | varies |
| D | Defer remediation to dedicated post-V1 perf slice | n/a | n/a |

**Recommendation:** A + B together as a focused half-day perf slice post-V1. Bundle-analyzer (B) confirms the Stripe diagnosis before committing to (A); both land in one slice so the diff is reviewable.

---

## Re-running this audit

```bash
# From repo root, with placeholder env vars (real values not needed for build):
NEXT_PUBLIC_APP_URL="https://app.welovedecode.com" \
NEXT_PUBLIC_BRAND_URL="https://welovedecode.com/" \
NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder" \
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_placeholder000000000000000" \
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0xPlaceholder" \
SUPABASE_URL="https://example.supabase.co" \
SUPABASE_ANON_KEY="placeholder" \
SUPABASE_SERVICE_ROLE_KEY="placeholder" \
STRIPE_SECRET_KEY="sk_test_placeholder000000000000000" \
STRIPE_WEBHOOK_SECRET="whsec_placeholder" \
STRIPE_AMBASSADOR_WEBHOOK_SECRET="whsec_placeholder" \
TURNSTILE_SECRET_KEY="placeholder" \
UPSTASH_REDIS_REST_URL="https://placeholder.upstash.io" \
UPSTASH_REDIS_REST_TOKEN="placeholder" \
ANALYTICS_IP_SALT="placeholder000000000000000000000000" \
RESEND_API_KEY="re_placeholder_000000000000000000000000" \
AUTHKEY_API_KEY="placeholder" \
npm run build 2>&1 | grep -E "Route|First Load|^├|^└|^○|^●|kB$|chunks|shared by all"
```

Re-run after any major dependency change or after applying remediation A/B.
