'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ListingCardRow } from '@/lib/ambassador/listing-shape'
import { DeleteListingModal } from '@/components/ambassador/DeleteListingModal'

type ToastPayload = { emoji?: string; message: string }

type Filter = 'all' | 'active' | 'trial' | 'pending' | 'expired'

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'pending', label: 'Pending' },
  { key: 'expired', label: 'Expired' },
]

function matchesFilter(row: ListingCardRow, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return row.effective_status === 'active'
  if (filter === 'trial') return row.effective_status === 'free_trial'
  if (filter === 'pending') return row.effective_status === 'pending_payment'
  if (filter === 'expired') return row.effective_status === 'expired'
  return false
}

function emptyCopy(filter: Filter): string {
  if (filter === 'all') return 'No listings yet'
  if (filter === 'active') return 'No active listings'
  if (filter === 'trial') return 'No trial listings'
  if (filter === 'pending') return 'No pending listings'
  return 'No expired listings'
}

function categoryText(row: ListingCardRow): string {
  return row.category_label ?? row.category_custom ?? '—'
}

function locationText(row: ListingCardRow): string {
  if (row.city && row.country) return `${row.city}, ${row.country}`
  return row.city ?? row.country ?? ''
}

function formatUntil(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function daysColor(row: ListingCardRow): string {
  if (row.effective_status === 'pending_payment') return '#e91e8c'
  if (row.effective_status === 'expired') return '#555'
  if (row.days_left > 7) return '#777'
  if (row.effective_status === 'active') return '#e91e8c'
  if (row.effective_status === 'free_trial') return '#38bdf8'
  return '#777'
}

function daysWeight(row: ListingCardRow): number {
  if (row.effective_status === 'pending_payment') return 700
  if (row.effective_status === 'expired') return 400
  return row.days_left <= 7 ? 700 : 400
}

function shareStroke(row: ListingCardRow): string {
  if (row.effective_status === 'expired') return '#666'
  if (row.effective_status === 'pending_payment') return '#e91e8c'
  if (row.days_left <= 7) return '#e91e8c'
  return '#666'
}

function deleteStroke(row: ListingCardRow): string {
  return row.effective_status === 'expired' ? '#444' : '#666'
}

/**
 * Rough visual progress width. Trial is always 30 days; active paid has no
 * original-package-length column in the live schema today (Slice 7 adds
 * paid_package_days), so we approximate against 90 days as an upper bound.
 * Pending and expired show an empty bar.
 */
function progressPercent(row: ListingCardRow): number {
  if (row.effective_status === 'free_trial') return Math.max(0, Math.min(100, (row.days_left / 30) * 100))
  // TODO Slice 3B/4: populate from paid_package_days once column lands
  if (row.effective_status === 'active') return Math.max(0, Math.min(100, (row.days_left / 90) * 100))
  return 0
}

function progressGradient(row: ListingCardRow): string {
  if (row.effective_status === 'free_trial') {
    return 'linear-gradient(#38bdf8,#38bdf8), repeating-linear-gradient(90deg, #1e5070 0 4px, transparent 4px 8px)'
  }
  if (row.effective_status === 'expired') {
    return 'linear-gradient(#2a2a2a,#2a2a2a), repeating-linear-gradient(90deg, #2a2a2a 0 4px, transparent 4px 8px)'
  }
  // active + pending share the pink bar
  return 'linear-gradient(#e91e8c,#e91e8c), repeating-linear-gradient(90deg, #4a1a30 0 4px, transparent 4px 8px)'
}

function statusPill(row: ListingCardRow): { label: string; color: string } | null {
  // Active paid has no right-side status pill — per listings_final.html and UX5.
  if (row.effective_status === 'active') return null
  if (row.effective_status === 'free_trial') return { label: 'Trial', color: '#38bdf8' }
  if (row.effective_status === 'pending_payment') return { label: 'Pending Payment', color: '#e91e8c' }
  if (row.effective_status === 'expired') return { label: 'Expired', color: '#555' }
  return null
}

// Entire card dims out when expired.
const dimIfExpired = (row: ListingCardRow) => row.effective_status === 'expired'

function untilLine(row: ListingCardRow): string {
  // Pending: no "until {date}" span per UX4.
  if (row.effective_status === 'pending_payment') return ''
  if (row.effective_status === 'free_trial') return row.free_trial_ends_at ? `until ${formatUntil(row.free_trial_ends_at)}` : ''
  if (row.effective_status === 'active') return row.paid_until ? `until ${formatUntil(row.paid_until)}` : ''
  // expired: "Expired {date}" rendered as the sole line below
  return ''
}

export default function ListingsClient({ listings: initialListings }: { listings: ListingCardRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [listings, setListings] = useState<ListingCardRow[]>(initialListings)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const [openDelete, setOpenDelete] = useState<ListingCardRow | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  // Lifecycle matches listings_final_UI_Spec.md §7.9:
  // 1200ms amb-toast-in + 2800ms hold + 1200ms amb-toast-out = 5200ms.
  const TOAST_LIFECYCLE_MS = 5200

  // Celebration toast on arrival from /model/listings/new. The URL flag is
  // written by AddListingClient on successful create. We fire the toast on
  // mount, then scrub the flag via replaceState so refreshing / bookmarking
  // doesn't re-fire. The `celebrated_at` one-shot DB guard from
  // listings_final_UI_Spec §7.10 isn't live in V1 — URL-scrub gives us the
  // same in-session "fire once" behavior.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const newId = params.get('new')
    const type = params.get('type')
    const updatedId = params.get('updated')
    if (updatedId) {
      setToast({ emoji: '✓', message: 'Listing updated' })
    } else if (newId && type === 'trial') {
      setToast({ emoji: '🎉', message: 'Your trial listing is live — 30 days until it expires' })
    } else {
      return
    }
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_LIFECYCLE_MS)
    window.history.replaceState({}, '', '/model/listings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (payload: ToastPayload | string) => {
    setToast(typeof payload === 'string' ? { message: payload } : payload)
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_LIFECYCLE_MS)
  }

  const refetchListings = async () => {
    try {
      const res = await fetch('/api/ambassador/model/listings', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.listings)) setListings(data.listings)
    } catch {
      // Non-fatal — the stale toast already fired; next page load will re-sync.
    }
  }

  const handleRemoveConfirm = async () => {
    const target = openDelete
    if (!target) return
    setOpenDelete(null)

    // Snapshot the current ordered list for rollback on server failure.
    // Mirrors the snapshot/restore pattern used for cover-photo replace,
    // toggle flags, and cover position in app/(ambassador)/model/settings/page.tsx
    // (Principle E).
    const snapshot = listings

    // Optimistic: start fade now, schedule row removal at end of animation,
    // fire success toast immediately. Server request runs in the background.
    setRemovingId(target.id)
    const removeTimer = setTimeout(() => {
      setListings((prev) => prev.filter((l) => l.id !== target.id))
      setRemovingId(null)
    }, 450)
    showToast({ emoji: '🗑️', message: 'Listing removed' })

    const rollback = () => {
      clearTimeout(removeTimer)
      setListings(snapshot)
      setRemovingId(null)
    }

    try {
      const res = await fetch(`/api/ambassador/model/listings/${target.id}`, { method: 'DELETE' })

      if (res.ok) return // happy path — optimistic state stands

      rollback()

      if (res.status === 409) {
        void refetchListings()
        showToast({ emoji: '🔒', message: "This listing's status just changed. Refreshing…" })
      } else {
        showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
      }
    } catch {
      rollback()
      showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
    }
  }

  const visible = listings.filter((l) => matchesFilter(l, filter))

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
          <span style={{ fontSize: 20, fontWeight: 700 }}>Listings</span>
        </div>
        <div
          onClick={() => showToast('Add Listing ships in the next update')}
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
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                color: active ? '#fff' : '#777',
                padding: '6px 0 4px',
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
              onClick={() => showToast('Add Listing ships in the next update')}
              style={{
                background: '#e91e8c', color: '#fff', borderRadius: 12,
                padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Add your first listing
            </div>
          </div>
        ) : (
          visible.map((l) => {
            const pill = statusPill(l)
            const dim = dimIfExpired(l)
            const until = untilLine(l)
            const percent = progressPercent(l)

            const isRemoving = removingId === l.id

            return (
              <div
                key={l.id}
                data-id={l.id}
                style={{
                  padding: isRemoving ? '0' : '18px 0',
                  borderBottom: isRemoving ? '1px solid transparent' : '1px solid #1f1f1f',
                  maxHeight: isRemoving ? 0 : 400,
                  opacity: isRemoving ? 0 : 1,
                  overflow: 'hidden',
                  transition:
                    'opacity 300ms ease, max-height 400ms ease, padding 400ms ease, border-color 400ms ease',
                }}
              >
                {/* Row 1 — name + clicks + icons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: dim ? '#555' : '#fff' }}>
                      {l.professional_name ?? '—'}
                    </span>
                    {/* TODO Slice 6: populate from model_analytics_events */}
                    <span style={{ fontSize: 10, color: dim ? '#444' : '#777' }}>0 clicks</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                    <svg
                      onClick={() => showToast('Share link ships in the next update')}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={shareStroke(l)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ cursor: 'pointer' }}
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {l.effective_status !== 'expired' && (
                      <svg
                        onClick={() => router.push(`/model/listings/${l.id}/edit`)}
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ cursor: 'pointer' }}
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    )}
                    <svg
                      onClick={() => setOpenDelete(l)}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={deleteStroke(l)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ cursor: 'pointer' }}
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </div>
                </div>

                {/* Row 2 — category/location, with optional right-side status pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: pill ? 'space-between' : 'flex-start',
                  gap: pill ? 0 : 6,
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10, letterSpacing: 1,
                      color: dim ? '#555' : '#e91e8c',
                      fontWeight: 700,
                    }}>{categoryText(l)}</span>
                    <span style={{ fontSize: 11, color: dim ? '#444' : '#777' }}>·</span>
                    <span style={{ fontSize: 11, color: dim ? '#444' : '#777' }}>{locationText(l)}</span>
                  </div>
                  {pill && (
                    <span style={{ fontSize: 10, letterSpacing: 1, color: pill.color, fontWeight: 700 }}>
                      {pill.label}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    marginBottom: 6,
                    backgroundImage: progressGradient(l),
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${percent}% 100%, 100% 100%`,
                    transition: 'background-size 1500ms cubic-bezier(.2,.7,.2,1)',
                  }}
                />

                {/* Row 3 — days-left + until-date */}
                {l.effective_status === 'expired' ? (
                  <div style={{ fontSize: 10, color: '#555' }}>
                    {l.paid_until
                      ? `Expired ${formatUntil(l.paid_until)}`
                      : l.free_trial_ends_at
                        ? `Expired ${formatUntil(l.free_trial_ends_at)}`
                        : 'Expired'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 10,
                      color: daysColor(l),
                      fontWeight: daysWeight(l),
                    }}>
                      {l.days_left} days left
                    </span>
                    {until && (
                      <span style={{ fontSize: 10, color: '#777' }}>{until}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div style={{ padding: '24px 20px 20px' }} />

      {/* Toast — chrome identical to other ambassador toasts (Principle E).
          Animation per listings_final_UI_Spec.md §7.9 — amb-toast-in +
          amb-toast-out keyframes live in (ambassador)/layout.tsx for reuse.
          key prop forces a fresh mount per payload so back-to-back toasts
          replay the entrance animation. */}
      {toast && (
        <div
          key={toastKey}
          style={{
            position: 'fixed',
            top: 50,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(28,28,28,0.95)',
            border: '1px solid #333',
            color: '#fff',
            fontSize: 12,
            padding: '10px 18px',
            borderRadius: 24,
            zIndex: 50,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation:
              'amb-toast-in 1200ms cubic-bezier(.2,.7,.2,1) forwards, ' +
              'amb-toast-out 1200ms cubic-bezier(.5,.2,.8,.1) 4000ms forwards',
            pointerEvents: 'none',
          }}
        >
          {toast.emoji && <span style={{ fontSize: 14, lineHeight: 1 }}>{toast.emoji}</span>}
          <span>{toast.message}</span>
        </div>
      )}

      <DeleteListingModal
        listing={openDelete}
        onClose={() => setOpenDelete(null)}
        onRemoveConfirm={handleRemoveConfirm}
      />
    </div>
  )
}
