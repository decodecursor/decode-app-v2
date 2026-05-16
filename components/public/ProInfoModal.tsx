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
 * Pro Info modal — Trust Stack Chunk 5 surface, vaul Drawer with
 * `modal={false}`. The modal={false} setting is mandatory: vaul's
 * default modal={true} engages a body inert/pointer-events lock that,
 * combined with always-mounted Root + conditionally-mounted body,
 * desynced and stuck on in 6014a3a — entire screen frozen. modal={false}
 * disables that body lock entirely; the screen cannot freeze.
 *
 * Trade-off of modal={false}: vaul stops auto-closing on overlay tap
 * and stops trapping focus on the page. Overlay-tap-close is wired
 * manually on Drawer.Overlay's onClick. Escape-to-close is still
 * provided by Radix under vaul via onOpenChange.
 *
 * Body is rendered UNCONDITIONALLY inside Drawer.Content (no inner
 * conditional mount based on `listing`). All listing accesses use
 * optional-chaining so the body is safe when listing is null. This
 * keeps vaul's component tree stable across state transitions —
 * exactly the desync that the prior implementation tripped over.
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

// Distribution-bar grow trigger delay. Fires after the drawer's
// slide-in settles so the bars animate into their final widths.
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
  // listing_modal_open — fire once each time (open, listing.id) goes
  // false→true. Keyed on listing.id so switching between listings
  // without an intermediate close still re-fires. Guard resets on
  // close so the next open fires again.
  const firedForListingRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !listing) {
      firedForListingRef.current = null
      return
    }
    if (firedForListingRef.current === listing.id) return
    firedForListingRef.current = listing.id
    fireModalEvent(slug, 'listing_modal_open', listing.id)
  }, [open, listing, slug])

  // Distribution bars grow — runs each open, resets each close.
  const [barsGrown, setBarsGrown] = useState(false)
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

  // ---- Derived view state — all null-safe so the body renders
  // unconditionally without crashing when listing is null. ----
  const category = listing ? categoryText(listing) : ''
  const cityLine = listing
    ? formatLocation(listing.professional_city, listing.professional_country)
    : null
  const places = listing?.google_places_cache
  const reviewCount = listing?.review_count ?? 0
  const hasRating =
    !!listing &&
    typeof listing.rating === 'number' &&
    listing.rating > 0 &&
    reviewCount > 0
  const histogram = useMemo(
    () =>
      listing && hasRating
        ? estimateRatingHistogram(listing.rating, reviewCount)
        : null,
    [listing, hasRating, reviewCount],
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

  const customTrim = listing?.review_summary_custom?.trim() || null
  const geminiTrim = listing?.review_summary_gemini?.trim() || null
  const summary = customTrim ?? geminiTrim
  const showSummary = !!summary
  const showGeminiDisclosure = !customTrim && !!geminiTrim

  const showDemand = (listing?.messaged_30d ?? 0) > 0
  const showSendWhatsapp = !!listing?.whatsapp_number
  const waDigits = listing?.whatsapp_number?.replace(/[^0-9]/g, '') ?? ''

  // ---- Style tokens ----
  const PINK = '#e91e8c'
  const CARD_BORDER = '#2a2a2a'
  const TXT_PRIMARY = '#ffffff'
  const TXT_SECONDARY = '#888888'
  const TXT_TERTIARY = '#555555'
  const TXT_SOFT = '#ddd'
  const TXT_MUTED = '#aaa'

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      modal={false}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          onClick={onClose}
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
            // vaul applies position:fixed bottom:0 left:0 right:0;
            // margin:0 auto + maxWidth centers without colliding with
            // vaul's transform-based drag math.
            margin: '0 auto',
            maxWidth: 420,
            width: '100%',
            maxHeight: '90vh',
            overflowX: 'hidden',
            overflowY: 'auto',
            color: TXT_PRIMARY,
            outline: 'none',
            zIndex: 101,
          }}
        >
          {/* vaul's accessible drag handle */}
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
            {/* Drawer.Title satisfies Radix a11y. Always rendered so
                the vaul component tree stays stable across listing
                transitions; text content falls back to '' when null. */}
            <Drawer.Title asChild>
              <h2
                style={{
                  fontSize: 20,
                  color: TXT_PRIMARY,
                  fontWeight: 500,
                  margin: '0 0 3px 0',
                  lineHeight: 1.2,
                }}
              >
                {listing?.professional_name ?? ''}
              </h2>
            </Drawer.Title>
            {cityLine && (
              <p style={{ fontSize: 12, color: TXT_SECONDARY, margin: '0 0 22px 0' }}>
                {cityLine}
              </p>
            )}

            {hasRating && histogram && listing && (
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
          {showDemand && listing && (
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

          {/* SECTION 5 — SEND WHATSAPP — native <a href> with no
              target so wa.me hands off to the WhatsApp app on iOS. */}
          {showSendWhatsapp && listing && (
            <div style={{ padding: '0 20px 8px' }}>
              <a
                href={waDigits ? `https://wa.me/${waDigits}` : undefined}
                onClick={() =>
                  fireModalEvent(
                    slug,
                    'listing_whatsapp_modal_click',
                    listing.id,
                  )
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

          {/* SECTION 6 — CANCEL — onClose triggers the same path as
              overlay tap and Escape. */}
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
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
  // Native same-tab <a href> — no target. _blank bypasses iOS
  // Universal Link handoff and trips the iOS 26.0.1 post-_blank
  // interactivity-loss bug (fixed in 3e8a3e7).
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
