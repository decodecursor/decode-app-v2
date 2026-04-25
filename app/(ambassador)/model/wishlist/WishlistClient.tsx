'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WishCardRow } from '@/lib/ambassador/wish-shape'
import { DeleteWishModal } from '@/components/ambassador/DeleteWishModal'
import { formatCurrency } from '@/lib/ambassador/utils'

/**
 * /model/wishlist client. Mirrors ListingsClient (Slice 3A pattern):
 * filter tabs + cards + delete-with-optimistic-UI + canonical toast.
 *
 * Spec: wishlist_incl_wish_delete_modal_final_UI_Spec.md.
 *
 * Spec drift superseded in 5A-3:
 *   - "/wishlist" route → /model/wishlist (matches listings convention)
 *   - status: 'open' / 'gifted' / 'deleted' → DB binary 'available'/'taken'
 *     (no 'deleted' state — hard delete; FK on payments table protects audit)
 *   - "INSERT into gifts" → INSERT into model_wish_payments
 *
 * Two card variants per spec §5:
 *   - Open (effective_status='available'): service + professional + location +
 *     share + delete icons
 *   - Gifted (effective_status='taken' AND completed payment exists): service +
 *     professional + location + amount + gifter (name+IG OR Anonymous) +
 *     reference. NO delete icon (FK ON DELETE RESTRICT enforces this anyway).
 */

type Filter = 'all' | 'open' | 'gifted'
type ToastPayload = { emoji?: string; message: string }

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'gifted', label: 'Gifted' },
]

const TOAST_LIFECYCLE_MS = 5200

function isGifted(w: WishCardRow): boolean {
  return w.effective_status === 'taken' && w.payment_reference !== null
}

function matchesFilter(w: WishCardRow, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return w.effective_status === 'available'
  return isGifted(w)
}

function emptyCopy(filter: Filter): string {
  if (filter === 'all') return 'No wishes yet'
  if (filter === 'open') return 'No open wishes'
  return 'No gifted wishes yet'
}

function locationText(w: WishCardRow): string {
  if (w.professional_city && w.professional_country) return `${w.professional_city}, ${w.professional_country}`
  return w.professional_city ?? w.professional_country ?? ''
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export default function WishlistClient({ wishes: initialWishes }: { wishes: WishCardRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [wishes, setWishes] = useState<WishCardRow[]>(initialWishes)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const [openDelete, setOpenDelete] = useState<WishCardRow | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  // Celebration toast on arrival from /model/wishlist/new (5A-2). The
  // URL flag is written by AddWishClient on successful create. Same
  // URL-scrub-after-fire pattern as ListingsClient (Slice 3A).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const newId = params.get('created') ?? params.get('new')
    if (!newId) return
    setToast({ emoji: '🎉', message: 'Wish is live — ready to be gifted' })
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_LIFECYCLE_MS)
    window.history.replaceState({}, '', '/model/wishlist')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (payload: ToastPayload | string) => {
    setToast(typeof payload === 'string' ? { message: payload } : payload)
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_LIFECYCLE_MS)
  }

  const refetchWishes = async () => {
    try {
      const res = await fetch('/api/ambassador/model/wishes', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.wishes)) setWishes(data.wishes)
    } catch {
      // Non-fatal — next page load will re-sync.
    }
  }

  const handleRemoveConfirm = async () => {
    const target = openDelete
    if (!target) return
    setOpenDelete(null)

    const snapshot = wishes
    setRemovingId(target.id)
    const removeTimer = setTimeout(() => {
      setWishes((prev) => prev.filter((w) => w.id !== target.id))
      setRemovingId(null)
    }, 450)
    showToast({ emoji: '🗑️', message: 'Wish removed' })

    const rollback = () => {
      clearTimeout(removeTimer)
      setWishes(snapshot)
      setRemovingId(null)
    }

    try {
      const res = await fetch(`/api/ambassador/model/wishes/${target.id}`, { method: 'DELETE' })
      if (res.ok) return
      rollback()
      if (res.status === 409) {
        void refetchWishes()
        showToast({ emoji: '🔒', message: "This wish was just gifted. Refreshing…" })
      } else {
        showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
      }
    } catch {
      rollback()
      showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
    }
  }

  const visible = wishes.filter((w) => matchesFilter(w, filter))

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg
            onClick={() => router.push('/model')}
            width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ cursor: 'pointer' }}
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span style={{ fontSize: 20, fontWeight: 700 }}>Wishlist</span>
        </div>
        <div
          onClick={() => router.push('/model/wishlist/new')}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e91e8c',
            background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxSizing: 'border-box',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 20 }}>
        {FILTER_TABS.map((t) => {
          const active = filter === t.key
          return (
            <div
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                fontSize: 13, fontWeight: active ? 700 : 600,
                color: active ? '#fff' : '#777', padding: '6px 0 4px',
                borderBottom: active ? '1.5px solid #e91e8c' : '1.5px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </div>
          )
        })}
      </div>

      {/* Cards */}
      <div style={{ padding: '0 20px' }}>
        {visible.length === 0 ? (
          <div style={{
            padding: '48px 0 32px', textAlign: 'center', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 14, color: '#888' }}>{emptyCopy(filter)}</div>
            <div
              onClick={() => router.push('/model/wishlist/new')}
              style={{
                background: '#e91e8c', color: '#fff', borderRadius: 12,
                padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Add your first wish
            </div>
          </div>
        ) : (
          visible.map((w) => {
            const isRemoving = removingId === w.id
            const gifted = isGifted(w)
            return (
              <div
                key={w.id}
                style={{
                  padding: isRemoving ? '0' : '18px 0',
                  borderBottom: isRemoving ? '1px solid transparent' : '1px solid #1f1f1f',
                  maxHeight: isRemoving ? 0 : 400,
                  opacity: isRemoving ? 0 : 1,
                  overflow: 'hidden',
                  transition: 'opacity 300ms ease, max-height 400ms ease, padding 400ms ease, border-color 400ms ease',
                }}
              >
                {/* Row 1 — service + icons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: gifted ? '#888' : '#fff' }}>
                    {w.service_name}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                    {!gifted && (
                      <svg
                        onClick={() => setOpenDelete(w)}
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ cursor: 'pointer' }}
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Row 2 — professional + location */}
                <div style={{ fontSize: 12, color: gifted ? '#666' : '#888', marginBottom: 4 }}>
                  {w.professional_name ?? '—'}
                  {locationText(w) && (
                    <>
                      <span style={{ margin: '0 6px', opacity: 0.6 }}>·</span>
                      <span>{locationText(w)}</span>
                    </>
                  )}
                </div>

                {/* Row 3 — amount + (gifted: gifter info) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: gifted ? '#888' : '#fff' }}>
                    {formatCurrency(w.price, w.currency)}
                  </div>
                  {gifted && (
                    <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>by</span>
                      {w.gifter_is_anonymous ? (
                        <span style={{ color: '#888' }}>Anonymous</span>
                      ) : w.gifter_instagram ? (
                        <a
                          href={`https://instagram.com/${w.gifter_instagram}`}
                          style={{ color: '#e91e8c', textDecoration: 'none' }}
                        >
                          {w.gifter_name ?? `@${w.gifter_instagram}`}
                        </a>
                      ) : (
                        <span style={{ color: '#e91e8c' }}>{w.gifter_name ?? '—'}</span>
                      )}
                      {w.taken_at && (
                        <>
                          <span style={{ opacity: 0.6 }}>·</span>
                          <span>{formatDate(w.taken_at)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Reference (gifted only) */}
                {gifted && w.payment_reference && (
                  <div style={{ fontSize: 10, color: '#555', marginTop: 6, fontFamily: 'monospace' }}>
                    {w.payment_reference}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <DeleteWishModal
        wish={openDelete}
        onClose={() => setOpenDelete(null)}
        onRemoveConfirm={handleRemoveConfirm}
      />

      {toast && (
        <div
          key={toastKey}
          style={{
            position: 'fixed', top: '50px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(28,28,28,0.95)', border: '1px solid #333',
            color: '#fff', fontSize: '12px', padding: '10px 18px', borderRadius: '24px',
            zIndex: 1000, boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', gap: '8px',
            animation: 'amb-toast-in 1200ms ease, amb-toast-out 1200ms ease 4000ms forwards',
          }}
        >
          {toast.emoji && <span>{toast.emoji}</span>}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
