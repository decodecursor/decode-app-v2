'use client'

/**
 * Ambassador Instagram button — top-left of the public page cover.
 *
 * Mirror of ShareButton.tsx (top-right): same 32×32 circle, same
 * rgba(0,0,0,0.35) bg + 8px backdrop blur, same div+role=button+
 * onKeyDown pattern (so iOS Safari's user-agent <button> styling
 * doesn't drift the visual). The only differences are the icon
 * (IG glyph copied verbatim from the checkout-page reference) and
 * the click handler (fires ambassador_instagram_click then opens
 * Instagram in a new tab).
 *
 * Hide-if-null: when instagramHandle is null/empty the component
 * returns null — the wrapper in PublicHeader.tsx is independent of
 * the share-button wrapper, so omitting this button doesn't shift
 * the share button.
 *
 * Analytics: inlined fetch matches ShareButton's pattern (no shared
 * helper — the duplication is intentional per existing convention
 * across ShareButton, SquadRow, ProInfoModal). keepalive: true so
 * the event survives the immediate new-tab open.
 */
export function AmbassadorInstagramButton({
  instagramHandle,
  slug,
  ambassadorName,
}: {
  instagramHandle: string | null
  slug: string
  ambassadorName: string
}) {
  // Strip leading @ defensively (DB stores without; setup form sanitizes
  // to bare username, but defense-in-depth for any direct edits).
  const handle = instagramHandle?.replace(/^@/, '') || null
  if (!handle) return null

  const onClick = () => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'ambassador_instagram_click', slug }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
    window.open(`https://instagram.com/${handle}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`Open ${ambassadorName}'s Instagram`}
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="#fff" />
      </svg>
    </div>
  )
}
