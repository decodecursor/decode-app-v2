import type { Metadata } from 'next'
import { getBrandUrl } from '@/lib/brand-url'
import NotFoundClient from './NotFoundClient'

/**
 * Universal 404 catch-all rendered for any unmatched URL across the
 * app. Next.js automatically serves this with HTTP status 404 (correct
 * SEO behavior — search engines don't index, link checkers can detect
 * broken inbound links).
 *
 * Mockup: `_features/ambassador/page not_found_final.html` (+ spec).
 *
 * CTA destination — locked Slice 7A pre-flight Q5: terminal pages on
 * `app.welovedecode.com` are predominantly hit by the expired-link
 * visitor cohort (professionals + gifters), not ambassadors typing
 * wrong URLs. Mockup-spec's `/model` default would drop them on legacy
 * auctions auth on cold session. Use the brand-url helper instead so
 * the destination is configurable per env.
 *
 * Public route — no auth middleware, no fetch.
 */

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return <NotFoundClient brandUrl={getBrandUrl()} />
}
