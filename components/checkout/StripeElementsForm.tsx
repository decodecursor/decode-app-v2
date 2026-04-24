'use client'

/**
 * The Stripe Elements surface — extracted from PaymentModalShell per
 * G12 item #8 so both files stay under the 300-LOC alarm. Lives inside
 * a parent <Elements stripe={} options={{ clientSecret }}> provider
 * which the shell owns; this file assumes the provider context is
 * available and panics at runtime via useStripe/useElements returning
 * null if called outside one.
 *
 * Two-screen UX per checkout spec §5 + mockup:
 *   S1 (wallet) — ExpressCheckoutElement (Apple Pay / Google Pay / Link)
 *                 + "Pay by card" outline toggle that flips to S2
 *   S2 (card)   — PaymentElement card form + pink Pay button
 *
 * Detection: ExpressCheckoutElement's onReady reports
 * availablePaymentMethods. If none are available (desktop Chrome without
 * Link, Android without GooglePay, etc.) we auto-advance to S2 so the
 * user never sees an empty S1. A 2.5s fallback timer handles the case
 * where onReady never fires (SDK load failure, network hiccup).
 *
 * Both elements stay mounted once rendered — visibility toggled with
 * CSS display:none rather than conditional rendering. This preserves
 * element registration with the Elements instance so a mobile user
 * tapping "Pay by card" after S1 gets an immediately-interactive
 * PaymentElement with no lazy-mount race window.
 *
 * confirm() is wrapped in try/catch to surface async SDK throws in
 * the error banner instead of leaving the button stuck at "Processing…"
 * (prior live-prod bug, fixed in commit a34b6a5, preserved here).
 */

import { useEffect, useState } from 'react'
import { ExpressCheckoutElement, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

type Mode = 'wallet' | 'card'
type WalletState = 'unknown' | 'available' | 'none'

const WALLET_DETECT_TIMEOUT_MS = 2500

interface Props {
  paymentIntentId: string
  amountLabel: string
  onCancel: () => void
}

function buildReturnUrl(paymentIntentId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
  return `${base}/listing/confirmation/${paymentIntentId}`
}

export function StripeElementsForm({ paymentIntentId, amountLabel, onCancel }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [mode, setMode] = useState<Mode>('wallet')
  const [walletState, setWalletState] = useState<WalletState>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Fallback — if ExpressCheckoutElement's onReady never fires
  // (network hiccup, SDK load failure), after 2.5s treat as no wallets
  // and fall through to the card form rather than stranding the user.
  useEffect(() => {
    if (walletState !== 'unknown') return
    const t = setTimeout(() => {
      setWalletState((prev) => (prev === 'unknown' ? 'none' : prev))
    }, WALLET_DETECT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [walletState])

  // When detection reports no wallets, auto-advance to the card surface.
  // This is the "desktop Chrome without Link" path and the
  // Android-without-GooglePay path — user should never see the empty
  // S1 wallet view.
  useEffect(() => {
    if (walletState === 'none' && mode === 'wallet') setMode('card')
  }, [walletState, mode])

  // beforeunload guard — fires only while a confirmPayment call is in flight.
  useEffect(() => {
    if (!processing) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [processing])

  // Single confirm path. ExpressCheckoutElement fires its own onConfirm
  // after the wallet sheet resolves; the Pay button fires this directly
  // for the Payment Element card path. Both call stripe.confirmPayment
  // with the shared `elements` instance — Stripe routes the submit to
  // whichever surface the user engaged.
  const confirm = async () => {
    if (!stripe || !elements || processing) return
    setError(null)
    setProcessing(true)
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: buildReturnUrl(paymentIntentId) },
      })
      if (result.error) {
        setError(result.error.message ?? 'Payment could not be completed. Try again.')
        setProcessing(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment could not be completed. Try again.'
      console.error('[StripeElementsForm] confirmPayment threw:', err)
      setError(msg)
      setProcessing(false)
    }
  }

  // Disabled state drives BOTH the disabled attr AND the visual style,
  // so clicks on a non-interactive button aren't silently dropped while
  // the button still looks "active" (live-prod bug, a34b6a5 fix).
  const btnDisabled = !stripe || !elements || processing

  const walletVisible = mode === 'wallet' && walletState === 'available'
  const cardVisible = mode === 'card'

  return (
    <div>
      {/* S1 wallet surface. Stripe renders its own native-styled wallet
          button here; we cannot use the mockup's custom .applebtn HTML
          because Apple/Google require their own branded button. */}
      <div style={{ display: walletVisible ? 'block' : 'none', padding: '4px 0 10px' }}>
        <ExpressCheckoutElement
          onReady={(e) => {
            const methods = e.availablePaymentMethods
            const hasAny = !!methods && (methods.applePay === true || methods.googlePay === true || methods.link === true || methods.paypal === true)
            setWalletState(hasAny ? 'available' : 'none')
          }}
          onConfirm={confirm}
          options={{ buttonHeight: 52 }}
        />
      </div>

      {walletVisible && (
        <button
          type="button"
          onClick={() => setMode('card')}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: 'transparent', border: '1.5px solid #e91e8c',
            color: '#e91e8c', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="14" viewBox="0 0 24 16" fill="none" stroke="#e91e8c" strokeWidth="2" strokeLinecap="round"><rect x="1" y="1" width="22" height="14" rx="2" /><line x1="1" y1="6" x2="23" y2="6" /></svg>
          Pay by card
        </button>
      )}

      {walletState === 'unknown' && (
        <div style={{ padding: '28px 0', textAlign: 'center', color: '#666', fontSize: 12 }}>
          Loading payment options…
        </div>
      )}

      {/* S2 card surface. Always mounted from first render; visibility
          toggled with CSS so PaymentElement is ready the instant user
          taps "Pay by card" — no lazy-mount race. */}
      <div style={{ display: cardVisible ? 'block' : 'none' }}>
        <div style={{ padding: '0 0 14px' }}>
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={btnDisabled}
          style={{
            width: '100%', padding: '16px', borderRadius: 10,
            background: btnDisabled ? '#1f1f1f' : '#e91e8c',
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: btnDisabled ? 'not-allowed' : 'pointer',
            opacity: btnDisabled && !processing ? 0.7 : 1,
            marginBottom: 10,
          }}
        >{processing ? 'Processing…' : `Pay ${amountLabel}`}</button>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, fontSize: 10, color: '#555', marginBottom: 12 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          Secure payment by Stripe
        </div>
      </div>

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
