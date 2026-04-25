'use client'

/**
 * "My Beauty Wishlist" public-page section (Slice 5D).
 *
 * Spec:   public_page_final_UI_Spec.md §4.3 (un-V1-superseded in 5D).
 * Mockup: public_page_final.html lines 79-110.
 *
 * Anon supabase-js read of model_wishes_live filtered by
 * effective_status='available' (so stale-locked wishes that the cron
 * hasn't swept yet still appear). RLS policy
 * "Public read wishes for published profiles with gifts enabled"
 * (model_wishes) gates the read — anon callers see only wishes whose
 * model_profile has gifts_enabled=true + is_published=true +
 * is_suspended=false. The parent gates the section render on the same
 * gifts_enabled flag for instant UI hiding when the toggle flips.
 *
 * Pattern 2 alignment (Slice 4D doctrine): client-side fetch
 * post-mount keeps ISR caching of the server page intact while letting
 * the wishlist surface react to ambassador toggle changes within the
 * 60s ISR window.
 *
 * Click instrumentation (Slice 5D-2): Gift-it pill fires
 * wish_giftit_click with target_id=wish.id. The schema-spec drift on
 * professional Instagram (spec §4.3 implies the business name links
 * to IG with a wish_instagram_click event, but model_wishes doesn't
 * carry a professional_instagram column) means we don't wire that
 * event from this surface — the allowlist still includes the slug for
 * forward-compat if the schema gains that column later.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/lib/ambassador/utils'

// Same fire-and-forget shape as SquadRow's analytics fire (Slice 4D
// `d5d1530`). keepalive:true so the request survives the
// /pay/[token] navigation.
function fireClick(slug: string, event_type: 'wish_giftit_click', target_id: string) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type, slug, target_id }),
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ })
}

interface WishRow {
  id: string
  payment_link_token: string
  service_name: string
  professional_name: string | null
  professional_city: string | null
  professional_country: string | null
  price: number | string
  currency: string
}

export function WishesSection({ modelId, slug, ambassadorFirstName }: {
  modelId: string
  slug: string
  ambassadorFirstName: string
}) {
  const [wishes, setWishes] = useState<WishRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('model_wishes_live')
      .select('id, payment_link_token, service_name, professional_name, professional_city, professional_country, price, currency')
      .eq('model_id', modelId)
      .eq('effective_status', 'available')
      .order('created_at', { ascending: false })
      .returns<WishRow[]>()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[WishesSection] read failed:', error)
          setWishes([])
          return
        }
        setWishes(data ?? [])
      })
    return () => { cancelled = true }
  }, [modelId])

  // Hide section entirely when there are zero open wishes (mockup spec
  // §3.3 wishlist behavior — section appears only when ambassador has
  // active wishes for followers to gift). Loading state also hides
  // (avoid layout flash on slow networks; section pops in when ready).
  if (wishes === null || wishes.length === 0) return null

  return (
    <div style={{ padding: '24px 20px 8px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
        My Beauty Wishlist
      </div>
      {wishes.map((wish, i) => {
        const isLast = i === wishes.length - 1
        return (
          <WishRowDisplay
            key={wish.id}
            wish={wish}
            slug={slug}
            ambassadorFirstName={ambassadorFirstName}
            isLast={isLast}
          />
        )
      })}
    </div>
  )
}

function WishRowDisplay({ wish, slug, isLast }: {
  wish: WishRow
  slug: string
  ambassadorFirstName: string
  isLast: boolean
}) {
  const price = typeof wish.price === 'string' ? Number(wish.price) : wish.price
  const priceLabel = formatCurrencyShort(price, wish.currency)
  const locationText = wish.professional_city && wish.professional_country
    ? `${wish.professional_city}, ${wish.professional_country}`
    : wish.professional_city ?? wish.professional_country ?? ''

  // Gift-it pill routes to /pay/{wish.payment_link_token} — same
  // dispatch that the WishCheckoutClient consumes (5C-3 wired the
  // server-component branch). Fires wish_giftit_click on tap.
  const payUrl = `/pay/${wish.payment_link_token}`
  const onPayClick = () => fireClick(slug, 'wish_giftit_click', wish.id)

  return (
    <div
      style={{
        padding: '14px 0',
        borderTop: '1px solid #1a1a1a',
        borderBottom: isLast ? '1px solid #1a1a1a' : undefined,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: '#e91e8c', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>
          {wish.service_name}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2, color: '#fff' }}>
          {wish.professional_name ?? '—'}
        </div>
        {locationText && (
          <div style={{ fontSize: 12, color: '#777' }}>{locationText}</div>
        )}
      </div>
      <a
        href={payUrl}
        onClick={onPayClick}
        style={{
          border: '1.5px solid #e91e8c',
          borderRadius: 18,
          padding: '10px 18px',
          textAlign: 'center',
          background: 'transparent',
          flexShrink: 0,
          lineHeight: 1.2,
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'block',
        }}
      >
        <div style={{ fontSize: 15, color: '#e91e8c', fontWeight: 600 }}>{priceLabel}</div>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 1 }}>Gift it</div>
      </a>
    </div>
  )
}

// Compact currency for the Gift-it pill — symbol + integer amount, no
// thousands-separator gymnastics or trailing currency code (the pill
// is small; full formatCurrency would overflow). Falls through to
// standard formatCurrency for unsupported currencies.
function formatCurrencyShort(amount: number, currency: string): string {
  const symbols: Record<string, string> = { usd: '$', eur: '€', gbp: '£' }
  const sym = symbols[currency.toLowerCase()]
  if (sym) return `${sym}${Math.round(amount)}`
  return formatCurrency(amount, currency)
}
