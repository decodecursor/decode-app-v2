'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'
import { estimateRatingHistogram } from '@/lib/public/distribution-estimate'

/**
 * Pro Info modal — greenfield surface for Trust Stack Chunk 5. Opens when
 * the SquadRow middle region is tapped (handler wired in Chunk 4). Reads
 * pre-hydrated data off the listing row — no second fetch. Six sections,
 * line-by-line from decode_pro_info_modal.html per spec §8.
 *
 * Render path is purely visual: SVG icons + text + CSS-only distribution
 * bars. Zero <video> elements; the modal does not interact with the orb
 * pool or any media architecture (§13 Safety Rule 3 — orb video keeps
 * playing under the backdrop). Synchronous open handler, no async work.
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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Close-animation duration upper bound — backdrop fade-out 150ms + 50ms
// stagger. Matches §11.2.
const CLOSE_ANIMATION_MS = 200

// Distribution-bar grow trigger delay. Mirrors §11.3 — fires after the
// modal open animation lands (~50ms stagger + 200ms slide = 250ms).
const BARS_GROW_DELAY_MS = 250

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function ProInfoModal({
  listing,
  slug,
  onClose,
}: {
  listing: PublicListingRow
  slug: string
  onClose: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const firedOpenRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [barsGrown, setBarsGrown] = useState(false)

  const requestClose = useCallback(() => {
    setClosing((c) => {
      if (c) return c
      setTimeout(() => onClose(), CLOSE_ANIMATION_MS)
      return true
    })
  }, [onClose])

  // listing_modal_open — fire EXACTLY once per modal open. The useRef guard
  // covers React StrictMode's double-mount in dev and any incidental
  // re-render. Server dedupe via analyticsLimiter is belt-and-suspenders.
  useEffect(() => {
    if (firedOpenRef.current) return
    firedOpenRef.current = true
    fireModalEvent(slug, 'listing_modal_open', listing.id)
  }, [slug, listing.id])

  // Body scroll lock with iOS scroll-position preservation. The
  // position:fixed + top:-scrollY trick keeps the underlying page from
  // snapping to top on iOS Safari (overflow:hidden alone leaks the scroll
  // there). The width:100% guard prevents the body from collapsing to
  // intrinsic content width while fixed.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const scrollY = window.scrollY
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = prev.overflow
      document.body.style.position = prev.position
      document.body.style.top = prev.top
      document.body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Focus management: capture the trigger element on mount, focus the
  // first focusable inside the modal, restore focus on unmount. Trap Tab
  // cycling inside the modal; Escape closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = modalRef.current
      ? Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : []
    focusables[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key === 'Tab' && modalRef.current) {
        const current = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        )
        if (current.length === 0) return
        const first = current[0]
        const last = current[current.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [requestClose])

  // Distribution-bar grow trigger. Reduced-motion: render at final width
  // from the start (no delay flash). Standard: 250ms post-mount the
  // state flips, CSS transition handles the 1500ms ease-out cubic.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setBarsGrown(true)
      return
    }
    const t = setTimeout(() => setBarsGrown(true), BARS_GROW_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) requestClose()
  }

  // Derived view state
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
  const mapsUri = places?.googleMapsUri ?? null
  const phone = places?.internationalPhoneNumber ?? null
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
  const onSendWhatsappClick = () => {
    fireModalEvent(slug, 'listing_whatsapp_modal_click', listing.id)
    if (waDigits) window.open(`https://wa.me/${waDigits}`, '_blank', 'noopener')
  }

  // ---- Style tokens (mirror :root in decode_pro_info_modal.html) ----
  const PINK = '#e91e8c'
  const BG = '#0a0a0a'
  const CARD_BG = 'rgba(255, 255, 255, 0.04)'
  const CARD_BORDER = '#2a2a2a'
  const TXT_PRIMARY = '#ffffff'
  const TXT_SECONDARY = '#888888'
  const TXT_TERTIARY = '#555555'
  const TXT_SOFT = '#ddd'
  const TXT_MUTED = '#aaa'

  return (
    <div
      onClick={onBackdropClick}
      className={
        closing ? 'decode-modal-backdrop decode-modal-backdrop--closing' : 'decode-modal-backdrop'
      }
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-name"
        className={closing ? 'decode-modal decode-modal--closing' : 'decode-modal'}
        style={{
          background: BG,
          borderRadius: '24px 24px 0 0',
          maxWidth: 380,
          width: '100%',
          maxHeight: '90vh',
          overflowX: 'hidden',
          overflowY: 'auto',
          color: TXT_PRIMARY,
        }}
      >
        {/* SECTION 1 — HERO */}
        <header
          style={{
            padding: '24px 16px 22px',
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
                margin: '0 0 6px 0',
              }}
            >
              {category}
            </p>
          )}
          <h2
            id="modal-name"
            style={{
              fontSize: 20,
              color: TXT_PRIMARY,
              fontWeight: 500,
              margin: '0 0 4px 0',
              lineHeight: 1.2,
            }}
          >
            {listing.professional_name}
          </h2>
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
                cardBg={CARD_BG}
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
                cardBg={CARD_BG}
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
                cardBg={CARD_BG}
                cardBorder={CARD_BORDER}
                soft={TXT_SOFT}
              />
            )}
          </div>
        )}

        {/* SECTION 3 — AI SUMMARY */}
        {showSummary && (
          <section style={{ padding: '22px 20px 20px' }}>
            <p
              style={{
                fontSize: 10,
                color: TXT_SECONDARY,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: '0 0 12px 0',
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
                lineHeight: 1.2,
                margin: '0 0 10px 0',
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

        {/* SECTION 5 — SEND WHATSAPP */}
        {showSendWhatsapp && (
          <div style={{ padding: '0 20px 8px' }}>
            <button
              type="button"
              onClick={onSendWhatsappClick}
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
              }}
            >
              Send WhatsApp
            </button>
          </div>
        )}

        {/* SECTION 6 — CANCEL */}
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
            onClick={requestClose}
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
      </div>
    </div>
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
  width: 18,
  height: 18,
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
  cardBg,
  cardBorder,
  soft,
}: {
  href: string
  label: string
  icon: React.ReactNode
  pink: string
  cardBg: string
  cardBorder: string
  soft: string
}) {
  // tel: stays in-tab (matches mockup which omits target on tel:). External
  // links open in a new tab + noopener for security parity with SquadRow.
  const isTel = href.startsWith('tel:')
  return (
    <a
      href={href}
      target={isTel ? undefined : '_blank'}
      rel={isTel ? undefined : 'noopener'}
      className="decode-modal__quick-btn"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '14px 0',
        background: cardBg,
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
