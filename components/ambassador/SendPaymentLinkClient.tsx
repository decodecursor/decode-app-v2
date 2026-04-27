'use client'

/**
 * Send Payment Link (client).
 *
 * Spec: `_features/ambassador/send_payment_link_after_listing_UI_Spec.md`.
 * Route: /model/listings/[id]/send-link.
 *
 * Three render states share one layout — only the progress-tracker
 * final step + title + subline differ:
 *   S1 (pending_payment — from Add Listing paid path)
 *   S2 (free_trial — trial conversion, future entry)
 *   S3 (active — renewal, future entry)
 *
 * Token semantics are locked (Slice 3C opening): reuse the permanent
 * `model_listings.payment_link_token` generated at listing POST. No
 * regeneration here, no expiry, no schema writes except the optional
 * blur-time pricing PATCH (spec §10.3).
 *
 * Payment URL is displayed as `welovedecode.com/pay/{token}` and
 * shared over WhatsApp via the open-contact-picker `wa.me` URL —
 * no phone number stored. Per spec §7.1.
 *
 * PAYMENT_BASE is env-aware (hardening backlog item 7, closed in Slice
 * 4B+4C commit 4). Derived from NEXT_PUBLIC_APP_URL with a prod default
 * fallback so staging + preview Vercel deploys resolve to their own
 * host without code changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'
import BackArrow from '@/components/ambassador/BackArrow'
import {
  currencySymbol,
  priceFloorForCurrency,
  PriceBox,
} from '@/lib/ambassador/add-listing-helpers'

type EffectiveStatus = 'free_trial' | 'pending_payment' | 'active' | 'expired'

type Listing = {
  id: string
  effective_status: EffectiveStatus
  payment_link_token: string
  price_30: number | null
  price_60: number | null
  price_90: number | null
  currency: string
  free_trial_ends_at: string | null
  paid_until: string | null
  category_id: string | null
  category_label: string | null
  category_custom: string | null
  media_type: 'video' | 'photos' | null
  photo_url_1: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  video_url: string | null
}

type ToastPayload = { emoji?: string; message: string }

const TOAST_LIFECYCLE_MS = 5200

// Display-form URL (no scheme) so the UI renders `welovedecode.com/pay/...`
// bare. The copy-to-clipboard + WhatsApp-share flows re-prepend `https://`
// when writing the full URL to external surfaces.
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')
const PAYMENT_BASE = `${APP_HOST}/pay`

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export default function SendPaymentLinkClient({
  listing,
  professional,
}: {
  listing: Listing
  professional: { name: string }
}) {
  const router = useRouter()

  const sendState: 'S1' | 'S2' | 'S3' =
    listing.effective_status === 'pending_payment' ? 'S1'
    : listing.effective_status === 'free_trial' ? 'S2'
    : 'S3'

  const steps: readonly string[] =
    sendState === 'S1' ? ['Link created', 'Send link', 'Pay link', 'Go live']
    : sendState === 'S2' ? ['Link created', 'Send link', 'Pay link', 'Upgrade']
    : ['Link created', 'Send link', 'Pay link', 'Renew']

  const title = sendState === 'S3' ? 'Send renewal link' : 'Send payment link'
  const subline =
    sendState === 'S1' ? "We'll list this professional once they pay"
    : sendState === 'S2' && listing.free_trial_ends_at
      ? `Trial ends on ${formatDate(listing.free_trial_ends_at)}`
    : sendState === 'S3' && listing.paid_until
      ? `Listing expires on ${formatDate(listing.paid_until)}`
    : ''

  // Back arrow — S1 returns to Add Listing (paid-path origin), S2/S3
  // return to Listings page (card-button origin). Per spec §10.2.
  const backHref = sendState === 'S1' ? '/model/listings/new' : '/model/listings'

  const symbol = useMemo(() => currencySymbol(listing.currency), [listing.currency])
  const floor = useMemo(() => priceFloorForCurrency(listing.currency), [listing.currency])

  // Prefill pricing from the listing row. Trial listings have null
  // pricing — the form behaves like "set for the first time" in S2.
  const [p30, setP30] = useState(listing.price_30 != null ? String(listing.price_30) : '')
  const [p60, setP60] = useState(listing.price_60 != null ? String(listing.price_60) : '')
  const [p90, setP90] = useState(listing.price_90 != null ? String(listing.price_90) : '')
  const [touched30, setTouched30] = useState(false)
  const [touched60, setTouched60] = useState(false)
  const [touched90, setTouched90] = useState(false)

  const n30 = Number(p30), n60 = Number(p60), n90 = Number(p90)

  const box30Bad = touched30 && (!Number.isFinite(n30) || n30 < floor)
  const box60Bad = touched60 && (!Number.isFinite(n60) || n60 < floor || (touched30 && n60 <= n30))
  const box90Bad = touched90 && (!Number.isFinite(n90) || n90 < floor || (touched60 && n90 <= n60))

  const pricingValid =
    Number.isFinite(n30) && Number.isFinite(n60) && Number.isFinite(n90) &&
    n30 >= floor && n60 >= floor && n90 >= floor &&
    n30 < n60 && n60 < n90

  const perDay30 = n30 > 0 ? (n30 / 30).toFixed(2) : ''
  const perDay60 = n60 > 0 ? (n60 / 60).toFixed(2) : ''
  const perDay90 = n90 > 0 ? (n90 / 90).toFixed(2) : ''
  const off60 = n30 > 0 && n60 > 0 ? Math.max(0, Math.round((1 - (n60 / 60) / (n30 / 30)) * 100)) : null
  const off90 = n30 > 0 && n90 > 0 ? Math.max(0, Math.round((1 - (n90 / 90) / (n30 / 30)) * 100)) : null

  const pricingError =
    box30Bad ? `Minimum ${symbol}${floor}`
    : box60Bad ? (n60 <= n30 ? '60-day price must be higher than 30-day' : `Minimum ${symbol}${floor}`)
    : box90Bad ? (n90 <= n60 ? '90-day price must be higher than 60-day' : `Minimum ${symbol}${floor}`)
    : ''

  // --- Toast ---
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const showToast = useCallback((payload: ToastPayload) => {
    setToast(payload)
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_LIFECYCLE_MS)
  }, [])

  // --- Copy URL ---
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const fullPaymentUrl = `${PAYMENT_BASE}/${listing.payment_link_token}`
  const onCopy = () => {
    navigator.clipboard.writeText(`https://${fullPaymentUrl}`).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      showToast({ emoji: '📡', message: "Couldn't copy. Try again." })
    })
  }

  // Track whether current values differ from the initial prefill so we
  // avoid no-op PATCH round-trips on a first-time blur where the user
  // hasn't actually changed anything.
  const isPriceDirty =
    n30 !== (listing.price_30 ?? NaN) ||
    n60 !== (listing.price_60 ?? NaN) ||
    n90 !== (listing.price_90 ?? NaN)

  const patchPricing = useCallback(async () => {
    if (!pricingValid) return
    // PATCH route is full-replace-shape (category XOR + media_type unconditional).
    // We re-send the existing row's category + media alongside the edited prices
    // so the server-side gates pass. Principle E — match AddListingClient edit
    // mode's PATCH payload shape exactly.
    const payload: Record<string, unknown> = {
      category_id: listing.category_id,
      category_custom: listing.category_id ? null : listing.category_custom,
      media_type: listing.media_type,
      photo_url_1: listing.photo_url_1,
      photo_url_2: listing.photo_url_2,
      photo_url_3: listing.photo_url_3,
      video_url: listing.video_url,
      price_30: n30,
      price_60: n60,
      price_90: n90,
    }
    try {
      const res = await fetch(`/api/ambassador/model/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) showToast({ emoji: '📡', message: "Couldn't save prices. Try again." })
    } catch {
      showToast({ emoji: '📡', message: "Couldn't reach server. Try again." })
    }
  }, [pricingValid, n30, n60, n90, listing, showToast])

  const onBlurPrice = (setTouched: (v: boolean) => void) => () => {
    setTouched(true)
    if (isPriceDirty) void patchPricing()
  }

  const onSend = async () => {
    if (!pricingValid) return
    if (isPriceDirty) await patchPricing()
    const message =
      `Hello\n\nI've just added you to my Beauty Squad on WeLoveDecode🌸\n\nConfirm here to activate: https://${fullPaymentUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    router.push('/model/listings')
  }

  const onSkip = () => router.push('/model/listings')

  const onPriceInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/[^0-9]/g, ''))
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative',
    }}>
      {/* Back arrow */}
      <div style={{ padding: '36px 20px 0' }}>
        <BackArrow fallbackHref={backHref} />
      </div>

      {/* Progress tracker — Send link is the active step */}
      <div style={{ padding: '20px 20px 0' }}>
        <ProgressTracker steps={steps} step={2} padding="0" />
      </div>

      {/* Title + subline */}
      <div style={{ padding: '40px 20px 6px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 8 }}>
          {title}
        </div>
        {subline && (
          <div style={{ fontSize: 12, color: '#777', lineHeight: 1.5 }}>{subline}</div>
        )}
      </div>

      {/* Category + professional name */}
      <div style={{ padding: '24px 20px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: '#e91e8c', fontWeight: 700, marginBottom: 6 }}>
          {listing.category_label ?? listing.category_custom ?? ''}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
          {professional.name}
        </div>
      </div>

      {/* Pricing (PriceBox ×3, same as Add Listing) */}
      <div style={{ padding: '0 20px 22px', display: 'flex', gap: 8 }}>
        <PriceBox
          days={30} value={p30} onInput={onPriceInput(setP30)}
          onFocus={() => setTouched30(false)} onBlur={onBlurPrice(setTouched30)}
          perDay={perDay30} symbol={symbol} bad={box30Bad}
        />
        <PriceBox
          days={60} value={p60} onInput={onPriceInput(setP60)}
          onFocus={() => setTouched60(false)} onBlur={onBlurPrice(setTouched60)}
          perDay={perDay60} symbol={symbol} bad={box60Bad} offPct={off60}
        />
        <PriceBox
          days={90} value={p90} onInput={onPriceInput(setP90)}
          onFocus={() => setTouched90(false)} onBlur={onBlurPrice(setTouched90)}
          perDay={perDay90} symbol={symbol} bad={box90Bad} offPct={off90}
        />
      </div>

      {pricingError && (
        <div style={{ fontSize: 11, color: '#e91e8c', textAlign: 'center', fontWeight: 600, padding: '0 20px 14px' }}>
          {pricingError}
        </div>
      )}

      {/* Payment link row — URL + copy icon, morphs to Copied! for 2s */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          border: '1.5px solid #2a2a2a', borderRadius: 12,
          padding: '14px 16px', display: 'flex',
          alignItems: 'center',
          justifyContent: copied ? 'center' : 'space-between',
          gap: 8,
        }}>
          {copied ? (
            <>
              <span style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>Copied!</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#777' }}>{fullPaymentUrl}</span>
              <svg onClick={onCopy} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', flexShrink: 0 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </>
          )}
        </div>
      </div>

      {/* Send via WhatsApp */}
      <div style={{ padding: '0 20px 14px' }}>
        <div
          onClick={pricingValid ? onSend : undefined}
          style={{
            background: pricingValid ? '#e91e8c' : '#1f1f1f',
            borderRadius: 12, padding: 16,
            fontSize: 14, fontWeight: 700,
            color: pricingValid ? '#fff' : '#555',
            textAlign: 'center',
            cursor: pricingValid ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Send via WhatsApp
        </div>
      </div>

      {/* Skip for now */}
      <div style={{ padding: '0 20px 28px', textAlign: 'center' }}>
        <span onClick={onSkip} style={{ fontSize: 12, color: '#555', cursor: 'pointer' }}>
          Skip for now ›
        </span>
      </div>

      {/* Toast — canonical amb-toast-in/out animation */}
      {toast && (
        <div
          key={toastKey}
          style={{
            position: 'fixed', top: 50, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(28,28,28,0.95)', border: '1px solid #333',
            color: '#fff', fontSize: 12, padding: '10px 18px', borderRadius: 24,
            zIndex: 50, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
            pointerEvents: 'none',
            animation:
              'amb-toast-in 1200ms cubic-bezier(.2,.7,.2,1) forwards, ' +
              'amb-toast-out 1200ms cubic-bezier(.5,.2,.8,.1) 4000ms forwards',
          }}
        >
          {toast.emoji && <span style={{ fontSize: 14, lineHeight: 1 }}>{toast.emoji}</span>}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
