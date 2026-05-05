'use client'

import type { ListingCardRow } from '@/lib/ambassador/listing-shape'
import { formatLocation } from '@/lib/format-location'

/**
 * Single bottom-sheet modal, two variants keyed off `listing.removable`.
 * Chrome mirrors ChangeEmailModal / ChangeWhatsAppModal (Principle E).
 *
 * Backend re-validates on DELETE — see app/api/ambassador/model/listings/[id].
 * Client picks the modal based on the in-memory `removable` field (which is
 * derived from effective_status !== 'active' inside toCardRow, so the view's
 * auto-flip from active-past-paid_until → expired gets respected).
 */
export function DeleteListingModal({
  listing,
  onClose,
  onRemoveConfirm,
}: {
  listing: ListingCardRow | null
  onClose: () => void
  onRemoveConfirm: () => void
}) {
  if (!listing) return null

  const categoryText = listing.category_label ?? listing.category_custom ?? '—'
  const locationText = formatLocation(listing.city, listing.country)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: '#1c1c1c',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 420,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />

        {listing.removable ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
              Remove listing?
            </div>
            <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              This removes the listing from your page.<br />
              Any payment link will no longer be valid.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
              Can&apos;t remove listing
            </div>
            <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              This listing is active with a paid package.<br />
              Removable from {listing.removable_from_formatted ?? '—'}.
            </div>
          </>
        )}

        {/* Info card — display-only, identical across both variants */}
        <div style={{ background: '#111', borderRadius: 10, padding: 14, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
            {listing.professional_name ?? '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: '#e91e8c' }}>{categoryText}</span>
            <span style={{ fontSize: 11, color: '#888' }}>·</span>
            <span style={{ fontSize: 11, color: '#888' }}>{locationText}</span>
          </div>
        </div>

        {listing.removable ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              onClick={onClose}
              style={{
                flex: 1,
                background: '#262626',
                borderRadius: 12,
                padding: 14,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#fff',
                userSelect: 'none',
              }}
            >
              Keep
            </div>
            <div
              onClick={onRemoveConfirm}
              style={{
                flex: 1,
                background: '#e91e8c',
                borderRadius: 12,
                padding: 14,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#fff',
                userSelect: 'none',
              }}
            >
              Remove
            </div>
          </div>
        ) : (
          <div
            onClick={onClose}
            style={{
              background: '#e91e8c',
              borderRadius: 12,
              padding: 14,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#fff',
              userSelect: 'none',
            }}
          >
            Got it
          </div>
        )}
      </div>
    </div>
  )
}
