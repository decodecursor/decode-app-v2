'use client'

/**
 * Receipt page for /wish/confirmation/[pi_id] — sibling of
 * ConfirmationClient.tsx (listings). State machine over GET
 * /api/wishes/by-payment-intent/[pi_id]. Three render branches per
 * `_features/ambassador/wish-gift_payment_confirmation_for_gifter_final.html`:
 * active (default), refunded (overrides active), not-found.
 *
 * No "expired" branch — wishes don't have a duration concept (gifts
 * don't expire the way listings do).
 *
 * Pending-webhook retry: when the API returns `status: 'pending_payment'`
 * (no payment row yet) we poll every 1s up to 5 times before falling
 * through to the not-found view, matching the listings pattern exactly.
 *
 * Sibling shape rather than a generic shared component per Slice 5C
 * locked decision: ~150 LOC of intentional duplication is cheaper than
 * the abstraction would be at this slice count (rule of three not yet
 * crossed for receipt surfaces — this is the second).
 */

import { useEffect, useRef, useState } from 'react'
import { formatCurrencyText } from '@/lib/ambassador/currency-format'

type Receipt = {
  reference: string
  ambassador: { id: string; name: string; slug: string } | null
  wish: {
    id: string
    service_name: string
    professional_name: string | null
    professional_city: string | null
    professional_country: string | null
  } | null
  gifter: {
    name: string | null
    instagram: string | null
    is_anonymous: boolean
  }
  amount: number
  currency: string
  presentment_amount: number | null
  presentment_currency: string | null
  paid_at: string
  status: string
  is_refunded: boolean
  refunded_at: string | null
  refund_amount: number | null
}

type ApiResponse = Receipt | { status: 'pending_payment' }

type UiState =
  | { kind: 'loading' }
  | { kind: 'ready'; receipt: Receipt }
  | { kind: 'not_found' }

const MAX_RETRIES = 5
const RETRY_INTERVAL_MS = 1000

function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!withTime) return date
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}, ${time}`
}

export function WishConfirmationClient({ piId }: { piId: string }) {
  const [state, setState] = useState<UiState>({ kind: 'loading' })
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const attempt = async () => {
      try {
        const res = await fetch(`/api/wishes/by-payment-intent/${piId}`, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelRef.current) setState({ kind: 'not_found' })
          return
        }
        const body = (await res.json()) as ApiResponse
        if (cancelRef.current) return
        const isPending = 'status' in body && body.status === 'pending_payment' && !('reference' in body)
        if (isPending) {
          if (retries < MAX_RETRIES) {
            retries++
            timer = setTimeout(attempt, RETRY_INTERVAL_MS)
          } else {
            setState({ kind: 'not_found' })
          }
          return
        }
        setState({ kind: 'ready', receipt: body as Receipt })
      } catch {
        if (!cancelRef.current) setState({ kind: 'not_found' })
      }
    }

    attempt()
    return () => {
      cancelRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [piId])

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh', padding: '0 20px' }}>
      {state.kind === 'loading' && <LoadingView />}
      {state.kind === 'not_found' && <NotFoundView />}
      {state.kind === 'ready' && <ReceiptView receipt={state.receipt} />}
    </div>
  )
}

function LoadingView() {
  return (
    <div style={{ paddingTop: 200, textAlign: 'center' }}>
      <div
        aria-hidden="true"
        style={{
          width: 28, height: 28, margin: '0 auto 16px',
          border: '3px solid #262626', borderTopColor: '#e91e8c', borderRadius: '50%',
          animation: 'wg-spin 0.8s linear infinite',
        }}
      />
      <div style={{ fontSize: 13, color: '#888' }}>Loading your receipt&hellip;</div>
      <style>{`@keyframes wg-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function NotFoundView() {
  return (
    <div style={{ paddingTop: 200, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14, color: '#fff' }}>Receipt not found</h1>
      <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 28 }}>
        We couldn&rsquo;t find this receipt.<br />
        Check your email for your payment confirmation.
      </p>
      <a href="mailto:support@welovedecode.com" style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>
        Need help? Contact support
      </a>
    </div>
  )
}

function ReceiptView({ receipt }: { receipt: Receipt }) {
  const ambassadorFirstName = receipt.ambassador?.name?.split(' ')[0] ?? 'them'
  const ambassadorFullName = receipt.ambassador?.name ?? 'the ambassador'

  const heroEmoji = receipt.is_refunded ? null : '❤️'
  const heroTitle = receipt.is_refunded ? 'Refunded' : 'Wish granted!'
  const heroSubtitle = receipt.is_refunded && receipt.refunded_at
    ? `This payment was refunded on ${formatDate(receipt.refunded_at)}`
    : `Your gift is on its way to ${ambassadorFirstName}`

  const presentmentSubtitle = receipt.presentment_amount != null
    && receipt.presentment_currency
    && receipt.presentment_currency.toLowerCase() !== receipt.currency.toLowerCase()
    ? `Charged as ${receipt.presentment_currency.toUpperCase()} ${receipt.presentment_amount.toLocaleString()} on your card`
    : null

  const supportHref = `mailto:support@welovedecode.com?subject=${encodeURIComponent(`Support request — ${receipt.reference}`)}`
  const ambassadorPageUrl = receipt.ambassador?.slug ? `/${receipt.ambassador.slug}` : null

  // Wish "At" line: professional name + city/country if present.
  const locationText = receipt.wish?.professional_city && receipt.wish?.professional_country
    ? `${receipt.wish.professional_city}, ${receipt.wish.professional_country}`
    : receipt.wish?.professional_city ?? receipt.wish?.professional_country ?? ''
  const atValue = receipt.wish?.professional_name
    ? (locationText ? `${receipt.wish.professional_name} · ${locationText}` : receipt.wish.professional_name)
    : (locationText || '—')

  return (
    <div style={{ paddingTop: 60, paddingBottom: 40 }}>
      {receipt.is_refunded && receipt.refunded_at && (
        <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '12px 14px', textAlign: 'center', fontSize: 12, color: '#f87171', marginBottom: 24 }}>
          This payment was refunded on {formatDate(receipt.refunded_at)}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        {heroEmoji && <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>{heroEmoji}</div>}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#fff', letterSpacing: '-0.2px' }}>{heroTitle}</h1>
        <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{heroSubtitle}</p>
      </div>

      <div style={{ background: '#1c1c1c', borderRadius: 14, padding: '20px', marginBottom: 22 }}>
        {receipt.ambassador && <ReceiptRow label="Gifted to" value={ambassadorFullName} />}
        {receipt.wish && <ReceiptRow label="Service" value={receipt.wish.service_name} />}
        <ReceiptRow label="At" value={atValue} />
        <ReceiptRow label="Date" value={formatDate(receipt.paid_at, true)} />
        <ReceiptRow label="Reference" value={receipt.reference} />
        <ReceiptRow
          label="Amount"
          value={formatCurrencyText('amount-with-code', receipt.currency, receipt.amount, { decimals: 'flex-0-2' })}
          sub={presentmentSubtitle}
          last={!receipt.is_refunded}
        />
        {receipt.is_refunded && receipt.refund_amount != null && receipt.refunded_at && (
          <ReceiptRow
            label="Refunded"
            value={`${formatCurrencyText('amount-with-code', receipt.currency, receipt.refund_amount, { decimals: 'flex-0-2' })} · ${formatDate(receipt.refunded_at)}`}
            danger
            last
          />
        )}
      </div>

      {!receipt.is_refunded && ambassadorPageUrl && (
        <div style={{ padding: '0 0 16px', textAlign: 'center' }}>
          <a
            href={ambassadorPageUrl}
            style={{ fontSize: 14, color: '#e91e8c', fontWeight: 500, textDecoration: 'none' }}
          >
            See your name on {ambassadorFirstName}&rsquo;s page →
          </a>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 24 }}>
        We&rsquo;ve sent a confirmation to your email
      </p>

      <div style={{ textAlign: 'center' }}>
        <a href={supportHref} style={{ fontSize: 11, color: '#666', textDecoration: 'underline' }}>
          Need help? Contact support
        </a>
      </div>
    </div>
  )
}

function ReceiptRow({
  label, value, sub, danger, last,
}: {
  label: string
  value: string
  sub?: string | null
  danger?: boolean
  last?: boolean
}) {
  const valueColor = danger ? '#f87171' : '#fff'
  const labelColor = danger ? '#ef4444' : '#666'
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 9, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 2 }}>{label}</span>
        <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span style={{ fontSize: 14, color: valueColor, fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
          {sub && <span style={{ fontSize: 10, color: '#666' }}>{sub}</span>}
        </span>
      </div>
      {!last && <div style={{ height: 1, background: '#262626', margin: '14px 0' }} />}
    </>
  )
}
