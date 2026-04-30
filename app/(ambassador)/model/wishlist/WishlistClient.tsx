'use client'

/**
 * /model/wishlist client. Visual fidelity to
 * _features/ambassador/wishlist_incl_wish_delete_modal_final.html
 * (mockup is authoritative visual truth — Slice 4B+4C lesson).
 *
 * Card layout differs from listings:
 *   Open card:    professional (primary) | share + delete icons
 *                 service · location | "Open" pill
 *                 age progress bar
 *                 "{days_live} days live" | money
 *
 *   Gifted card:  professional (primary) | gifted-at date
 *                 service · location | "Gifted" pill (green)
 *                 IG icon + gifter name | money
 *                 (no delete icon — FK ON DELETE RESTRICT enforces)
 *
 * Celebration toast (top-positioned, dedicated wlCelebIn/Out keyframes,
 * 🎉 + title + subtitle) on arrival from /model/wishlist/new with
 * ?created={id}.
 *
 * Action toast (small, bottom-positioned) for delete confirmations
 * + 409 race feedback. Inline animation per mockup; canonical
 * amb-toast-in/out keyframes are not used here because the mockup's
 * action-toast is structurally simpler (opacity + translate transition,
 * no keyframe animation).
 *
 * Mockup features deferred to future slices:
 *   - Per-wish click count ("X clicks" indicator) — needs aggregation
 *     of wish_giftit_click events from model_analytics_events.
 *     Schema event_type already exists; aggregation endpoint not yet
 *     built. Omitted with no placeholder per V1.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WishCardRow } from '@/lib/ambassador/wish-shape'
import { DeleteWishModal } from '@/components/ambassador/DeleteWishModal'
import BackArrow from '@/components/ambassador/BackArrow'
import { CurrencyAmount } from '@/components/ambassador/CurrencyAmount'
import { formatLocation } from '@/lib/format-location'

type Filter = 'all' | 'open' | 'gifted'

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'gifted', label: 'Gifted' },
]

// PAYMENT_BASE for wish share URLs. Same env-aware pattern as
// SendPaymentLinkClient (hardening item 7 — closed in 5e692cd).
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')
const PAYMENT_BASE = `${APP_HOST}/pay`

function isGifted(w: WishCardRow): boolean {
  return w.effective_status === 'taken' && w.payment_reference !== null
}

function matchesFilter(w: WishCardRow, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return w.effective_status === 'available'
  return isGifted(w)
}

function daysLive(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
}

function ageBarPct(createdAt: string): number {
  // Simple visual proxy: 1 day = 1% bar fill, capped at 100. Mirrors the
  // mockup's age_bar_pct without needing analytics data.
  return Math.min(100, daysLive(createdAt))
}

function formatGiftedDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function IgIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', flexShrink: 0 }}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

export default function WishlistClient({ wishes: initialWishes }: { wishes: WishCardRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [wishes, setWishes] = useState<WishCardRow[]>(initialWishes)
  const [actionToast, setActionToast] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [openDelete, setOpenDelete] = useState<WishCardRow | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
  }, [])

  // Celebration toast on arrival from /model/wishlist/new?created={id}.
  // The animation handles its own fade-out at 5000ms via CSS keyframe;
  // we mount the element on detection, scrub the URL flag, and unmount
  // after the full animation completes (~6500ms).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('created')) return
    setShowCelebration(true)
    window.history.replaceState({}, '', '/model/wishlist')
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
    // 400ms in-delay + 1200ms in + 5000ms hold + 1200ms out = ~7800ms total.
    celebrationTimer.current = setTimeout(() => setShowCelebration(false), 8000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showActionToast = (msg: string) => {
    setActionToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setActionToast(null), 1800)
  }

  const refetchWishes = async () => {
    try {
      const res = await fetch('/api/ambassador/model/wishes', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.wishes)) setWishes(data.wishes)
    } catch {
      // Non-fatal
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
    showActionToast('Wish removed')

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
        showActionToast('This wish was just gifted. Refreshing…')
      } else {
        showActionToast("Couldn’t reach server. Try again.")
      }
    } catch {
      rollback()
      showActionToast("Couldn’t reach server. Try again.")
    }
  }

  const handleShare = (w: WishCardRow) => {
    const url = `https://${PAYMENT_BASE}/${w.payment_link_token}`
    const message = `Looking for a gift idea for me? I’ve got a beauty wish ready 🎁 ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  // Sort: open first, gifted second (matches mockup behavior at line 219).
  const sorted = [...wishes].sort((a, b) => {
    const aGifted = isGifted(a) ? 1 : 0
    const bGifted = isGifted(b) ? 1 : 0
    if (aGifted !== bGifted) return aGifted - bGifted
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const visible = sorted.filter((w) => matchesFilter(w, filter))

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', position: 'relative', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Inline keyframes for the celebration toast — mockup spec exactly. */}
      <style>{`
        @keyframes wlCelebIn { 0% { opacity: 0; transform: translateY(20px) } 100% { opacity: 1; transform: translateY(0) } }
        @keyframes wlCelebOut { 0% { opacity: 1; transform: translateY(0) } 100% { opacity: 0; transform: translateY(20px) } }
      `}</style>

      <div style={{ width: '100%', margin: '0 auto', minHeight: '100vh', position: 'relative' }}>
        {/* Header */}
        <div className="amb-internal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackArrow fallbackHref="/model" />
            <span style={{ fontSize: 20, fontWeight: 700 }}>Wishlist</span>
          </div>
          <div
            onClick={() => router.push('/model/wishlist/new')}
            style={{
              padding: 6, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {t.label}
              </div>
            )
          })}
        </div>

        {/* Rows */}
        <div style={{ padding: '0 20px', minHeight: 400 }}>
          {visible.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No beauty wishes yet</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
                Add your first beauty wish to show data here.
              </div>
              <div
                onClick={() => router.push('/model/wishlist/new')}
                style={{
                  background: '#e91e8c', borderRadius: 12, padding: '14px 28px',
                  fontSize: 14, fontWeight: 700, letterSpacing: '0.2px', cursor: 'pointer',
                  display: 'inline-block', color: '#fff',
                }}
              >
                Add beauty wish
              </div>
            </div>
          ) : (
            visible.map((w) => {
              const isRemoving = removingId === w.id
              const gifted = isGifted(w)
              const wrapStyle: React.CSSProperties = {
                padding: isRemoving ? '0' : '18px 0',
                borderBottom: isRemoving ? '1px solid transparent' : '1px solid #1f1f1f',
                maxHeight: isRemoving ? 0 : 400,
                opacity: isRemoving ? 0 : 1,
                overflow: 'hidden',
                transition: 'opacity 300ms ease, max-height 400ms ease, padding 400ms ease, border-color 400ms ease',
              }

              if (gifted) {
                const g = {
                  first_name: w.gifter_name ?? 'Secret Gifter',
                  instagram: w.gifter_instagram,
                  anonymous: w.gifter_is_anonymous,
                }
                const iconColor = g.anonymous ? '#666' : '#e91e8c'
                const isClickable = !g.anonymous && !!g.instagram
                return (
                  <div key={w.id} style={wrapStyle}>
                    {/* Row 1 — professional + gifted-at date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{w.professional_name ?? '—'}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#777' }}>{formatGiftedDate(w.taken_at)}</span>
                    </div>
                    {/* Row 2 — service · location | Gifted pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{w.service_name}</span>
                        {formatLocation(w.professional_city, w.professional_country) && (
                          <>
                            <span style={{ fontSize: 11, color: '#777' }}>·</span>
                            <span style={{
                              fontSize: 10, color: '#777',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                            }}>{formatLocation(w.professional_city, w.professional_country)}</span>
                          </>
                        )}
                      </div>
                      <span style={{ fontSize: 11, letterSpacing: 1, color: '#34d399', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Gifted</span>
                    </div>
                    {/* Row 3 — IG icon + gifter name | money */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        onClick={isClickable ? () => window.open(`https://instagram.com/${g.instagram}`, '_blank', 'noopener,noreferrer') : undefined}
                        style={{
                          cursor: isClickable ? 'pointer' : 'default',
                          display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                        }}
                      >
                        <IgIcon color={iconColor} />
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>{g.first_name}</span>
                      </span>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}><CurrencyAmount currency={w.currency} amount={Number(w.price)} variant="amount-with-code" /></span>
                    </div>
                  </div>
                )
              }

              // Open card
              const days = daysLive(w.created_at)
              const pct = ageBarPct(w.created_at)
              return (
                <div key={w.id} style={wrapStyle}>
                  {/* Row 1 — professional | share + delete */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{w.professional_name ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                      <span onClick={(e) => { e.stopPropagation(); handleShare(w) }}>
                        <ShareIcon />
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); setOpenDelete(w) }}>
                        <TrashIcon />
                      </span>
                    </div>
                  </div>
                  {/* Row 2 — service · location | Open pill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{w.service_name}</span>
                      {formatLocation(w.professional_city, w.professional_country) && (
                        <>
                          <span style={{ fontSize: 11, color: '#777' }}>·</span>
                          <span style={{
                            fontSize: 10, color: '#777',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                          }}>{formatLocation(w.professional_city, w.professional_country)}</span>
                        </>
                      )}
                    </div>
                    <span style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Open</span>
                  </div>
                  {/* Age progress bar — pink fill over dashed grey track */}
                  <div
                    style={{
                      height: 4, borderRadius: 2, marginBottom: 6,
                      backgroundImage: `linear-gradient(#e91e8c, #e91e8c), repeating-linear-gradient(90deg, #4a1a30 0 4px, transparent 4px 8px)`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: `${pct}% 100%, 100% 100%`,
                      transition: 'background-size 1500ms cubic-bezier(.2,.7,.2,1)',
                    }}
                  />
                  {/* Bottom row — days live | money */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#777' }}>{days} days live</span>
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}><CurrencyAmount currency={w.currency} amount={Number(w.price)} variant="amount-with-code" /></span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding: '24px 20px 20px' }} />

        {/* Celebration toast — top-positioned, dedicated keyframes */}
        {showCelebration && (
          <div
            style={{
              pointerEvents: 'none', position: 'absolute',
              left: 6, right: 6, top: 65, zIndex: 50,
              background: '#0c0c0c', borderRadius: 12, padding: 14,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
              animation: 'wlCelebIn 1200ms cubic-bezier(.2,.7,.2,1) 400ms backwards, wlCelebOut 1200ms cubic-bezier(.5,.2,.8,.1) 5000ms forwards',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>🎉</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Wish is live</div>
              <div style={{ fontSize: 11, color: '#999' }}>Ready to be gifted</div>
            </div>
          </div>
        )}

        {/* Action toast — bottom-positioned, simple opacity transition */}
        <div
          style={{
            position: 'fixed', left: 20, right: 20, bottom: 28,
            maxWidth: 460, margin: '0 auto',
            background: '#0c0c0c', border: '1px solid #262626', borderRadius: 12,
            padding: '12px 16px', fontSize: 12, color: '#fff', textAlign: 'center',
            zIndex: 90, pointerEvents: 'none',
            opacity: actionToast ? 1 : 0,
            transform: actionToast ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}
        >
          {actionToast ?? ''}
        </div>
      </div>

      <DeleteWishModal
        wish={openDelete}
        onClose={() => setOpenDelete(null)}
        onRemoveConfirm={handleRemoveConfirm}
      />
    </div>
  )
}
