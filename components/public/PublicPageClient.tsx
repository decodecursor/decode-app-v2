'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicPageData } from '@/lib/public/slug-page-shape'
import { mediaPool } from '@/lib/public/media-pool'
import { PublicHeader } from './PublicHeader'
import { SquadRow } from './SquadRow'
import { WishesSection } from './WishesSection'
import { WallOfLoveSection } from './WallOfLoveSection'
import { MediaLightbox } from './MediaLightbox'
import { PublicFooter } from './PublicFooter'

/**
 * Public page orchestrator. Renders cover + My Beauty Squad (listings)
 * + My Beauty Wishlist (Slice 5D, gated on profile.gifts_enabled) +
 * My Wall of Love (gated on profile.gifts_enabled — Slice 5D's
 * "independent of toggle" decision SUPERSEDED; toggle now controls
 * the whole gifting surface) + footer. Tapping a squad-row play
 * button opens the MediaLightbox for that listing.
 *
 * Slice 4D: fires public_page_view analytics on mount + click events
 * on child interactions. Server dedupes via analyticsLimiter so
 * Strict-Mode double-mount in dev doesn't inflate counts.
 *
 * Slice 5D: WishesSection + WallOfLoveSection both fetch via anon
 * supabase-js post-mount (Pattern 2 alignment). RLS policies on
 * model_wishes + model_wish_payments gate the reads server-side; the
 * gifts_enabled gate is enforced at the parent render gate here for
 * both sections (instant hiding when the toggle flips). Wall-of-love
 * RLS does NOT join on gifts_enabled today — client gate is UX-only,
 * data preserved untouched in DB; tightening RLS is item 41-adjacent
 * follow-up if needed.
 */
export default function PublicPageClient({
  data,
  shareUrl,
}: {
  data: PublicPageData
  shareUrl: string
}) {
  const [openListingId, setOpenListingId] = useState<string | null>(null)
  const [activeOrbId, setActiveOrbId] = useState<string | null>(null)
  const orbRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Lightbox open handler. Crucial: bless the media pool synchronously
  // inside this user-gesture call stack. iOS Safari only registers a
  // <video> as user-activated when play() fires inside the same task as
  // the user's tap — defer it (Promise.then, setTimeout, even async/await
  // before the play() call) and the gesture token is gone, leaving the
  // pool elements unable to autoplay unmuted on later src swaps.
  const onOpenMedia = useCallback(
    (listingId: string) => {
      const listing = data.listings.find((l) => l.id === listingId)
      const initialSrc =
        listing?.media_type === 'video' ? listing.video_url : null
      if (initialSrc) mediaPool.bless(initialSrc)
      setOpenListingId(listingId)
    },
    [data.listings],
  )

  const onOrbActivate = useCallback((id: string) => setActiveOrbId(id), [])
  const onOrbDeactivate = useCallback(() => setActiveOrbId(null), [])
  const registerOrbRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) orbRefs.current.set(id, el)
    else orbRefs.current.delete(id)
  }, [])

  // Single-active scroll-driven autoplay. One IO instance for the whole
  // page; on each fire, pick the entry whose center is closest to the
  // viewport center AND within MAX_CENTER_DIST. Hysteresis prevents
  // twitchy swaps on small scroll wobbles. rootMargin keeps the IO root
  // to the central 50% strip for efficiency; the explicit distance gate
  // is what enforces "actually centered" perception.
  // Re-bound on listings change so newly-mounted orbs join the watch.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const MAX_CENTER_DIST = 90  // ~90% of row stride (~101px)
    const HYSTERESIS_PX = 80    // ~80% of row stride; candidate must be this much closer to dethrone

    const observer = new IntersectionObserver(
      () => {
        // entries argument is intentionally ignored — we re-measure all
        // observed orbs on every fire, not just the ones whose threshold
        // crossed. IO is the trigger; live DOM is the source of truth.
        // Without this, partial-entries fires combined with the
        // MAX_CENTER_DIST gate caused inline autoplay to never sustain
        // (regression in 2cf04a2: most callbacks saw 1-2 stale entries
        // and deactivated, even when a different orb was actually
        // centered).
        const viewportCenter = window.innerHeight / 2
        const candidates: { id: string; distance: number }[] = []

        orbRefs.current.forEach((el, id) => {
          const rect = el.getBoundingClientRect()
          // Skip orbs entirely off-screen (above or below viewport).
          if (rect.bottom < 0 || rect.top > window.innerHeight) return
          const elementCenter = rect.top + rect.height / 2
          candidates.push({ id, distance: Math.abs(elementCenter - viewportCenter) })
        })

        if (candidates.length === 0) {
          setActiveOrbId(null)
          return
        }

        candidates.sort((a, b) => a.distance - b.distance)
        const closest = candidates[0]

        // Hysteresis: when an orb is currently active, in candidates, and
        // still within MAX_CENTER_DIST, only dethrone if the closest
        // candidate is materially better (≥HYSTERESIS_PX closer).
        setActiveOrbId((current) => {
          if (current) {
            const active = candidates.find((c) => c.id === current)
            if (active && active.distance <= MAX_CENTER_DIST) {
              if (active.distance - closest.distance < HYSTERESIS_PX) {
                return current  // sticky
              }
            }
          }
          return closest.distance <= MAX_CENTER_DIST ? closest.id : null
        })
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '-25% 0px -25% 0px',
      },
    )

    orbRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [data.listings])

  useEffect(() => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'public_page_view',
        slug: data.profile.slug,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
  }, [data.profile.slug])

  // squad_media_swipe_view — fires when an inline orb becomes the
  // single-active centered orb (scroll-driven autoplay). React's
  // setState dedup means activeOrbId staying the same does not retrigger
  // this effect; null transitions are skipped explicitly.
  useEffect(() => {
    if (!activeOrbId) return
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'squad_media_swipe_view',
        slug: data.profile.slug,
        target_id: activeOrbId,
      }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
  }, [activeOrbId, data.profile.slug])

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        background: '#000',
        color: '#fff',
        minHeight: '100vh',
      }}
    >
      <PublicHeader profile={data.profile} shareUrl={shareUrl} />

      <div style={{ padding: '20px 20px 8px', paddingBottom: '50vh' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>My Beauty Squad</div>

        {data.listings.length === 0 ? (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              fontSize: 13,
              color: '#666',
            }}
          >
            No listings yet
          </div>
        ) : (
          data.listings.map((l, i) => (
            <SquadRow
              key={l.id}
              listing={l}
              slug={data.profile.slug}
              isLast={i === data.listings.length - 1}
              onOpenMedia={onOpenMedia}
              isOrbActive={activeOrbId === l.id}
              onOrbActivate={() => onOrbActivate(l.id)}
              onOrbDeactivate={onOrbDeactivate}
              registerOrbRef={(el) => registerOrbRef(l.id, el)}
            />
          ))
        )}
      </div>

      {/* Wishlist — only when ambassador has gifts_enabled. Section
          self-hides on zero open wishes (no empty-state heading). */}
      {data.profile.gifts_enabled && (
        <WishesSection
          modelId={data.profile.id}
          slug={data.profile.slug}
          ambassadorFirstName={data.profile.first_name}
        />
      )}

      {/* Wall of Love — gated on gifts_enabled, mirroring WishesSection
          above. Slice 5D's "independent of toggle" decision SUPERSEDED:
          the toggle now controls the whole gifting surface (intake +
          history). Data in model_wish_payments is preserved untouched;
          re-enabling the toggle restores the wall instantly. Section
          also self-hides on zero completed payments. */}
      {data.profile.gifts_enabled && (
        <WallOfLoveSection modelId={data.profile.id} slug={data.profile.slug} />
      )}

      <PublicFooter />

      {openListingId && (
        <MediaLightbox
          listings={data.listings}
          initialListingId={openListingId}
          slug={data.profile.slug}
          onClose={() => setOpenListingId(null)}
        />
      )}
    </div>
  )
}
