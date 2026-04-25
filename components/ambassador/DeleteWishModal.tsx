'use client'

import type { WishCardRow } from '@/lib/ambassador/wish-shape'

/**
 * Bottom-sheet "Remove wish?" modal. Single variant — only `removable`
 * (open) wishes ever reach this modal because the delete icon is hidden
 * on gifted cards (per spec §5). The `wish_now_gifted` 409 from the
 * server is handled by the parent (rollback + refresh + toast); the
 * modal itself doesn't need a "can't remove" branch.
 *
 * Mirrors components/ambassador/DeleteListingModal.tsx chrome
 * (Principle E). Sibling rather than parameterized — DeleteListingModal
 * has a two-variant branch (removable vs not-removable) that wishes
 * don't need.
 */
export function DeleteWishModal({
  wish,
  onClose,
  onRemoveConfirm,
}: {
  wish: WishCardRow | null
  onClose: () => void
  onRemoveConfirm: () => void
}) {
  if (!wish) return null

  const locationText =
    wish.professional_city && wish.professional_country
      ? `${wish.professional_city}, ${wish.professional_country}`
      : wish.professional_city ?? wish.professional_country ?? ''

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
          maxWidth: 500,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />

        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
          Remove wish?
        </div>
        <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
          This removes the wish from your page.<br />
          The gift link will no longer be valid.
        </div>

        <div style={{ background: '#111', borderRadius: 10, padding: 14, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
            {wish.service_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {wish.professional_name && (
              <>
                <span style={{ fontSize: 11, color: '#e91e8c' }}>{wish.professional_name}</span>
                {locationText && <span style={{ fontSize: 11, color: '#888' }}>·</span>}
              </>
            )}
            {locationText && <span style={{ fontSize: 11, color: '#888' }}>{locationText}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div
            onClick={onClose}
            style={{
              flex: 1, background: '#262626', borderRadius: 12, padding: 14,
              textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: '#fff', userSelect: 'none',
            }}
          >
            Keep
          </div>
          <div
            onClick={onRemoveConfirm}
            style={{
              flex: 1, background: '#e91e8c', borderRadius: 12, padding: 14,
              textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: '#fff', userSelect: 'none',
            }}
          >
            Remove
          </div>
        </div>
      </div>
    </div>
  )
}
