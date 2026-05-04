'use client'

/**
 * Receipt page for /listing/confirmation/[pi_id] — state machine over
 * GET /api/listings/by-payment-intent/[pi_id] (commit 3). Four render
 * branches per listing_payment_confirmation_final_UI_Spec.md §2.3:
 * active (default), expired, refunded (overrides expired), not-found.
 *
 * Pending-webhook retry: when the API returns `status: 'pending_payment'`
 * (no payment row yet) we poll every 1s up to 5 times before giving up
 * and rendering the not-found fallback (spec §2.5 optimistic render is
 * deferred — we'd need the receipt shape to render optimistically and
 * we don't have it, so "receipt not found" + "check your email" copy
 * is the safer landing state).
 */

import { useEffect, useRef, useState } from 'react'
import { formatCurrencyText } from '@/lib/ambassador/currency-format'

type Receipt = {
  reference: string
  ambassador: { id: string; name: string; slug: string } | null
  professional: { name: string } | null
  category: string | null
  duration_days: number
  active_until: string
  amount: number
  currency: string
  presentment_amount: number | null
  presentment_currency: string | null
  paid_at: string
  status: string
  is_expired: boolean
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function ConfirmationClient({ piId }: { piId: string }) {
  const [state, setState] = useState<UiState>({ kind: 'loading' })
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const attempt = async () => {
      try {
        const res = await fetch(`/api/listings/by-payment-intent/${piId}`, { cache: 'no-store' })
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
          animation: 'confirm-spin 0.8s linear infinite',
        }}
      />
      <div style={{ fontSize: 13, color: '#888' }}>Loading your receipt…</div>
      <style>{`@keyframes confirm-spin { to { transform: rotate(360deg) } }`}</style>
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
  const ambassadorName = receipt.ambassador?.name ?? 'the ambassador'
  const subtitle = receipt.is_refunded && receipt.refunded_at
    ? `This payment was refunded on ${formatDate(receipt.refunded_at)}`
    : receipt.is_expired
      ? `Your listing expired on ${ambassadorName}'s page`
      : `Your listing is live on ${ambassadorName}'s page`
  const heroTitle = receipt.is_refunded ? 'Refunded' : "You're live!"
  const showEmoji = !receipt.is_refunded
  const showCta = !receipt.is_refunded && !receipt.is_expired && receipt.ambassador
  const presentmentSubtitle = receipt.presentment_amount != null && receipt.presentment_currency && receipt.presentment_currency.toLowerCase() !== receipt.currency.toLowerCase()
    ? `Charged as ${receipt.presentment_currency.toUpperCase()} ${receipt.presentment_amount.toLocaleString()} on your card`
    : null

  const supportHref = `mailto:support@welovedecode.com?subject=${encodeURIComponent(`Support request — ${receipt.reference}`)}`

  return (
    <div style={{ paddingTop: 60, paddingBottom: 40 }}>
      {receipt.is_refunded && receipt.refunded_at && (
        <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '12px 14px', textAlign: 'center', fontSize: 12, color: '#f87171', marginBottom: 24 }}>
          This payment was refunded on {formatDate(receipt.refunded_at)}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        {showEmoji && <div style={{ fontSize: 42, marginBottom: 10 }}>🎉</div>}
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 10px', color: '#fff', letterSpacing: '-0.4px' }}>{heroTitle}</h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>{subtitle}</p>
      </div>

      <div style={{ background: '#1c1c1c', border: '1px solid #262626', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {receipt.ambassador && <ReceiptRow label="Visible on" value={`${receipt.ambassador.name}'s page`} />}
        {receipt.category && <ReceiptRow label="Category" value={receipt.category} />}
        <ReceiptRow label="Duration" value={`${receipt.duration_days} days`} />
        <ReceiptRow label="Active until" value={formatDate(receipt.active_until)} />
        <ReceiptRow
          label="Amount"
          value={formatCurrencyText('amount-with-code', receipt.currency, receipt.amount, { decimals: 'flex-0-2' })}
          sub={presentmentSubtitle}
        />
        <ReceiptRow label="Purchase Date" value={formatDate(receipt.paid_at)} />
        <ReceiptRow label="Reference" value={receipt.reference} />
        {receipt.is_refunded && receipt.refund_amount != null && receipt.refunded_at && (
          <ReceiptRow
            label="Refunded"
            value={`${formatCurrencyText('amount-with-code', receipt.currency, receipt.refund_amount, { decimals: 'flex-0-2' })} · ${formatDate(receipt.refunded_at)}`}
            danger
          />
        )}
      </div>

      {showCta && receipt.ambassador && (
        <a
          href={`/${receipt.ambassador.slug}`}
          style={{
            display: 'block', width: '100%', padding: '16px', borderRadius: 12,
            background: '#e91e8c', color: '#fff', fontSize: 14, fontWeight: 700,
            textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', marginBottom: 20,
          }}
        >
          See your listing on {receipt.ambassador.name}&rsquo;s page →
        </a>
      )}

      {!receipt.is_refunded && receipt.is_expired && receipt.ambassador && (
        <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
          This listing has expired. Contact {receipt.ambassador.name} if you&rsquo;d like to list again.
        </p>
      )}

      <p style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 14 }}>
        We&rsquo;ve sent a confirmation to your email
      </p>

      <div style={{ textAlign: 'center' }}>
        <a href={supportHref} style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>
          Need help? Contact support
        </a>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value, sub, danger }: { label: string; value: string; sub?: string | null; danger?: boolean }) {
  const valueColor = danger ? '#f87171' : '#fff'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 2 }}>{label}</span>
      <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ fontSize: 13, color: valueColor, fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: '#666' }}>{sub}</span>}
      </span>
    </div>
  )
}
