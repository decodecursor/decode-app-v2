'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import type { PublicListingRow } from '@/lib/public/slug-page-shape'
import { categoryText } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'

/**
 * Offer modal — price-based coupon (offer_modal_FINAL_B.html). Opens when
 * the SquadRow gift icon is tapped. Reads listing.offer (already hydrated
 * server-side) — no fetch. Mechanics copied EXACTLY from ProInfoModal:
 * vanilla fixed overlay (z100, no portal lib), parent-driven useState
 * open/close, internal `closing` flag + 200ms close animation, focus-trap,
 * Escape-to-close, iOS-safe body-scroll-lock. Reduced-motion handled by the
 * shared decode-modal CSS classes (same as OtherAmbassadorsModal).
 *
 * The ticket shows service + original/special price; the "% OFF" chip is
 * DERIVED here, never stored. "Book Now" hands off to the professional's
 * WhatsApp (same wa.me pattern as the SquadRow badge — an <a target=_blank>
 * so iOS keeps the Universal Link handoff). Zero <video>, never touches the
 * orb pool.
 */

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Mirrors ProInfoModal §11.2 — backdrop fade-out 150ms + 50ms stagger.
const CLOSE_ANIMATION_MS = 200

// Format an ISO date (YYYY-MM-DD) as "31 July 2026". Parse the parts in UTC
// so the day never shifts across the local timezone boundary.
function formatValidUntil(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function OfferModal({
  listing,
  ambassadorFirstName,
  onClose,
}: {
  listing: PublicListingRow
  ambassadorFirstName: string
  onClose: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)

  const requestClose = useCallback(() => {
    setClosing((c) => {
      if (c) return c
      setTimeout(() => onClose(), CLOSE_ANIMATION_MS)
      return true
    })
  }, [onClose])

  // Body scroll lock with iOS scroll-position preservation (position:fixed +
  // top:-scrollY). Identical to ProInfoModal — keeps the underlying page from
  // snapping to top on iOS Safari and from collapsing to intrinsic width.
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

  // Focus management: focus the first focusable inside the modal, trap Tab
  // cycling, Escape closes, restore focus to the trigger on unmount.
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

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) requestClose()
  }

  const offer = listing.offer
  // Defensive: parent only mounts this when listing.offer is present, but
  // guard so the modal never renders an empty coupon.
  if (!offer) return null

  const category = categoryText(listing)
  const cityLine = formatLocation(listing.professional_city, listing.professional_country)
  const validUntil = formatValidUntil(offer.valid_until)

  // Derived "% OFF" — never stored. Guard against null/zero original.
  const pct =
    offer.original_price && offer.special_price && offer.original_price > 0
      ? Math.round(
          ((offer.original_price - offer.special_price) / offer.original_price) * 100,
        )
      : null

  // Book Now → professional's WhatsApp. Same wa.me pattern as the SquadRow
  // badge: strip to digits, open via <a target=_blank> so iOS keeps the
  // Universal Link handoff (window.open(_blank) tripped the iOS handoff bug).
  // Prefill names the page's ambassador + this service/price.
  const waDigits = listing.whatsapp_number?.replace(/[^0-9]/g, '') ?? ''
  const bookMessage = `Hi, I'm interested in ${ambassadorFirstName}'s ${offer.service ?? ''} promotion for AED ${offer.special_price ?? ''}💕`
  const bookHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(bookMessage)}`
    : null

  // ---- Style tokens (mirror ProInfoModal + offer_modal_FINAL_B.html) ----
  const PINK = '#e91e8c'
  const BG = '#0a0a0a'
  const TICKET_BG = '#111111'
  const TXT_PRIMARY = '#ffffff'
  const TXT_SECONDARY = '#888888'

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
        aria-labelledby="offer-name"
        className={closing ? 'decode-modal decode-modal--closing' : 'decode-modal'}
        style={{
          background: BG,
          borderRadius: '24px 24px 0 0',
          maxWidth: 420,
          width: '100%',
          maxHeight: '90vh',
          overflowX: 'hidden',
          overflowY: 'auto',
          color: TXT_PRIMARY,
        }}
      >
        {/* HERO — reuse the listing's already-projected pro fields, no divider */}
        <header style={{ padding: '24px 16px 6px', textAlign: 'center' }}>
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
          <h2
            id="offer-name"
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
          {cityLine && (
            <p style={{ fontSize: 12, color: TXT_SECONDARY, margin: 0 }}>{cityLine}</p>
          )}
        </header>

        {/* COUPON TICKET — promo banner · service/price · chip · perk · expiry.
            Dashed pink border with a notch punched into each side at the
            internal divider. Mirrors offer_modal_FINAL_B.html. */}
        <div style={{ margin: '18px 16px 14px' }}>
          <div
            style={{
              position: 'relative',
              background: TICKET_BG,
              border: '1px dashed rgba(233, 30, 140, 0.5)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {/* PROMOTION banner */}
            <div
              style={{
                background: PINK,
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                textAlign: 'center',
                padding: 7,
              }}
            >
              Promotion
            </div>

            {/* TOP — service, original/special price, % OFF chip */}
            <div
              style={{
                position: 'relative',
                padding: '20px 18px 18px',
                textAlign: 'center',
                borderBottom: '1px dashed #2e2e2e',
              }}
            >
              {/* Notch cuts straddling the divider — BG circles over the border */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: -9,
                  bottom: -9,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: BG,
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: -9,
                  bottom: -9,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: BG,
                }}
              />

              {offer.service && (
                <div
                  style={{
                    fontSize: 13,
                    color: '#cfcfcf',
                    fontWeight: 500,
                    marginBottom: 8,
                  }}
                >
                  {offer.service}
                </div>
              )}
              {offer.original_price != null && (
                <span
                  style={{
                    display: 'block',
                    textDecoration: 'line-through',
                    textDecorationColor: 'rgba(255,255,255,0.38)',
                    color: '#aaa',
                    fontSize: 16,
                    marginBottom: 1,
                  }}
                >
                  AED {offer.original_price}
                </span>
              )}
              {offer.special_price != null && (
                <span
                  style={{
                    display: 'block',
                    color: TXT_PRIMARY,
                    fontWeight: 800,
                    fontSize: 30,
                    letterSpacing: '-0.5px',
                  }}
                >
                  AED {offer.special_price}
                </span>
              )}
              {pct != null && (
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      background: PINK,
                      color: '#000000',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.3px',
                      padding: '3px 10px',
                      borderRadius: 999,
                      marginTop: 10,
                    }}
                  >
                    {pct}% OFF
                  </span>
                </div>
              )}
            </div>

            {/* BOTTOM — perk row + expiry */}
            <div style={{ padding: '14px 14px 16px' }}>
              {offer.perk && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                    marginBottom: 10,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    style={{
                      width: 18,
                      height: 18,
                      flex: 'none',
                      stroke: PINK,
                      strokeWidth: 2,
                      fill: 'none',
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    }}
                  >
                    <polyline points="20 12 20 22 4 22 4 12" />
                    <rect x="2" y="7" width="20" height="5" />
                    <line x1="12" y1="22" x2="12" y2="7" />
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                  </svg>
                  <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
                    <b
                      style={{
                        display: 'block',
                        fontSize: 12.5,
                        color: TXT_PRIMARY,
                        fontWeight: 600,
                      }}
                    >
                      Including free
                    </b>
                    <span style={{ display: 'block', fontSize: 12, color: '#cfcfcf' }}>
                      {offer.perk}
                    </span>
                  </div>
                </div>
              )}
              {validUntil && (
                <div style={{ fontSize: 11, color: '#777', textAlign: 'center' }}>
                  Valid until {validUntil}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PRIMARY — "Book Now" hands off to the pro's WhatsApp. Rendered as
            an <a target=_blank> (iOS Universal Link handoff) when a number is
            on file; otherwise a disabled button so the modal still reads. */}
        <div style={{ padding: '8px 20px 4px' }}>
          {bookHref ? (
            <a
              href={bookHref}
              target="_blank"
              rel="noopener"
              className="decode-modal__btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '15px 0',
                background: PINK,
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 0.2,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                textDecoration: 'none',
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, fill: '#fff' }}>
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
              </svg>
              Book Now
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="decode-modal__btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '15px 0',
                background: '#3a2230',
                color: '#9a8a92',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 0.2,
                cursor: 'not-allowed',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            >
              Book Now
            </button>
          )}
        </div>

        {/* CANCEL */}
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
