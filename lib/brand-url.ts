/**
 * Brand homepage URL — used by terminal pages whose "Go to WeLoveDecode"
 * CTA needs to land on the canonical marketing apex (Carrd today,
 * full app post-apex-migration), NOT on `app.welovedecode.com/` which
 * resolves to the legacy auctions auth page.
 *
 * Locked Slice 7A pre-flight Q5: terminal pages are predominantly hit
 * by the expired-link visitor cohort (professionals + gifters whose
 * link domain is `app.welovedecode.com`). Sending them to legacy
 * auctions auth on a missed expectation is bad UX. Hard-coding apex
 * via env var preserves locked decision #7 (Phase 1 — relative paths
 * for apex-migration trivially) by parameterizing the destination
 * rather than hard-coding the URL.
 *
 * Default: `https://welovedecode.com/` (Carrd apex). Override via
 * `NEXT_PUBLIC_BRAND_URL` in Vercel env once apex migrates. Trailing
 * slash preserved so href concatenation is consistent.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so this helper works in
 * both server and client components without further wiring.
 */

const DEFAULT_BRAND_URL = 'https://welovedecode.com/'

export function getBrandUrl(): string {
  return process.env.NEXT_PUBLIC_BRAND_URL || DEFAULT_BRAND_URL
}
