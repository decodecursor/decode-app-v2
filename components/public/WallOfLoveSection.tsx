'use client'

/**
 * "My Wall of Love" public-page section (Slice 5D).
 *
 * Spec:   public_page_final_UI_Spec.md §4.4 (un-V1-superseded in 5D).
 * Mockup: public_page_final.html lines 112-119 + lines 219-258 (gift
 * row rendering).
 *
 * Anon supabase-js read of model_wish_payments filtered by
 * status='completed' (refunded gifts disappear from the wall — RLS
 * already enforces this server-side, the client filter is redundant
 * defense). Joined to model_wishes for service_name + gifter identity.
 *
 * RLS policy on model_wish_payments (verified live):
 *   "Public read completed wish payments for Wall of Love" —
 *   status='completed' AND model_id IN (published profiles).
 * The PostgREST embed of model_wishes inherits SELECT permission via
 * the FK + the "Public read wishes for published profiles with gifts
 * enabled" policy on model_wishes.
 *
 * Gating: section appears whenever the ambassador has any completed
 * wish payments — independent of the gifts_enabled toggle. The wall
 * is gift HISTORY (hers regardless of whether she's accepting new
 * gifts today). Hidden entirely when there are zero completed gifts
 * (mockup spec §3.3 — section "hidden entirely" on 0 gifts).
 *
 * Pattern 2 alignment: client-side fetch post-mount. Click events
 * (gifter Instagram taps) wire up in 5D-2.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface WallRow {
  id: string
  gross_amount: number | string
  currency: string
  created_at: string
  wish: {
    id: string
    service_name: string
    gifter_name: string | null
    gifter_instagram: string | null
    gifter_is_anonymous: boolean
  } | null
}

export function WallOfLoveSection({ modelId }: { modelId: string }) {
  const [rows, setRows] = useState<WallRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('model_wish_payments')
      .select(`
        id, gross_amount, currency, created_at,
        wish:model_wishes!model_wish_payments_wish_id_fkey (
          id, service_name, gifter_name, gifter_instagram, gifter_is_anonymous
        )
      `)
      .eq('model_id', modelId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .returns<WallRow[]>()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[WallOfLoveSection] read failed:', error)
          setRows([])
          return
        }
        setRows(data ?? [])
      })
    return () => { cancelled = true }
  }, [modelId])

  // Section hidden when no completed gifts (or while loading) — avoids
  // flashing an empty heading on slow networks.
  if (rows === null || rows.length === 0) return null

  return (
    <div style={{ padding: '24px 20px 24px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
        My Wall of Love{' '}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#e91e8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ display: 'inline-block', verticalAlign: -2, marginLeft: 2 }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>
      {rows.map((row, i) => (
        <WallRowDisplay key={row.id} row={row} isLast={i === rows.length - 1} />
      ))}
    </div>
  )
}

function WallRowDisplay({ row, isLast }: { row: WallRow; isLast: boolean }) {
  const wish = row.wish
  const isAnonymous = wish?.gifter_is_anonymous ?? true
  const gifterName = isAnonymous ? 'Anonymous' : (wish?.gifter_name ?? 'Anonymous')
  const gifterIg = isAnonymous ? null : (wish?.gifter_instagram ?? null)
  const serviceLabel = wish?.service_name ?? ''
  const amount = typeof row.gross_amount === 'string' ? Number(row.gross_amount) : row.gross_amount
  const amountLabel = formatWallAmount(amount, row.currency)
  const dateLabel = formatWallDate(row.created_at)
  const iconStroke = gifterIg ? '#e91e8c' : '#777'
  const igUrl = gifterIg ? `https://instagram.com/${gifterIg}` : null

  return (
    <div
      style={{
        padding: '12px 0',
        borderTop: '1px solid #1a1a1a',
        borderBottom: isLast ? '1px solid #1a1a1a' : undefined,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* Instagram icon — decorative only, stroke color signals
            anonymous (#777) vs real (#e91e8c). NOT independently
            tappable per spec §4.4. */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill={iconStroke} />
        </svg>
        <div style={{ minWidth: 0 }}>
          {igUrl ? (
            <a
              href={igUrl}
              target="_blank"
              rel="noopener"
              style={{ color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}
            >
              {gifterName}
            </a>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{gifterName}</div>
          )}
          <div style={{ fontSize: 12, color: '#777' }}>{dateLabel}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 700, textTransform: 'uppercase' }}>
          {serviceLabel}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{amountLabel}</div>
      </div>
    </div>
  )
}

// Wall-of-love amount formatter: whole numbers + thousand separators
// per spec §4.4 (e.g. $500, $2,500). Falls through to plain "{N} CCY"
// for currencies without a known symbol.
function formatWallAmount(amount: number, currency: string): string {
  const symbols: Record<string, string> = { usd: '$', eur: '€', gbp: '£' }
  const sym = symbols[currency.toLowerCase()]
  const whole = Math.round(amount).toLocaleString('en-US')
  return sym ? `${sym}${whole}` : `${whole} ${currency.toUpperCase()}`
}

// Date formatter: "12 March 2026" per spec §4.4.
function formatWallDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
