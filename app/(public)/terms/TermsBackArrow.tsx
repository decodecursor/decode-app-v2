'use client'

import { getBrandUrl } from '@/lib/brand-url'

/**
 * Back arrow for /terms. Click handler prefers `history.back()` when
 * the user has prior navigation, falls back to the brand-url apex
 * when /terms was opened via direct link / bookmark / new-tab.
 *
 * Per terms_final_UI_Spec.md §3.3 + §7. Fallback `href={getBrandUrl()}`
 * keeps the no-JS path functional and lands fresh-tab visitors on
 * marketing apex (Slice 7A Q5) — relative `/` would resolve to legacy
 * auctions auth on the app subdomain.
 *
 * Sibling of PrivacyBackArrow at app/(public)/privacy/PrivacyBackArrow.tsx
 * (rule-of-two — Principle I extraction tracked as item 34(b) watch).
 */

export default function TermsBackArrow() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e.preventDefault()
      window.history.back()
    }
  }

  return (
    <a
      href={getBrandUrl()}
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </a>
  )
}
