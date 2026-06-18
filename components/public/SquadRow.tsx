'use client'

import type { MouseEvent } from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'
import { MediaOrb } from './MediaOrb'

/**
 * A single listing row in the "My Beauty Squad" list. Tap targets:
 *   - professional avatar → Instagram (fires listing_instagram_click)
 *   - WhatsApp badge → opens wa.me (fires listing_whatsapp_badge_click) — Trust Stack Chunk 4
 *   - middle body region (category + name + city + trust row) → opens Pro Info modal — Trust Stack Chunk 4
 *   - play-button circle → opens the media lightbox (fires listing_media_click)
 *
 * Spec: public_page_final_UI_Spec.md §4.2 + decode_trust_stack_ui_spec.docx §7.
 * Mockups: public_page_final.html lines 30-76 (base structure) +
 *   decode_listing_card_corrected_preview.html (Trust Stack additions).
 *
 * Analytics fires via /api/analytics/track with keepalive:true so the
 * request survives the target=_blank navigation (belt-and-suspenders —
 * the nav opens in a new tab anyway, so the current page stays open).
 * Server silently dedupes via analyticsLimiter (1/30s per IP+event).
 */
type ClickEvent =
  | 'listing_instagram_click'
  | 'listing_media_click'
  | 'listing_whatsapp_badge_click'
  | 'listing_ambassadors_badge_click'
  | 'listing_modal_open'

function fireClick(slug: string, event_type: ClickEvent, target_id: string) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type, slug, target_id }),
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ })
}

// Compact "Last msg" formatter — chooses the largest unit that yields a
// non-zero integer. Trust Stack §10 fallback when messaged_30d < threshold
// but the most recent message is within 7d. Returns null when older than 7d
// or absent.
function formatLastMsgAgo(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const diffMs = Date.now() - t
  if (diffMs < 0) return 'just now'
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  if (diffMs > SEVEN_DAYS) return null
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const MESSAGED_THRESHOLD = 10

export function SquadRow({
  listing,
  slug,
  ambassadorFirstName,
  isLast,
  onOpenMedia,
  onOpenInfo,
  onOpenOtherAmbassadors,
  isOrbActive,
  onOrbActivate,
  onOrbDeactivate,
  registerOrbRef,
}: {
  listing: PublicListingRow
  slug: string
  ambassadorFirstName: string
  isLast: boolean
  onOpenMedia: (listingId: string) => void
  onOpenInfo: (listingId: string) => void
  onOpenOtherAmbassadors: (listingId: string) => void
  isOrbActive: boolean
  onOrbActivate: () => void
  onOrbDeactivate: () => void
  registerOrbRef: (el: HTMLElement | null) => void
}) {
  // onOrbActivate is retained on the type for future re-introduction.
  // Hybrid orb mode (tap → lightbox, IO → inline play) doesn't need it.
  // Flagged for cleanup.
  void onOrbActivate
  const igUrl = `https://instagram.com/${listing.professional_instagram}`
  const onIgClick = () => fireClick(slug, 'listing_instagram_click', listing.id)
  const onMediaClick = () => {
    fireClick(slug, 'listing_media_click', listing.id)
    onOpenMedia(listing.id)
  }

  // Pro Info modal trigger — synchronous setState only this chunk.
  // Chunk 5 wires the actual <ProInfoModal /> mount + analytics fire.
  const onInfoClick = () => onOpenInfo(listing.id)

  // WhatsApp badge tap. stopPropagation FIRST per spec §13 Safety Rule 2
  // (the badge sits inside the av-wrap; today no parent onClick exists,
  // but the rule is belt-and-suspenders so future parent handlers can't
  // accidentally fire the IG link or open the modal). NO preventDefault —
  // native <a> nav must proceed so wa.me hands to the WhatsApp app on
  // iOS (window.open(_blank) bypassed the Universal Link handoff and
  // tripped the iOS 26.0.1 post-_blank interactivity-loss bug — same
  // root cause as the modal Maps/Phone fix in 3e8a3e7).
  const waDigits = listing.whatsapp_number?.replace(/[^0-9]/g, '') ?? ''
  // Prefill the WhatsApp box with a warm-lead attribution line naming the
  // page's ambassador (page owner — NOT the professional being messaged).
  // URL-encoded so the comma, spaces, and 💕 arrive intact. WhatsApp can't
  // auto-send by design — the visitor still taps send.
  const waMessage = `Hi, ${ambassadorFirstName} sent me 💕`
  const onWhatsappClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation()
    fireClick(slug, 'listing_whatsapp_badge_click', listing.id)
  }

  // Other-ambassadors badge tap. stopPropagation so the tap doesn't start
  // the orb video (the badge sits over the orb circle) or trigger any
  // card/row tap. Mirrors the Pro Info wiring: fire analytics, then open
  // the modal via the PublicPageClient handler.
  const onAmbassadorsClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    fireClick(slug, 'listing_ambassadors_badge_click', listing.id)
    onOpenOtherAmbassadors(listing.id)
  }

  // Trust row segment selection — graceful degradation per spec §10.
  // Demand segment cascade (priority order):
  //   1. messaged_30d ≥ 10              → "{N} in 30d"     + pulse
  //   2. messaged_30d ≥ 1 & last≤7d     → "Last msg Xd ago"
  //   3. messaged_30d = 0               → "New"            (always-on; hardening item 49)
  //   (else — 1-9 with stale last_msg)  → hidden
  // Pulse stays exclusive to state 1.
  const hasRating = typeof listing.rating === 'number' && listing.rating > 0
  const showMessagedCount = listing.messaged_30d >= MESSAGED_THRESHOLD
  const lastMsgLabel = showMessagedCount ? null : formatLastMsgAgo(listing.last_msg_at)
  const showLastMsg = !!lastMsgLabel
  const showNewState = listing.messaged_30d === 0
  const showMessagedSegment = showMessagedCount || showLastMsg || showNewState
  const showSeparator = hasRating && showMessagedSegment
  const showTrustRow = hasRating || showMessagedSegment
  const pulseActive = showMessagedCount

  return (
    <div
      style={{
        padding: '14px 0',
        borderTop: '1px solid #1a1a1a',
        borderBottom: isLast ? '1px solid #1a1a1a' : undefined,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}
    >
      {/* Avatar wrapper — av-wrap from reference HTML. position:relative
          for the WhatsApp badge overlay. The IG-link anchor is preserved
          intact inside; the badge is a sibling so its tap doesn't bubble
          to the anchor. */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Slice 7C item 35 fix 3: aria-label gives screen readers a
            discernible name for the link, since the child <img> has
            alt="" (decorative — name is in the sibling name <a> below). */}
        <a
          href={igUrl}
          target="_blank"
          rel="noopener"
          onClick={onIgClick}
          aria-label={`Visit ${listing.professional_name} on Instagram`}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            padding: 3,
            background: 'linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 100%)',
            boxSizing: 'border-box',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'block',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#000',
              border: '3px solid #1c1c1c',
              boxSizing: 'border-box',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {listing.professional_avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={listing.professional_avatar_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <span style={{ fontSize: 11, color: '#777' }}>Photo</span>
            )}
          </div>
        </a>

        {/* Trust Stack WhatsApp badge. Only rendered when the professional
            has a whatsapp_number on file. Inline ::before pulse via the
            sibling <span>; the parent uses overflow:visible so the pulse
            can scale past the badge bounds. */}
        {listing.whatsapp_number && (
          <a
            href={waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}` : undefined}
            onClick={onWhatsappClick}
            aria-label={`Message ${listing.professional_name} on WhatsApp`}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#25D366',
              border: '2.5px solid #000',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
              boxSizing: 'border-box',
              textDecoration: 'none',
            }}
          >
            {pulseActive && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  background: 'rgba(233, 30, 140, 0.15)',
                  animation: 'decode-pulse 2.4s ease-out infinite',
                  zIndex: -1,
                  pointerEvents: 'none',
                }}
              />
            )}
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                stroke: '#fff',
                strokeWidth: 1.8,
                fill: 'none',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
            >
              <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
              <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
            </svg>
          </a>
        )}
      </div>

      {/* Category + name + location + trust row. The whole region is
          the Pro Info modal trigger — synchronous setState only (spec
          §13 Safety Rule 1: no async work, no mediaPool touch). The
          name is a plain <span>: IG navigation is reserved for the
          avatar anchor so the region stays a single uniform tap zone. */}
      <div
        onClick={onInfoClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onInfoClick()
          }
        }}
        aria-label={`Open ${listing.professional_name} details`}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: 1,
            color: '#e91e8c',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 2.5,
          }}
        >
          {categoryText(listing)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, marginBottom: 1.5 }}>
          <span style={{ color: '#fff' }}>{listing.professional_name}</span>
        </div>
        <div style={{ fontSize: 12, color: '#777', lineHeight: 1.2 }}>{formatLocation(listing.professional_city, listing.professional_country)}</div>

        {showTrustRow && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              lineHeight: 1.2,
            }}
          >
            {hasRating && (
              <span style={{ flexShrink: 0 }}>
                ★ {listing.rating!.toFixed(1)} ({listing.review_count ?? 0})
              </span>
            )}
            {showSeparator && (
              <span style={{ color: '#fff', margin: '0 5px', flexShrink: 0 }}>·</span>
            )}
            {showMessagedSegment && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  flexShrink: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{
                    width: 12,
                    height: 12,
                    flexShrink: 0,
                    fill: '#fff',
                  }}
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                {showMessagedCount
                  ? `${listing.messaged_30d} in 30d`
                  : showLastMsg
                    ? `Last msg ${lastMsgLabel}`
                    : 'New'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Media orb — inline video playback for video listings, lightbox
          carousel for photo listings. data-orb-id keeps the page-level
          IntersectionObserver tied back to the listing row. */}
      <div
        ref={registerOrbRef}
        data-orb-id={listing.id}
        style={{ flexShrink: 0, position: 'relative' }}
      >
        <MediaOrb
          videoUrl={listing.media_type === 'video' ? listing.video_url : null}
          videoThumbnailUrl={
            listing.media_type === 'video'
              ? (listing.video_thumbnail_url ?? null)
              : null
          }
          posterUrl={
            listing.media_type === 'video'
              ? null
              : (listing.photo_url_1 ?? null)
          }
          hasPhotos={listing.media_type === 'photos' && !!listing.photo_url_1}
          isActive={isOrbActive}
          onTap={onMediaClick}
          onScrollPause={onOrbDeactivate}
          ariaLabel={`Play preview of ${listing.professional_name}`}
        />

        {/* Other-ambassadors badge — mirrors the WhatsApp badge's size and
            corner treatment but sits bottom-LEFT of the video circle. Only
            renders when other ambassadors feature this same pro. A sibling
            of MediaOrb (absolutely positioned over it) — MediaOrb itself is
            untouched. */}
        {listing.otherAmbassadorsCount > 0 && (
          <button
            type="button"
            onClick={onAmbassadorsClick}
            aria-label="Other ambassadors"
            style={{
              position: 'absolute',
              left: -2,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#0c0c0c',
              border: '2px solid #e91e8c',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                width: 13,
                height: 13,
                stroke: '#e91e8c',
                strokeWidth: 2,
                fill: 'none',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
