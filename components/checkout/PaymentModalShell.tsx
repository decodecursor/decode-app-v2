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

import { useEffect, useMemo, useRef, useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { formatCurrency } from '@/lib/ambassador/utils'
import type { PackageDays } from '@/lib/checkout/checkout-shape'
import { StripeElementsForm } from './StripeElementsForm'

interface Props {
  isOpen: boolean
  token: string
  // Listings pass the selected package (drives cache key + body field).
  // Wish-checkout (Slice 5C) leaves this undefined — there's no package
  // concept for a single-gift purchase. When undefined, the cache key
  // falls back to a JSON hash of bodyExtras so the cache still de-dupes
  // by meaningful payload content.
  packageDays?: PackageDays
  amount: number
  currency: string
  // Turnstile token sourced from CheckoutClient (widget lives on the
  // checkout page, not the modal, so the token is warm when the modal
  // opens). Empty string is fine — the server-side verifyTurnstile
  // helper fail-opens on empty per its documented behavior.
  turnstileToken: string
  onClose: () => void

  // ----- Multi-flow parameterization (Slice 5B-3, hardening item 19) -----
  // Defaults preserve listings-checkout byte-identical behavior so this
  // commit is a pure refactor for the existing consumer; Slice 5C
  // wish-checkout passes explicit values for all four.

  // POST endpoint for PI-create. Default: listings checkout.
  endpointPath?: string
  // Stripe confirmParams.return_url path builder. Receives the PI id and
  // returns an absolute path (no origin). The form prepends NEXT_PUBLIC_APP_URL.
  // Default: legacy /listing/confirmation/{pi_id}.
  returnPathBuilder?: (paymentIntentId: string) => string
  // Pill chips rendered above the in-app-webview banner. Default derives
  // from packageDays (current listings shape: One-time / No subscription /
  // {N}-day package). Wish-checkout will pass [{label: 'One gift'}].
  chips?: ReadonlyArray<{ label: string }>
  // Extra fields merged into the PI-create POST body alongside `token`,
  // optional `package_days`, and `turnstileToken`. Wish-checkout passes
  // { wish_id, gifter_name, gifter_instagram, gifter_is_anonymous }.
  bodyExtras?: Record<string, unknown>
  // Fired synchronously when the PI-create POST returns non-OK, BEFORE
  // the shell sets pi.status='error'. Lets the consumer act on
  // structured error responses (e.g. wish-checkout's 409 → router.push
  // to /wish/taken). Receives the parsed body + HTTP status. Defaults
  // to undefined → shell behavior unchanged for listings.
  onPiCreateError?: (body: unknown, status: number) => void
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

const DEFAULT_ENDPOINT_PATH = '/api/checkout/listing'
const DEFAULT_RETURN_PATH_BUILDER = (pi: string) => `/listing/confirmation/${pi}`

export function PaymentModal({
  isOpen, token, packageDays, amount, currency, turnstileToken, onClose,
  endpointPath = DEFAULT_ENDPOINT_PATH,
  returnPathBuilder = DEFAULT_RETURN_PATH_BUILDER,
  chips,
  bodyExtras,
  onPiCreateError,
}: Props) {
  // Stable ref to the latest onPiCreateError so the PI-create effect can
  // call it without depending on (and re-firing for) a fresh callback
  // identity from an inline-arrow consumer.
  const onPiCreateErrorRef = useRef(onPiCreateError)
  onPiCreateErrorRef.current = onPiCreateError
  const [pi, setPi] = useState<PIState>({ status: 'idle' })
  // H2: lifted from StripeElementsForm so we can gate the dim-background
  // close handler on it (mirrors the existing Cancel-button gate inside
  // the form). Form pushes its processing state up via onProcessingChange.
  const [formProcessing, setFormProcessing] = useState(false)
  // PI cache, keyed by a string derived from the meaningful identifying
  // payload — packageDays for listings (the original 30/60/90 cache),
  // a JSON hash of bodyExtras otherwise (wish-checkout: hash of wish_id +
  // gifter info, so changing the gifter name invalidates the cache and
  // forces a fresh PI). Survives modal close/reopen but is per-mount.
  const piCache = useRef<Map<string, { clientSecret: string; paymentIntentId: string }>>(new Map())
  const cacheKey =
    packageDays !== undefined ? String(packageDays) : JSON.stringify(bodyExtras ?? {})
  // H4: keep an always-fresh ref to the latest turnstileToken so the
  // PI-create effect can read the current value at fetch time without
  // listing the token in its deps. Listing it caused pointless re-runs
  // every time Cloudflare rotated the token (default 30 min, plus
  // expired/error callbacks), which thrashed the Elements options
  // object and risked an in-flight payment getting reconciled mid-confirm.
  const turnstileTokenRef = useRef(turnstileToken)
  turnstileTokenRef.current = turnstileToken

  useEffect(() => {
    if (!isOpen) return
    const cached = piCache.current.get(cacheKey)
    if (cached) {
      setPi({ status: 'ready', ...cached })
      return
    }
    let cancelled = false
    setPi({ status: 'loading' })
    fetch(endpointPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        ...(packageDays !== undefined ? { package_days: packageDays } : {}),
        ...(bodyExtras ?? {}),
        turnstileToken: turnstileTokenRef.current,
      }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          // Fire structured-error callback BEFORE throwing so wish-checkout
          // can route 409 → /wish/taken before the user sees the error
          // message in the modal. The callback fires synchronously; the
          // throw still happens so the shell's normal error-state path
          // runs (cached PI invalidated, Try-again button surfaced) for
          // any consumer that doesn't navigate away.
          onPiCreateErrorRef.current?.(body, res.status)
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
        piCache.current.set(cacheKey, { clientSecret: body.client_secret, paymentIntentId: body.payment_intent_id })
        setPi({ status: 'ready', clientSecret: body.client_secret, paymentIntentId: body.payment_intent_id })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[PaymentModal] PI create failed:', err)
        setPi({ status: 'error', message: err?.message ?? 'Could not start payment' })
      })
    return () => { cancelled = true }
  }, [isOpen, cacheKey, token, endpointPath, packageDays, bodyExtras])

  // H1: memoize Elements options against pi.clientSecret so a parent
  // re-render (e.g. turnstileToken state churn upstream) doesn't pass
  // a new options object identity to <Elements>, which would trigger a
  // Stripe-side reconciliation that's unsafe while a payment is in
  // flight. Per Stripe React docs, options must be stable; clientSecret
  // cannot change on a mounted Elements provider — combine with the
  // explicit key={pi.clientSecret} below for safe transitions when the
  // user switches packages and a fresh PI is created.
  const clientSecret = pi.status === 'ready' ? pi.clientSecret : null
  const elementsOptions = useMemo<StripeElementsOptions | null>(
    () => (clientSecret
      ? { clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#e91e8c' } } }
      : null),
    [clientSecret],
  )

  if (!isOpen) return null

  const amountLabel = formatCurrency(amount, currency)
  // Default chips preserve the listings shape (One-time / No subscription /
  // {N}-day package). When chips prop is passed (current listings call site
  // and Slice 5C wish-checkout both will), it wins; the default is here as
  // a defensive fallback for ad-hoc callers that omit chips.
  const effectiveChips: ReadonlyArray<{ label: string }> =
    chips ?? (packageDays !== undefined
      ? [{ label: 'One-time' }, { label: 'No subscription' }, { label: `${packageDays}-day package` }]
      : [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment"
      onClick={() => { if (!formProcessing) onClose() }}
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
          disabled={formProcessing}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: '#1c1c1c', border: '1px solid #262626',
            color: '#fff',
            cursor: formProcessing ? 'not-allowed' : 'pointer',
            opacity: formProcessing ? 0.5 : 1,
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
            {effectiveChips.map((c, i) => <Chip key={i}>{c.label}</Chip>)}
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
            {pi.message.startsWith('Too many attempts') ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
                  Too many attempts
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  {pi.message.replace(/^Too many attempts\.\s*/, '')}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{pi.message}</div>
            )}
            <button
              onClick={() => { piCache.current.delete(cacheKey); setPi({ status: 'idle' }); }}
              style={{ fontSize: 12, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >Try again</button>
          </div>
        )}

        {pi.status === 'ready' && elementsOptions && (
          <Elements key={pi.clientSecret} stripe={stripePromise} options={elementsOptions}>
            <StripeElementsForm
              paymentIntentId={pi.paymentIntentId}
              amountLabel={amountLabel}
              onCancel={onClose}
              onProcessingChange={setFormProcessing}
              returnPathBuilder={returnPathBuilder}
            />
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

