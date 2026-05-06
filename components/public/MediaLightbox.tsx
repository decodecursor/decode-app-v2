'use client'

import { useEffect, useMemo } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { LightboxDeck } from './LightboxDeck'

/**
 * Full-screen swipeable lightbox deck. Hosts <LightboxDeck> which
 * presents all active listings as vertical scroll-snap pages (TikTok
 * style). User taps an orb on /{slug}, deck opens at that listing's
 * page and lets them swipe up/down through the rest.
 *
 * Single-listing lightbox flow superseded by deck. Spec deviation vs.
 * public_page_final_UI_Spec.md §4.2 — partner-locked 2026-04-30, flagged
 * for PROJECT_STATE Phase 7 contract update at session close.
 *
 * Body scroll lock + Esc-to-close live here; everything else (per-page
 * chrome, mute toggle, photo carousel, virtualization) lives in
 * LightboxDeck and its child page components.
 */
export function MediaLightbox({
  listings,
  initialListingId,
  slug,
  onClose,
}: {
  listings: PublicListingRow[]
  initialListingId: string | null
  slug: string
  onClose: () => void
}) {
  // Filter to listings with displayable media. Mirrors what the public-
  // page Squad section renders. The orb that opens the deck is itself
  // tap-only when there's media, so this filter should match what's
  // actually visible on the page.
  const deckListings = useMemo(() => {
    return listings.filter((l) => {
      if (l.media_type === 'video') return !!l.video_url
      if (l.media_type === 'photos') return !!l.photo_url_1
      return false
    })
  }, [listings])

  // Body scroll lock + Esc-to-close. Deck has its own swipe gestures
  // so the lock prevents the page below from shifting underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (deckListings.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 100,
      }}
    >
      {/* Constrained frame — matches the public page's 420px mobile-frame
          width (PublicPageClient line 183). On desktop, the lightbox sits
          centered as a phone-shaped column with the modal's #000 backdrop
          extending to the viewport edges. On mobile (<=420px viewport)
          this collapses to full-width and is visually identical to before. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 420,
        }}
      >
        <LightboxDeck
          listings={deckListings}
          initialListingId={initialListingId}
          slug={slug}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
