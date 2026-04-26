'use client'

/**
 * Back arrow for /privacy. Click handler prefers `history.back()` when
 * the user has prior navigation, falls back to `/` when /privacy was
 * opened via direct link / bookmark / new-tab (no history).
 *
 * Per privacy_final_UI_Spec.md §3.2 + §7. The fallback `href="/"` keeps
 * the no-JS path functional (graceful degradation per spec §10).
 *
 * Inlined per page on rule-of-two (sibling /terms gets its own copy).
 * Rule-of-three would trigger Principle I extraction — log as item 34
 * watch in 7A closeout.
 */

export default function PrivacyBackArrow() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e.preventDefault()
      window.history.back()
    }
    // Else fall through — anchor href="/" navigates as fallback.
  }

  return (
    <a
      href="/"
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
