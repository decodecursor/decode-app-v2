'use client'

/**
 * Payment modal shell — outer chrome + PaymentIntent-create state machine
 * + <Elements> provider. Hosts <StripeElementsForm/> as its child, which
 * owns everything inside the Elements context (wallet detection, mode
 * toggle, Pay button, confirm call). G12 item #8 split: this file was
 * previously components/checkout/PaymentModal.tsx (pre-decompose 373 LOC);
 * the Stripe Elements surface carved out to StripeElementsForm.tsx in
 * Slice 4B+4C commit 7.
 *
 * Two-screen UX per checkout spec §5 + mockup:
 *   S1 — wallet (Apple/Google Pay/Link) with "Pay by card" toggle
 *   S2 — card form with pink Pay button
 * Detection + mode state live in the child form; this shell renders
 * identical chrome for both views (amount, chips, in-app webview banner).
 *
 * PaymentIntent create is lazy — fires on first modal open for the
 * currently-selected package. Idempotency lives server-side (see
 * /api/checkout/listing). Re-opening the modal with the same package
 * reuses the cached PI via the 24h idempotency window.
 */

import { useEffect, useRef, useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { formatCurrency } from '@/lib/ambassador/utils'
import type { PackageDays } from '@/lib/checkout/checkout-shape'
import { StripeElementsForm } from './StripeElementsForm'

interface Props {
  isOpen: boolean
  token: string
  packageDays: PackageDays
  amount: number
  currency: string
  // Turnstile token sourced from CheckoutClient (widget lives on the
  // checkout page, not the modal, so the token is warm when the modal
  // opens). Empty string is fine — the server-side verifyTurnstile
  // helper fail-opens on empty per its documented behavior.
  turnstileToken: string
  onClose: () => void
}

type PIState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; clientSecret: string; paymentIntentId: string }
  | { status: 'error'; message: string }

function isInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /WhatsApp|Instagram|FBAN|FBAV/i.test(navigator.userAgent)
}

export function PaymentModal({ isOpen, token, packageDays, amount, currency, turnstileToken, onClose }: Props) {
  const [pi, setPi] = useState<PIState>({ status: 'idle' })
  // Cache by package_days so toggling packages doesn't refetch uselessly,
  // and reopening the same package is instant. Cache is per-modal-mount,
  // so turnstileToken rotation during a session doesn't leak stale PIs.
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
      body: JSON.stringify({ token, package_days: packageDays, turnstileToken }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          // Prefer the real Stripe message the server now passes through
          // (see app/api/checkout/listing catch block). Falls back through
          // stripe_code → generic error slug → HTTP status so we never
          // surface a naked "HTTP 500" when a real error exists.
          throw new Error(body?.message ?? body?.stripe_code ?? body?.error ?? `HTTP ${res.status}`)
        }
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
  }, [isOpen, packageDays, token, turnstileToken])

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
            <StripeElementsForm paymentIntentId={pi.paymentIntentId} amountLabel={amountLabel} onCancel={onClose} />
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

