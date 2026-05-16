'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Drawer } from 'vaul'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'
import { estimateRatingHistogram } from '@/lib/public/distribution-estimate'

/**
 * Pro Info modal — Trust Stack Chunk 5 surface, now a vaul Drawer
 * (Radix Dialog under the hood). Mounts always; visibility is the
 * `open` prop driven by PublicPageClient state. vaul owns the slide,
 * overlay, drag-to-dismiss, scroll-vs-drag arbitration, body-scroll
 * lock, focus trap, Escape, and overlay-tap-close. The component is
 * pure render + analytics + a one-shot distribution-bar grow trigger.
 *
 * History: hand-rolled swipe handling broke iOS user-activation for
 * tel: and Universal Links three times (70e798c..e5d53a5), reverted in
 * c90e11b. vaul is purpose-built for this gesture surface — no custom
 * touch/pointer code.
 */

type ModalEvent = 'listing_modal_open' | 'listing_whatsapp_modal_click'

function fireModalEvent(slug: string, event_type: ModalEvent, target_id: string) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type, slug, target_id }),
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ })
}

// Distribution-bar grow trigger delay. Fires after the drawer's slide-in
// settles so the bars animate into their final widths rather than
// rendering at full extent on mount.
const BARS_GROW_DELAY_MS = 250

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function ProInfoModal({
  open,
  listing,
  slug,
  onClose,
}: {
  open: boolean
  listing: PublicListingRow | null
  slug: string
  onClose: () => void
}) {
  // Always-mounted pattern: this component stays mounted so vaul can
  // animate the drawer out without being yanked from the tree. We hold
  // two pieces of state ourselves: the last listing.id we fired analytics
  // for (so we don't re-fire on re-render) and the bars-grown latch
  // (so each open replays the grow animation).
  const firedForListingRef = useRef<string | null>(null)
  const [barsGrown, setBarsGrown] = useState(false)

  // listing_modal_open — fire exactly once each time the drawer
  // transitions to open with a listing in hand. Keyed on listing.id so
  // switching from listing A to listing B without an intermediate close
  // (theoretical, but cheap to handle) also re-fires. Close resets the
  // ref so the next open fires again.
  useEffect(() => {
    if (!open || !listing) {
      firedForListingRef.current = null
      return
    }
    if (firedForListingRef.current === listing.id) return
    firedForListingRef.current = listing.id
    fireModalEvent(slug, 'listing_modal_open', listing.id)
  }, [open, listing, slug])

  // Distribution bars grow trigger — runs each open, resets each close.
  // Reduced-motion: jump to grown state, skip the timer flash.
  useEffect(() => {
    if (!open) {
      setBarsGrown(false)
      return
    }
    if (prefersReducedMotion()) {
      setBarsGrown(true)
      return
    }
    const t = setTimeout(() => setBarsGrown(true), BARS_GROW_DELAY_MS)
    return () => clearTimeout(t)
  }, [open])

  return (
    <Drawer.Root
      open={open && listing !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.6)',
          }}
        />
        <Drawer.Content
          style={{
            background: '#0a0a0a',
            borderRadius: '24px 24px 0 0',
            // vaul applies position:fixed bottom:0 left:0 right:0 itself;
            // margin:0 auto + maxWidth centers the sheet horizontally
            // without colliding with vaul's transform-based drag math.
            margin: '0 auto',
            maxWidth: 420,
            width: '100%',
            maxHeight: '90vh',
            overflowX: 'hidden',
            overflowY: 'auto',
            color: '#fff',
            outline: 'none',
            zIndex: 101,
          }}
        >
          {listing && (
            <ProInfoModalBody
              listing={listing}
              slug={slug}
              barsGrown={barsGrown}
              onClose={onClose}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function ProInfoModalBody({
  listing,
  slug,
  barsGrown,
  onClose,
}: {
  listing: PublicListingRow
  slug: string
  barsGrown: boolean
  onClose: () => void
}) {
  const category = categoryText(listing)
  const cityLine = formatLocation(listing.professional_city, listing.professional_country)
  const places = listing.google_places_cache
  const reviewCount = listing.review_count ?? 0
  const hasRating =
    typeof listing.rating === 'number' && listing.rating > 0 && reviewCount > 0
  const histogram = useMemo(
    () => (hasRating ? estimateRatingHistogram(listing.rating, reviewCount) : null),
    [hasRating, listing.rating, reviewCount],
  )

  const websiteUri = places?.websiteUri ?? null
  // Google Places returns googleMapsUri as a legacy
  // maps.google.com/?cid=<num>&g_mp=<telemetry> URL, which iOS Safari
  // hands to the Maps app inconsistently. Build Google's documented
  // cross-platform universal-link instead. Fallback to legacy if
  // either piece is missing.
  const placeId = places?.id ?? null
  const displayName = places?.displayName?.text ?? null
  const mapsUri =
    placeId && displayName
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}&query_place_id=${encodeURIComponent(placeId)}`
      : (places?.googleMapsUri ?? null)
  // Strip everything except + and digits — some Android dialers reject
  // embedded spaces in tel: URIs (iOS forgives them).
  const phone = places?.internationalPhoneNumber?.replace(/[^0-9+]/g, '') || null
  const visibleQuickButtons =
    (websiteUri ? 1 : 0) + (mapsUri ? 1 : 0) + (phone ? 1 : 0)
  const showQuickRow = visibleQuickButtons > 0

  const customTrim = listing.review_summary_custom?.trim() || null
  const geminiTrim = listing.review_summary_gemini?.trim() || null
  const summary = customTrim ?? geminiTrim
  const showSummary = !!summary
  const showGeminiDisclosure = !customTrim && !!geminiTrim

  const showDemand = listing.messaged_30d > 0
  const showSendWhatsapp = !!listing.whatsapp_number
  const waDigits = listing.whatsapp_number?.replace(/[^0-9]/g, '') ?? ''

  // ---- Style tokens (mirror :root in decode_pro_info_modal.html) ----
  const PINK = '#e91e8c'
  const CARD_BORDER = '#2a2a2a'
  const TXT_PRIMARY = '#ffffff'
  const TXT_SECONDARY = '#888888'
  const TXT_TERTIARY = '#555555'
  const TXT_SOFT = '#ddd'
  const TXT_MUTED = '#aaa'

  return (
    <>
      {/* vaul's accessible drag affordance — replaces the prior decorative
          pill. Keyboard/screen-reader users get a focusable handle that
          announces as the drag target. */}
      <Drawer.Handle />

      {/* SECTION 1 — HERO */}
      <header
        style={{
          padding: '24px 16px 10px',
          textAlign: 'center',
        }}
      >
        {category && (
          <p
            style={{
              fontSize: 11,
              color: PINK,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '0 0 4px 0',
            }}
          >
            {category}
          </p>
        )}
        {/* Drawer.Title replaces the previous aria-labelledby="modal-name"
            mechanism — Radix Dialog requires it for a11y. Visual is
            unchanged: same h2-equivalent styles render inline. */}
        <Drawer.Title
          asChild
        >
          <h2
            style={{
              fontSize: 20,
              color: TXT_PRIMARY,
              fontWeight: 500,
              margin: '0 0 3px 0',
              lineHeight: 1.2,
            }}
          >
            {listing.professional_name}
          </h2>
        </Drawer.Title>
        {cityLine && (
          <p style={{ fontSize: 12, color: TXT_SECONDARY, margin: '0 0 22px 0' }}>
            {cityLine}
          </p>
        )}

        {hasRating && histogram && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
            }}
          >
            {/* Rating column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  color: TXT_PRIMARY,
                  fontWeight: 300,
                  lineHeight: 1,
                  marginBottom: 4,
                  letterSpacing: -1,
                }}
              >
                {listing.rating!.toFixed(1)}
              </div>
              <div
                aria-label={`${listing.rating!.toFixed(1)} out of 5 stars`}
                style={{
                  color: TXT_PRIMARY,
                  fontSize: 13,
                  letterSpacing: 1.5,
                  marginBottom: 4,
                }}
              >
                ★★★★★
              </div>
              <div style={{ fontSize: 10, color: TXT_SECONDARY, lineHeight: 1.3 }}>
                {reviewCount} Google
                <br />
                reviews
              </div>
            </div>

            {/* Distribution bars: 5 rows, 5★ → 1★ top-to-bottom */}
            <div
              role="list"
              aria-label="Star rating distribution"
              style={{
                gridColumn: '2 / 4',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '4px 8px',
                alignItems: 'center',
              }}
            >
              {[4, 3, 2, 1, 0].map((idx) => {
                const count = histogram[idx]
                const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0
                return (
                  <DistributionRow
                    key={idx}
                    star={idx + 1}
                    count={count}
                    widthPct={barsGrown ? pct : 0}
                    textMuted={TXT_MUTED}
                    textSecondary={TXT_SECONDARY}
                    pink={PINK}
                  />
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* SECTION 2 — QUICK ACTION ROW */}
      {showQuickRow && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${visibleQuickButtons}, 1fr)`,
            gap: 8,
            padding: '14px 16px',
          }}
        >
          {websiteUri && (
            <QuickButton
              href={websiteUri}
              label="Website"
              icon={
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </>
              }
              pink={PINK}
              cardBorder={CARD_BORDER}
              soft={TXT_SOFT}
            />
          )}
          {mapsUri && (
            <QuickButton
              href={mapsUri}
              label="Google Maps"
              icon={
                <>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </>
              }
              pink={PINK}
              cardBorder={CARD_BORDER}
              soft={TXT_SOFT}
            />
          )}
          {phone && (
            <QuickButton
              href={`tel:${phone}`}
              label="Phone"
              icon={
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              }
              pink={PINK}
              cardBorder={CARD_BORDER}
              soft={TXT_SOFT}
            />
          )}
        </div>
      )}

      {/* SECTION 3 — AI SUMMARY */}
      {showSummary && (
        <section style={{ padding: '10px 20px 20px' }}>
          <p
            style={{
              fontSize: 10,
              color: TXT_SECONDARY,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '0 0 4px 0',
            }}
          >
            AI summary of reviews
          </p>
          <p
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: TXT_PRIMARY,
              lineHeight: 1.5,
              margin: '0 0 4px 0',
              letterSpacing: '0.01em',
            }}
          >
            {`“${summary}”`}
          </p>
          {showGeminiDisclosure && (
            <p
              style={{
                fontSize: 10,
                color: TXT_TERTIARY,
                margin: 0,
                fontStyle: 'normal',
                fontFamily: 'inherit',
              }}
            >
              Summarized with Gemini
            </p>
          )}
        </section>
      )}

      {/* SECTION 4 — DEMAND LINE */}
      {showDemand && (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px 14px',
            fontSize: 11,
            color: PINK,
            fontWeight: 500,
            textAlign: 'center',
            margin: 0,
          }}
        >
          {listing.messaged_30d} people messaged in the last 30 days
        </p>
      )}

      {/* SECTION 5 — SEND WHATSAPP — native <a href> with no target so
          wa.me hands off to the WhatsApp app on iOS. */}
      {showSendWhatsapp && (
        <div style={{ padding: '0 20px 8px' }}>
          <a
            href={waDigits ? `https://wa.me/${waDigits}` : undefined}
            onClick={() =>
              fireModalEvent(slug, 'listing_whatsapp_modal_click', listing.id)
            }
            className="decode-modal__btn-primary"
            aria-label={`Send WhatsApp message to ${listing.professional_name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '16px 0',
              background: PINK,
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 0.2,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Send WhatsApp
          </a>
        </div>
      )}

      {/* SECTION 6 — CANCEL — closes via the same path as overlay-tap
          and Escape (vaul calls onOpenChange(false), which calls
          onClose). */}
      <div
        style={{
          padding: '14px 20px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="decode-modal__cancel"
          style={{
            color: TXT_SECONDARY,
            fontSize: 13,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  )
}

// --- Sub-components (private, inline) ---

function DistributionRow({
  star,
  count,
  widthPct,
  textMuted,
  textSecondary,
  pink,
}: {
  star: number
  count: number
  widthPct: number
  textMuted: string
  textSecondary: string
  pink: string
}) {
  return (
    <>
      <span
        role="listitem"
        aria-label={`${star} star: ${count} reviews`}
        style={{ fontSize: 10, color: textMuted, textAlign: 'right' }}
      >
        {star}
      </span>
      <div
        style={{
          height: 4,
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          className="decode-modal__d-fill"
          style={{
            height: '100%',
            background: pink,
            borderRadius: 2,
            width: `${widthPct}%`,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: textSecondary,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 24,
          textAlign: 'right',
        }}
      >
        {count}
      </span>
    </>
  )
}

const QUICK_ICON_STYLE: CSSProperties = {
  width: 16,
  height: 16,
  stroke: '#e91e8c',
  strokeWidth: 2,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function QuickButton({
  href,
  label,
  icon,
  pink,
  cardBorder,
  soft,
}: {
  href: string
  label: string
  icon: React.ReactNode
  pink: string
  cardBorder: string
  soft: string
}) {
  // All three quick-actions navigate same-tab: tel: launches the dialer,
  // the Maps universal link hands off to the Maps app, Website opens
  // in-tab. target="_blank" bypasses iOS Universal Link handoff and
  // also tripped the iOS 26.0.1 post-_blank interactivity-loss bug
  // (fixed in 3e8a3e7). rel="noopener" is only meaningful with
  // target="_blank" — both dropped.
  return (
    <a
      href={href}
      className="decode-modal__quick-btn"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '8px 0',
        background: '#0a0a0a',
        border: `0.5px solid ${cardBorder}`,
        borderRadius: 12,
        cursor: 'pointer',
        color: 'inherit',
        textDecoration: 'none',
        fontFamily: 'inherit',
        transition: 'filter 0.15s, background 0.15s',
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ ...QUICK_ICON_STYLE, stroke: pink }}>
        {icon}
      </svg>
      <span style={{ fontSize: 11, color: soft, fontWeight: 500 }}>{label}</span>
    </a>
  )
}
