'use client'

import type { WishCardRow } from '@/lib/ambassador/wish-shape'

/**
 * "Remove beauty wish?" bottom-sheet modal. Visual fidelity to
 * _features/ambassador/wishlist_incl_wish_delete_modal_final.html
 * lines 48-60 — mockup is authoritative visual truth (Slice 4B+4C
 * lesson).
 *
 * Single variant — only `removable` (open) wishes ever reach this
 * modal because the delete icon is hidden on gifted cards (per
 * spec §5 + matching mockup behavior). The `wish_now_gifted` 409 from
 * the server is handled by the parent rollback + refresh, not surfaced
 * via a second modal variant.
 *
 * Mockup includes a faithful row-replica preview block above the
 * buttons so the ambassador sees exactly which wish she's removing.
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

  // Days live computed client-side from created_at — same heuristic the
  // wishlist card uses so the modal preview matches the row visually.
  const daysLive = Math.max(0, Math.floor((Date.now() - new Date(wish.created_at).getTime()) / 86_400_000))
  const ageBarPct = Math.min(100, daysLive)

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
          padding: '20px 20px 24px',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#262626', borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 6 }}>
          Remove beauty wish?
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 18 }}>
          This will remove the beauty wish from your page
        </div>

        {/* Row replica preview — pink-tinted background so the
            ambassador sees the row she's about to remove. Mirrors the
            open-card layout minus the action icons. */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: 'rgba(233,30,140,0.08)', borderRadius: 12, padding: '14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{wish.professional_name ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 700 }}>{wish.service_name}</span>
                {locationText && (
                  <>
                    <span style={{ fontSize: 11, color: '#777' }}>·</span>
                    <span style={{ fontSize: 10, color: '#777' }}>{locationText}</span>
                  </>
                )}
              </div>
              <span style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 700 }}>Open</span>
            </div>
            <div
              style={{
                height: 4, borderRadius: 2, marginBottom: 6,
                backgroundImage: `linear-gradient(#e91e8c, #e91e8c), repeating-linear-gradient(90deg, #4a1a30 0 4px, transparent 4px 8px)`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${ageBarPct}% 100%, 100% 100%`,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#777' }}>{daysLive} days live</span>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>
                {wish.currency.toUpperCase()} {wish.price}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div
            onClick={onClose}
            style={{
              flex: 1, background: '#1c1c1c', border: '1px solid #262626', borderRadius: 12, padding: 14,
              textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px', cursor: 'pointer', color: '#fff',
              userSelect: 'none',
            }}
          >
            Keep
          </div>
          <div
            onClick={onRemoveConfirm}
            style={{
              flex: 1, background: '#e91e8c', borderRadius: 12, padding: 14,
              textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px', cursor: 'pointer', color: '#fff',
              userSelect: 'none',
            }}
          >
            Remove
          </div>
        </div>
      </div>
    </div>
  )
}
