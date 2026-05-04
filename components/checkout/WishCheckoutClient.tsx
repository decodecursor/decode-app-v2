'use client'

/**
 * Orchestrator for /pay/[token] when the token resolves to a wish.
 *
 * Sibling of CheckoutClient.tsx (listings). Visual fidelity to the
 * authoritative mockup `_features/ambassador/checkout_for_wish-gifter_final.html`:
 * cover → name + URL link + tagline → wish details (3 rows) → optional
 * gifter inputs collapsed when anonymous → anonymous toggle → Pay CTA.
 *
 * Modal flow consumes the parameterized PaymentModalShell + StripeElementsForm
 * shipped in 5B-3. Endpoint, return-URL builder, chips, and PI-create body
 * extras are all passed explicitly. The shell's onPiCreateError callback
 * (added in this slice) catches the 409 wish_already_taken response and
 * routes to /wish/taken before the user sees the error message in the modal.
 */

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { formatCurrencyText } from '@/lib/ambassador/currency-format'
import { formatLocation } from '@/lib/format-location'
import { useTurnstile } from '@/components/turnstile/TurnstileWidget'

// Slice 7C bundle remediation A: PaymentModal (and its Stripe.js +
// @stripe/react-stripe-js dependency tree) is dynamic-imported so the
// chunk is fetched ONLY when /pay/[token] mounts, not bundled into
// every ambassador page's First Load JS. Same shape as CheckoutClient.
const PaymentModal = dynamic(
  () => import('./PaymentModalShell').then((mod) => mod.PaymentModal),
  { ssr: false, loading: () => null },
)

export interface WishCheckoutAmbassador {
  slug: string
  first_name: string
  last_name: string | null
  cover_photo_url: string | null
  tagline: string | null
}

export interface WishCheckoutWish {
  id: string
  payment_link_token: string
  service_name: string
  professional_name: string | null
  professional_city: string | null
  professional_country: string | null
  price: number
  currency: string
}

interface Props {
  wish: WishCheckoutWish
  ambassador: WishCheckoutAmbassador
  shareUrl: string
}

const NAME_RE = /[^\p{L}\s\-']/gu

function sanitizeIg(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30)
}

function capFirstName(raw: string): string {
  const stripped = raw.replace(NAME_RE, '').slice(0, 70)
  if (stripped.length === 0) return stripped
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export function WishCheckoutClient({ wish, ambassador, shareUrl }: Props) {
  const router = useRouter()

  const ambassadorFirstName = ambassador.first_name
  const ambassadorFullName = `${ambassador.first_name}${ambassador.last_name ? ' ' + ambassador.last_name : ''}`
  const displayUrl = shareUrl.replace(/^https?:\/\//, '')

  const [name, setName] = useState('')
  const [ig, setIg] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  // Cloudflare deprecated size:'invisible' (TurnstileError on render);
  // compact + interaction-only matches the auth-page pattern. Container
  // is display:none below, so no widget UI ever shows.
  const { token: turnstileToken, containerRef: turnstileContainerRef } =
    useTurnstile({ size: 'compact', appearance: 'interaction-only', refreshExpired: 'auto' })

  // Validation: pay enabled if anonymous OR name >= 2 chars (mockup line 489).
  const valid = anonymous || name.trim().length >= 2

  const amountLabel = formatCurrencyText('amount-with-code', wish.currency, wish.price, { decimals: 'flex-0-2' })

  // Memo'd extras — stable identity across re-renders that don't change
  // the gifter inputs, so PaymentModalShell's PI-create effect doesn't
  // re-fire on every keystroke. Cache key in the shell hashes these,
  // so any change here correctly invalidates and forces a fresh PI.
  const bodyExtras = useMemo(
    () => ({
      gifter_name: anonymous ? null : name.trim(),
      gifter_instagram: anonymous ? null : (ig.trim() || null),
      gifter_is_anonymous: anonymous,
    }),
    [anonymous, name, ig],
  )

  // Wish chips per mockup lines 261-263 (One-time / No subscription / One gift).
  const wishChips = useMemo(
    () => [
      { label: 'One-time' },
      { label: 'No subscription' },
      { label: 'One gift' },
    ],
    [],
  )

  // 409 → /wish/taken. The shell still throws on non-OK and surfaces
  // the message briefly, but router.push fires first so navigation
  // pre-empts the error display in the common case.
  // Prefer server-provided ambassador { slug, first_name } when
  // present (spec §2.1) — defense-in-depth in case props drift from
  // the wish row server-side. Falls back to props (always populated
  // because the page loaded with this data via /pay/[token] dispatch).
  const handlePiCreateError = (body: unknown, status: number) => {
    if (status !== 409) return
    const b = body as {
      error?: string
      redirect?: string
      ambassador?: { slug?: string; first_name?: string } | null
    } | null
    if (b?.error !== 'wish_already_taken' && b?.redirect !== '/wish/taken') return
    const slug = b?.ambassador?.slug ?? ambassador.slug
    const first = b?.ambassador?.first_name ?? ambassadorFirstName
    router.push(`/wish/taken?slug=${encodeURIComponent(slug)}&first=${encodeURIComponent(first)}`)
  }

  const coverStyle: React.CSSProperties = ambassador.cover_photo_url
    ? { backgroundImage: `url(${ambassador.cover_photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }

  const locationText = formatLocation(wish.professional_city, wish.professional_country)
  const proWithLocation = wish.professional_name
    ? (locationText ? `${wish.professional_name} · ${locationText}` : wish.professional_name)
    : (locationText || '—')

  const payNote = anonymous
    ? 'One-time payment · No subscription'
    : `One-time payment · Your name forever on ${ambassadorFirstName}’s page`

  return (
    // Slice 7C item 35 fix 2: <main> landmark for screen readers.
    // /pay/[token] is at app root (not in /(public)), so the
    // /(public) layout's <main> doesn't apply — wrap explicitly here.
    <main
      id="wpPage"
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        #wpPage * { -webkit-tap-highlight-color: transparent; box-sizing: border-box }
        #wpPage input, #wpPage button { font-family: inherit; outline: none }
        #wpPage input::placeholder { color: #666 !important; opacity: 1 }
        #wpPage input[type="text"]:focus { border-color: #e91e8c !important; transition: border-color 0.15s }
      `}</style>

      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh' }}>
        {/* Cover */}
        <div style={{ position: 'relative', height: 180 }}>
          <div style={{ width: '100%', height: '100%', ...coverStyle }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(transparent, #000)', pointerEvents: 'none' }} />
        </div>

        {/* Hero */}
        <div style={{ padding: '0 20px 16px', textAlign: 'center', marginTop: -62, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 3 }}>
            {ambassadorFullName}
          </div>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: '#555', textDecoration: 'underline', textDecorationColor: 'rgba(85,85,85,0.4)', textUnderlineOffset: 2, display: 'inline-block', cursor: 'pointer' }}
          >
            {displayUrl}
          </a>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginTop: 10 }}>
            Make {ambassadorFirstName}&rsquo;s beauty wish come true
          </div>
        </div>

        <div style={{ height: 1, background: '#1a1a1a', margin: '0 20px' }} />

        {/* Beauty wish */}
        <div style={{ padding: '16px 20px 4px' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 10, paddingLeft: 4 }}>Beauty wish</div>
          <div style={{ background: '#1c1c1c', borderRadius: 12, padding: '13px 15px', marginBottom: 6 }}>
            <WishRow label="Service" value={wish.service_name} />
            <WishRow label="At" value={proWithLocation} />
            <WishRow label="Amount" value={amountLabel} last />
          </div>
        </div>

        {/* Your details (optional) */}
        <div style={{ padding: '12px 20px 4px' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 10, paddingLeft: 4 }}>
            Your details <span style={{ color: '#555' }}>(optional)</span>
          </div>

          <div
            style={{
              overflow: 'hidden',
              transition: 'max-height 0.3s ease, opacity 0.25s ease, margin-bottom 0.3s ease',
              maxHeight: anonymous ? 0 : 500,
              opacity: anonymous ? 0 : 1,
              marginBottom: anonymous ? 0 : undefined,
            }}
          >
            <input
              type="text"
              placeholder="Your name"
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(capFirstName(e.target.value))}
              style={{
                width: '100%', background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                padding: '14px 16px', fontSize: 16, color: '#fff', boxSizing: 'border-box',
                transition: 'border-color 0.15s', marginBottom: 10,
              }}
            />
            <input
              type="text"
              placeholder="Instagram username"
              aria-label="Instagram username"
              value={ig}
              onChange={(e) => setIg(sanitizeIg(e.target.value))}
              style={{
                width: '100%', background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                padding: '14px 16px', fontSize: 16, color: '#fff', boxSizing: 'border-box',
                transition: 'border-color 0.15s', marginBottom: 10,
              }}
            />
          </div>

          {/* Anonymous toggle */}
          <div
            style={{
              background: '#1c1c1c',
              border: `1.5px solid ${anonymous ? '#e91e8c' : '#262626'}`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'border-color 0.25s',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {anonymous
                  ? <>Appear as <span style={{ fontWeight: 700 }}>Secret Gifter</span> on {ambassadorFirstName}&rsquo;s page</>
                  : 'Gift anonymously'}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                Your name and Instagram won&rsquo;t be shown
              </div>
            </div>
            <div
              onClick={() => setAnonymous((v) => !v)}
              role="switch"
              aria-checked={anonymous}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAnonymous((v) => !v) } }}
              style={{
                width: 40, height: 22, background: anonymous ? '#e91e8c' : '#262626',
                borderRadius: 12, position: 'relative', cursor: 'pointer',
                transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, background: '#fff', borderRadius: '50%',
                position: 'absolute', top: 2, left: anonymous ? 20 : 2,
                transition: 'left 0.2s',
              }} />
            </div>
          </div>
        </div>

        {/* Pay CTA */}
        <div style={{ padding: '16px 20px 22px' }}>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 11 }}>
            {payNote}
          </div>
          <button
            type="button"
            onClick={() => { if (valid) setModalOpen(true) }}
            disabled={!valid}
            style={{
              width: '100%',
              background: valid ? '#e91e8c' : '#1c1c1c',
              border: valid ? '1px solid #e91e8c' : '1px solid #262626',
              borderRadius: 12, padding: 16, textAlign: 'center',
              fontSize: 15, fontWeight: 700, letterSpacing: '0.2px',
              color: valid ? '#fff' : '#555',
              cursor: valid ? 'pointer' : 'default',
            }}
          >
            Pay {amountLabel}
          </button>
        </div>

        {/* Hidden Turnstile widget. Same pattern as listings checkout. */}
        <div ref={turnstileContainerRef} style={{ display: 'none' }} />
      </div>

      <PaymentModal
        isOpen={modalOpen}
        token={wish.payment_link_token}
        amount={wish.price}
        currency={wish.currency}
        turnstileToken={turnstileToken}
        onClose={() => setModalOpen(false)}
        endpointPath="/api/checkout/wish"
        returnPathBuilder={(pi) => `/wish/confirmation/${pi}`}
        chips={wishChips}
        bodyExtras={bodyExtras}
        onPiCreateError={handlePiCreateError}
      />
    </main>
  )
}

function WishRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: last ? 0 : 8 }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

