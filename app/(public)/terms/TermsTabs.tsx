'use client'

/**
 * Tabbed navigation for /terms — General | Beauty Pay | Deals Business
 * | Deals Client. Per terms_final_UI_Spec.md §3.2 + §7:
 *
 * - Pure JS, no framework state library — useState + useEffect only.
 * - Initial-tab read order: window.location.hash → ?tab= → 'general'.
 * - Tab click: switch active section + history.replaceState the URL
 *   hash (no history entry added — back button skips tab-switches).
 * - Smooth-scroll the page-frame to top on switch.
 * - All four sections render in the DOM at all times (display: none/
 *   block toggle) so search-engine crawlers, screen readers, and
 *   ctrl-F all reach every schedule. Spec §4 mandates this.
 *
 * Suspense boundary in page.tsx covers the useSearchParams() call
 * (Next 15 requirement).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

export type TabId = 'general' | 'a' | 'b' | 'c'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'a', label: 'Beauty Pay' },
  { id: 'b', label: 'Deals Business' },
  { id: 'c', label: 'Deals Client' },
]

interface TermsTabsProps {
  sections: Record<TabId, ReactNode>
}

function readInitialTab(): TabId {
  if (typeof window === 'undefined') return 'general'
  const hash = (window.location.hash || '').replace('#', '').toLowerCase()
  if ((TABS as { id: string }[]).some((t) => t.id === hash)) return hash as TabId
  try {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q && (TABS as { id: string }[]).some((t) => t.id === q.toLowerCase())) {
      return q.toLowerCase() as TabId
    }
  } catch {
    // Empty — bad URL, fall through.
  }
  return 'general'
}

export default function TermsTabs({ sections }: TermsTabsProps) {
  const [active, setActive] = useState<TabId>('general')
  const frameRef = useRef<HTMLDivElement | null>(null)

  // Resolve initial tab post-mount (server prerender renders General;
  // client swaps if URL points elsewhere). Avoids hydration mismatch
  // since the server has no access to window.location.
  useEffect(() => {
    setActive(readInitialTab())
  }, [])

  const handleTabClick = (id: TabId) => {
    setActive(id)
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const newHash = id === 'general' ? '' : `#${id}`
      window.history.replaceState(null, '', window.location.pathname + newHash)
    }
    if (frameRef.current?.scrollIntoView) {
      frameRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }

  return (
    <>
      <div ref={frameRef} className="tp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={`tp-tab${active === t.id ? ' active' : ''}`}
            onClick={() => handleTabClick(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tp-body">
        {(['general', 'a', 'b', 'c'] as TabId[]).map((id) => (
          <section
            key={id}
            id={`sec-${id}`}
            className={`tp-section${active === id ? ' active' : ''}`}
            style={{ display: active === id ? 'block' : 'none' }}
          >
            {sections[id]}
          </section>
        ))}
      </div>
    </>
  )
}
