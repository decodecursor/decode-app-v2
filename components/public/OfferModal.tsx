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
 * Offer modal — the locked B1 coupon design. Opens when the SquadRow gift
 * icon is tapped. Reads listing.offer (already hydrated server-side) — no
 * fetch. Mechanics copied EXACTLY from ProInfoModal: vanilla fixed overlay
 * (z100, no portal lib), parent-driven useState open/close, internal
 * `closing` flag + 200ms close animation, focus-trap, Escape-to-close,
 * iOS-safe body-scroll-lock. Reduced-motion handled by the shared
 * decode-modal CSS classes (same as OtherAmbassadorsModal).
 *
 * DISPLAY-ONLY: "Show redemption code" reveals a coming-soon note, NOT a
 * real code. Purely visual: text + CSS coupon ticket, zero <video>, never
 * touches the orb pool.
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
  onClose,
}: {
  listing: PublicListingRow
  onClose: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // "Show Redemption Code" → flip the label to "Coming soon" for 3s, then back.
  const revealCode = useCallback(() => {
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current)
    setShowCode(true)
    codeTimerRef.current = setTimeout(() => setShowCode(false), 3000)
  }, [])

  useEffect(() => () => {
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current)
  }, [])

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

  // ---- Style tokens (mirror ProInfoModal) ----
  const PINK = '#e91e8c'
  const BG = '#0a0a0a'
  const TXT_PRIMARY = '#ffffff'
  const TXT_SECONDARY = '#888888'
  const TXT_TERTIARY = '#555555'

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

        {/* COUPON TICKET — dashed pink border with a notch cut on each side */}
        <div style={{ padding: '24px 20px 8px' }}>
          <div
            style={{
              position: 'relative',
              border: `2px dashed ${PINK}`,
              borderRadius: 16,
              padding: '28px 20px',
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Notch cuts — BG-coloured circles punched into each side edge,
                vertically centred, sitting over the dashed border. */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: -14,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: BG,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -14,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: BG,
              }}
            />

            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: PINK,
                lineHeight: 1.05,
                letterSpacing: -1,
              }}
            >
              {offer.discount_label}
            </div>
            {offer.subtitle && (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: TXT_PRIMARY,
                  marginTop: 8,
                  lineHeight: 1.3,
                }}
              >
                {offer.subtitle}
              </div>
            )}
            {offer.detail && (
              <div
                style={{
                  fontSize: 12,
                  color: TXT_SECONDARY,
                  marginTop: 6,
                  lineHeight: 1.3,
                }}
              >
                {offer.detail}
              </div>
            )}
            {validUntil && (
              <div
                style={{
                  fontSize: 11,
                  color: TXT_TERTIARY,
                  marginTop: 14,
                }}
              >
                Valid until {validUntil}
              </div>
            )}
          </div>
        </div>

        {/* PRIMARY — "Show redemption code" reveals a coming-soon note, NOT
            a real code (no redemption logic yet). */}
        <div style={{ padding: '8px 20px 4px' }}>
          <button
            type="button"
            onClick={revealCode}
            aria-live="polite"
            className="decode-modal__btn-primary"
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
              boxSizing: 'border-box',
            }}
          >
            {showCode ? 'Coming Soon' : 'Show Redemption Code'}
          </button>
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
