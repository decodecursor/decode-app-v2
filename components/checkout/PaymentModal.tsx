'use client'

/**
 * Stripe payment modal for the listing checkout flow.
 *
 * Spec: checkout_for_listing-professional_final_UI_Spec.md §5.
 *
 * Two view modes inside one modal shell — Express Checkout (Apple Pay
 * / Google Pay / Link) as the default surface, Payment Element (card
 * only) as the "Pay by card" fallback. A single stripe.confirmPayment()
 * call drives both; Stripe redirects to the return_url on success.
 *
 * PaymentIntent create is lazy — fires on first modal open for the
 * currently-selected package. Idempotency lives server-side (see
 * /api/checkout/listing). Re-opening the modal with the same package
 * reuses the cached PI via the 24h idempotency window.
 *
 * beforeunload guard is armed for the active-payment window so a
 * closed tab during confirm doesn't orphan the PI silently.
 */

import { useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { formatCurrency } from '@/lib/ambassador/utils'
import type { PackageDays } from '@/lib/checkout/checkout-shape'

interface Props {
  isOpen: boolean
  token: string
  packageDays: PackageDays
  amount: number
  currency: string
  onClose: () => void
}

type PIState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; clientSecret: string; paymentIntentId: string }
  | { status: 'error'; message: string }

function buildReturnUrl(paymentIntentId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
  return `${base}/listing/confirmation/${paymentIntentId}`
}

function isInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /WhatsApp|Instagram|FBAN|FBAV/i.test(navigator.userAgent)
}

export function PaymentModal({ isOpen, token, packageDays, amount, currency, onClose }: Props) {
  const [pi, setPi] = useState<PIState>({ status: 'idle' })
  // Cache by package_days so toggling packages doesn't refetch uselessly,
  // and reopening the same package is instant.
  const piCache = useRef<Map<PackageDays, { clientSecret: string; paymentIntentId: string }>>(new Map())

  useEffect(() => {
    if (!isOpen) return
    const cached = piCache.current.get(packageDays)
    if (cached) {
      setPi({ status: 'ready', ...cached })
      return
    }
    let cancelled = false
    setPi({ status: 'loading' })
    fetch('/api/checkout/listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, package_days: packageDays }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
        if (!body?.client_secret || !body?.payment_intent_id) throw new Error('malformed_response')
        return body as { client_secret: string; payment_intent_id: string }
      })
      .then((body) => {
        if (cancelled) return
        piCache.current.set(packageDays, { clientSecret: body.client_secret, paymentIntentId: body.payment_intent_id })
        setPi({ status: 'ready', clientSecret: body.client_secret, paymentIntentId: body.payment_intent_id })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[PaymentModal] PI create failed:', err)
        setPi({ status: 'error', message: err?.message ?? 'Could not start payment' })
      })
    return () => { cancelled = true }
  }, [isOpen, packageDays, token])

  if (!isOpen) return null

  const amountLabel = formatCurrency(amount, currency)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f0f0f',
          borderTop: '1px solid #1f1f1f',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 560,
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '12px 20px 28px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
          <div style={{ width: 44, height: 4, borderRadius: 2, background: '#333' }} />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: '#1c1c1c', border: '1px solid #262626',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div style={{ textAlign: 'center', padding: '18px 0 14px' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>{amountLabel}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <Chip>One-time</Chip>
            <Chip>No subscription</Chip>
            <Chip>{packageDays}-day package</Chip>
          </div>
        </div>

        {isInAppWebView() && (
          <div style={{ fontSize: 11, color: '#888', background: '#161616', border: '1px solid #262626', borderRadius: 8, padding: '10px 12px', textAlign: 'center', marginBottom: 14 }}>
            Open in Safari/Chrome for faster checkout with Apple Pay
          </div>
        )}

        {pi.status === 'loading' && (
          <div style={{ padding: '28px 0', textAlign: 'center', color: '#666', fontSize: 13 }}>Loading payment…</div>
        )}

        {pi.status === 'error' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{pi.message}</div>
            <button
              onClick={() => { piCache.current.delete(packageDays); setPi({ status: 'idle' }); }}
              style={{ fontSize: 12, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >Try again</button>
          </div>
        )}

        {pi.status === 'ready' && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: pi.clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#e91e8c' } } } satisfies StripeElementsOptions}
          >
            <PaymentSurface paymentIntentId={pi.paymentIntentId} amountLabel={amountLabel} onCancel={onClose} />
          </Elements>
        )}
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, color: '#ccc', padding: '5px 10px', borderRadius: 20, background: '#1c1c1c', border: '1px solid #262626', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      {children}
    </span>
  )
}

function PaymentSurface({ paymentIntentId, amountLabel, onCancel }: { paymentIntentId: string; amountLabel: string; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [mode, setMode] = useState<'default' | 'card'>('default')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // beforeunload guard — fires only while a confirmPayment call is in flight.
  useEffect(() => {
    if (!processing) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [processing])

  const confirm = async () => {
    if (!stripe || !elements || processing) return
    setError(null)
    setProcessing(true)
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: buildReturnUrl(paymentIntentId) },
    })
    // Success path redirects to return_url — this line only runs on failure.
    if (result.error) {
      const message = result.error.message ?? 'Payment could not be completed. Try again.'
      setError(message)
      setProcessing(false)
    }
  }

  return (
    <div>
      {mode === 'default' ? (
        <>
          <div style={{ padding: '4px 0 12px' }}>
            <ExpressCheckoutElement onConfirm={confirm} options={{ buttonHeight: 52 }} />
          </div>
          <button
            type="button"
            onClick={() => setMode('card')}
            style={{ width: '100%', padding: '14px', borderRadius: 10, background: 'transparent', border: '1.5px solid #262626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
          >Pay by card</button>
        </>
      ) : (
        <>
          <div style={{ padding: '4px 0 14px' }}>
            <PaymentElement options={{ layout: 'tabs' }} />
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={!stripe || !elements || processing}
            style={{
              width: '100%', padding: '16px', borderRadius: 10,
              background: processing ? '#1f1f1f' : '#e91e8c',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: processing ? 'not-allowed' : 'pointer', marginBottom: 10,
            }}
          >{processing ? 'Processing…' : `Pay ${amountLabel}`}</button>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, fontSize: 10, color: '#555', marginBottom: 12 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Secure payment by Stripe
          </div>
        </>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          style={{ fontSize: 12, color: '#777', background: 'transparent', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', padding: '6px 10px' }}
        >Cancel</button>
      </div>
    </div>
  )
}
