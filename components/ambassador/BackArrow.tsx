'use client'

import { useRouter } from 'next/navigation'

/**
 * Canonical back-arrow primitive (Hardening item 34(b) extraction —
 * Slice 7A TermsBackArrow + PrivacyBackArrow + the in-app navigate-up
 * arrows hit rule-of-three under the batch (d) design contract). Single
 * source of truth for every page that needs an in-page back affordance.
 *
 * Visual: 32px circle, #1c1c1c bg, #262626 1px border, 14×14 chevron
 * centered, stroke-width 3 (yields ~2px visible stroke at the 14×14
 * size given the 0 0 24 24 viewBox — current Terms/Privacy declared 2
 * but rendered ~1.2px which read thin on live preview; partner-locked
 * 2px visible weight via the stroke-width amendment).
 *
 * Behavior: prefer history.back() when prior navigation exists;
 * otherwise fall back to `fallbackHref`. The `<a>` element keeps the
 * no-JS path functional via the href attribute. With JS, we always
 * preventDefault and route programmatically:
 *   - absolute URLs (apex via getBrandUrl) → window.location for a
 *     full-page nav out of the SPA
 *   - relative paths (/model, /model/listings, …) → router.push for
 *     SPA navigation, no full-page reload
 *
 * Cross-cuts ambassador + public surfaces. Living under
 * components/ambassador/ since 9 of 11 consumers are ambassador-side
 * and the visual chrome is the ambassador-app shape; Terms + Privacy
 * import across the boundary the same way they import getBrandUrl.
 */
export default function BackArrow({
  fallbackHref = '/',
  onClick,
  disableHistory = false,
}: {
  fallbackHref?: string
  onClick?: () => void
  disableHistory?: boolean
}) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (onClick) {
      onClick()
      return
    }
    if (!disableHistory && typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    if (fallbackHref.startsWith('http')) {
      window.location.href = fallbackHref
      return
    }
    router.push(fallbackHref)
  }

  return (
    <a
      href={fallbackHref}
      onClick={handleClick}
      aria-label="Back"
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#1c1c1c',
        border: '1px solid #262626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.15s, transform 0.05s',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </a>
  )
}
