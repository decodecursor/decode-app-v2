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
 * "Other ambassadors" modal — lists the OTHER ambassadors who feature the
 * same professional as the tapped listing. Mechanics copied EXACTLY from
 * ProInfoModal: vanilla fixed overlay (no portal lib), parent-driven
 * useState open/close, internal `closing` flag + 200ms close animation,
 * focus-trap, Escape-to-close, iOS-safe body-scroll-lock, reduced-motion.
 *
 * Reads listing.otherAmbassadors (already hydrated server-side) — no fetch.
 * Purely visual: SVG icons + text, zero <video>, never touches the orb pool.
 */

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Mirrors ProInfoModal §11.2 — backdrop fade-out 150ms + 50ms stagger.
const CLOSE_ANIMATION_MS = 200

export function OtherAmbassadorsModal({
  listing,
  onClose,
}: {
  listing: PublicListingRow
  onClose: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

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

  // "Scroll for more" footer gates on the list actually overflowing its
  // scroll container. Measured on mount and on resize.
  useEffect(() => {
    const measure = () => {
      const el = listRef.current
      if (!el) return
      setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) requestClose()
  }

  const category = categoryText(listing)
  const cityLine = formatLocation(listing.professional_city, listing.professional_country)
  const ambassadors = listing.otherAmbassadors

  // ---- Style tokens (mirror ProInfoModal) ----
  const PINK = '#e91e8c'
  const BG = '#0a0a0a'
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
        aria-labelledby="other-ambassadors-name"
        className={closing ? 'decode-modal decode-modal--closing' : 'decode-modal'}
        style={{
          background: BG,
          borderRadius: '24px 24px 0 0',
          maxWidth: 420,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          color: TXT_PRIMARY,
        }}
      >
        {/* HERO — reuse the listing's already-projected pro fields */}
        <header style={{ padding: '24px 16px 6px', textAlign: 'center', flexShrink: 0 }}>
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
            id="other-ambassadors-name"
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

        {/* "endorsed by" label */}
        <p
          style={{
            fontSize: 13,
            color: PINK,
            textAlign: 'center',
            margin: '14px 0 8px 0',
            flexShrink: 0,
          }}
        >
          endorsed by
        </p>

        {/* LIST — each row is one full-width link to /{slug} */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            padding: '0 12px',
            minHeight: 0,
          }}
        >
          {ambassadors.map((amb) => (
            <AmbassadorRow
              key={amb.id}
              slug={amb.slug}
              name={`${amb.first_name} ${amb.last_name}`}
              coverPhotoUrl={amb.cover_photo_url}
              instagramHandle={amb.instagram_handle}
            />
          ))}
        </div>

        {/* "scroll for more" — only when the list overflows */}
        {overflowing && (
          <p
            style={{
              fontSize: 11,
              color: '#666',
              textAlign: 'center',
              margin: '8px 0 0 0',
              flexShrink: 0,
            }}
          >
            scroll for more
          </p>
        )}

        {/* CANCEL */}
        <div
          style={{
            padding: '14px 20px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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

function AmbassadorRow({
  slug,
  name,
  coverPhotoUrl,
  instagramHandle,
}: {
  slug: string
  name: string
  coverPhotoUrl: string | null
  instagramHandle: string | null
}) {
  return (
    <a
      href={`/${slug}`}
      className="decode-modal__amb-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 8px',
        borderRadius: 12,
        textDecoration: 'none',
        color: 'inherit',
        fontFamily: 'inherit',
      }}
    >
      <AmbassadorAvatar coverPhotoUrl={coverPhotoUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        {instagramHandle && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                width: 11,
                height: 11,
                stroke: '#777',
                strokeWidth: 2,
                fill: 'none',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                flexShrink: 0,
              }}
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span
              style={{
                fontSize: 12,
                color: '#777',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {instagramHandle}
            </span>
          </div>
        )}
      </div>

      {/* Chevron right */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          stroke: '#555',
          strokeWidth: 2,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          flexShrink: 0,
        }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  )
}

// 46px circle showing the FULL cover photo (object-fit:contain, never
// cropped), backed by a blurred cover-fit copy of the same image so the
// circle reads as full rather than bare. Falls back to a neutral person
// glyph when the cover photo is null.
function AmbassadorAvatar({ coverPhotoUrl }: { coverPhotoUrl: string | null }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 46,
        height: 46,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {coverPhotoUrl ? (
        <>
          {/* Blurred cover-fit fill */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverPhotoUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(8px)',
              transform: 'scale(1.2)',
              opacity: 0.55,
            }}
          />
          {/* Full uncropped image on top */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverPhotoUrl}
            alt=""
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </>
      ) : (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            stroke: '#666',
            strokeWidth: 1.8,
            fill: 'none',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </div>
  )
}
