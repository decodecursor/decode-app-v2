/**
 * Client IP extraction for server-side route handlers (Slice 5B-2,
 * hardening item 23).
 *
 * Two ambassador-side endpoints (/api/checkout/listing and
 * /api/analytics/track) had identical local copies of this 6-LOC
 * function. Slice 5C wish-checkout will be the third use, so extracting
 * one slice ahead of need keeps the rule-of-three honored.
 *
 * Vercel sets `x-forwarded-for` on every request that hits a serverless
 * function — the first comma-separated entry is the originating client
 * IP. Some upstream proxies set `x-real-ip` instead; we fall through to
 * that for cross-platform robustness. The `'unknown'` last-resort marker
 * exists so that Upstash rate-limit (and any other IP-keyed store)
 * still buckets unknown-IP traffic into a single key rather than NULL-
 * keying everything into a shared bucket.
 *
 * Accepts both standard `Request` and Next.js `NextRequest` — they
 * share the `.headers.get()` shape.
 */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (fwd) return fwd
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}
