'use client'

/**
 * Orchestrator for /pay/[token] when the token resolves to a listing.
 *
 * Renders the checkout page per checkout spec §4 (Layout) — cover,
 * header, "Your details" card, package picker, pay CTA — and hosts the
 * URL-preview overlay + Stripe payment modal as controlled children.
 *
 * Slice 4A's PublicHeader covers a slightly different surface (tagline
 * overlay + share button) and is NOT reused here — the checkout header
 * is a cleaner variant without the share affordance.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { CheckoutData, PackageDays } from '@/lib/checkout/checkout-shape'
import { ambassadorDisplayName } from '@/lib/checkout/checkout-shape'
import { formatCurrencyText } from '@/lib/ambassador/currency-format'
import { PackagePicker } from './PackagePicker'
import { UrlOverlay } from './UrlOverlay'
import { ShareButton } from '@/components/public/ShareButton'

// Slice 7C bundle remediation A: PaymentModal (and its Stripe.js +
// @stripe/react-stripe-js dependency tree) is dynamic-imported so the
// chunk is fetched ONLY when /pay/[token] mounts, not bundled into
// every ambassador page's First Load JS. ssr:false is mandatory —
// loadStripe() in lib/stripe-client.ts touches window at module top.
// loading:null avoids a flash while the chunk arrives; the modal
// itself returns null when isOpen=false anyway, so the user sees
// no transition during the initial chunk fetch on page mount.
const PaymentModal = dynamic(
  () => import('./PaymentModalShell').then((mod) => mod.PaymentModal),
  { ssr: false, loading: () => null },
)

interface Props {
  data: CheckoutData
  shareUrl: string
}

// Stable empty-extras reference — module-level so its identity never
// changes across renders. Avoids re-firing PaymentModalShell's PI-create
// effect (cacheKey deps include bodyExtras for non-package flows).
const LISTINGS_EMPTY_EXTRAS: Record<string, unknown> = {}

export function CheckoutClient({ data, shareUrl }: Props) {
  const defaultPkg = useMemo<PackageDays>(
    () => (data.packages.find((p) => p.is_default)?.days ?? data.packages[0]!.days) as PackageDays,
    [data.packages],
  )
  const [selected, setSelected] = useState<PackageDays>(defaultPkg)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Pre-warm PaymentIntent on mount + on package change. Tagged with
  // cacheKey so PaymentModalShell can match against its own cacheKey and
  // skip the modal-open POST. Stripe idempotency on (listing_id,
  // package_days) means re-firing for the same package returns the same
  // PI — no duplicate Stripe charges, no fee leak. Bot protection at
  // this endpoint is provided by Upstash rate-limit (3/10min/IP) +
  // Stripe Radar + idempotency key, NOT Turnstile (dropped from
  // /api/checkout/* per Option D split — see HANDOFF item 43).
  const [prewarmedIntent, setPrewarmedIntent] = useState<
    { clientSecret: string; paymentIntentId: string; cacheKey: string } | null
  >(null)
  // Clear stale intent the moment the user switches package, before the
  // re-warm POST resolves. Prevents the modal from opening on a stale
  // PI for the previous package during the brief re-warm window.
  const lastPackageRef = useRef<PackageDays>(selected)
  if (lastPackageRef.current !== selected && prewarmedIntent && prewarmedIntent.cacheKey !== String(selected)) {
    // Clearing during render is the documented React pattern for
    // derived state that must reset synchronously on a prop/state
    // change (avoids one render with the stale value visible).
    setPrewarmedIntent(null)
    lastPackageRef.current = selected
  }
  useEffect(() => {
    const cacheKey = String(selected)
    const controller = new AbortController()
    fetch('/api/checkout/listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: data.payment_link_token,
        package_days: selected,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body?.client_secret || !body?.payment_intent_id) {
          throw new Error(body?.message ?? body?.error ?? `prewarm_failed_${res.status}`)
        }
        return body as { client_secret: string; payment_intent_id: string }
      })
      .then((body) => {
        if (controller.signal.aborted) return
        setPrewarmedIntent({
          clientSecret: body.client_secret,
          paymentIntentId: body.payment_intent_id,
          cacheKey,
        })
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        // Pre-warm is best-effort. On failure, the modal's own
        // PI-create on click is the fallback — same UX as today.
        console.warn('[CheckoutClient] PI pre-warm failed:', err)
      })
    return () => controller.abort()
  }, [selected, data.payment_link_token])

  // Listings chip array — memoized on `selected` so the array reference
  // is stable across renders that don't change the package.
  const listingsChips = useMemo(
    () => [
      { label: 'One-time' },
      { label: 'No subscription' },
      { label: `${selected}-day package` },
    ],
    [selected],
  )

  const selectedPkg = data.packages.find((p) => p.days === selected) ?? data.packages[0]!
  const ambassadorName = ambassadorDisplayName(data.ambassador)
  // Ambassador IG handle from public.users — null when not populated.
  // Strip leading @ defensively (DB stores without; setup form sanitizes
  // to bare username, but defense-in-depth for any direct edits).
  const ambIg = data.ambassador.instagram_handle?.replace(/^@/, '') || null
  // Share message — verbatim parity with SendPaymentLinkClient.tsx:217-220 so a
  // gifter forwarding the pay link receives the same copy the ambassador sent.
  const shareMessage = `Hello\n\nI've just added you to my Beauty Squad on WeLoveDecode🌸\n\nConfirm here to activate: ${shareUrl}`

  const coverPositionY = data.ambassador.cover_photo_position_y ?? 50
  const coverStyle: React.CSSProperties = data.ambassador.cover_photo_url
    ? { backgroundImage: `url(${data.ambassador.cover_photo_url})`, backgroundPosition: `center ${coverPositionY}%`, backgroundSize: 'cover' }
    : { background: 'linear-gradient(180deg, #2a2a2a 0%, #111 100%)' }

  return (
    // Outer: full-viewport black chrome (matches app/(public)/layout.tsx).
    // Inner: 500px mobile frame centered on desktop — same pattern as
    // PublicPageClient on /{slug}. Position-fixed children (UrlOverlay,
    // PaymentModal) escape this frame via viewport-based containing block,
    // so modals still cover full viewport on desktop.
    //
    // Slice 7C item 35 fix 2: <main> landmark for screen readers.
    // /pay/[token] is at app root (not in /(public)), so the
    // /(public) layout's <main> doesn't apply — wrap explicitly here.
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh' }}>
      {/* Cover */}
      <div style={{ position: 'relative', height: 180, width: '100%', ...coverStyle }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, #000 100%)' }} />
        {/* Top-left button cluster: public-page preview (always) + IG link
            (conditional on data.ambassador.instagram_handle). Element
            shape (div + role=button + onKeyDown) mirrors ShareButton
            byte-for-byte so iOS Safari's user-agent <button> styling
            doesn't drift the visual. */}
        <div style={{
          position: 'absolute',
          top: 12, left: 20,
          display: 'flex', gap: 8,
          zIndex: 2,
        }}>
          <div
            onClick={() => setOverlayOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOverlayOpen(true) } }}
            aria-label="Preview profile"
            style={{
              position: 'relative',
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          </div>
          {ambIg && (
            <div
              onClick={() => window.open(`https://instagram.com/${ambIg}`, '_blank', 'noopener,noreferrer')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.open(`https://instagram.com/${ambIg}`, '_blank', 'noopener,noreferrer') } }}
              aria-label={`Open ${ambassadorName}'s Instagram`}
              style={{
                position: 'relative',
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="#fff" />
              </svg>
            </div>
          )}
        </div>
        {/* Share button, top-right. Wrapper sized to the button itself
            (right:20 anchor only — NOT left:0+right:0 full-width with
            flex-end, which would silently overlay the top-left cluster
            and eat its clicks since both clusters sit at zIndex 2). */}
        <div style={{
          position: 'absolute',
          top: 12, right: 20,
          zIndex: 2,
        }}>
          <ShareButton
            url={shareUrl}
            title={`${ambassadorName} — WeLoveDecode`}
            slug={data.ambassador.slug}
            text={shareMessage}
          />
        </div>

        {/* Name — absolutely positioned inside the cover, anchored to
            bottom with 24px breathing room. Mirrors PublicHeader's
            overlay rhythm (PublicHeader.tsx:101-110). Single line of
            ~29px sits at y=127 from top of the 180px cover, well clear
            of the top-chrome cluster at y=[12, 44]. Color set
            explicitly on the name (not inherited) since the absolutely-
            positioned child sits over a dark cover gradient. */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          padding: '0 20px',
          textAlign: 'center',
          zIndex: 2,
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{ambassadorName}</div>
        </div>
      </div>

      {/* Tagline — sits in the black band between cover and divider
          in normal flow (split out of the cover overlay so the cover
          shows the name only, mirroring the public profile's name
          treatment). Action-oriented headline targeting the
          professional viewing this checkout — replaces the
          ambassador's personal tagline (which still shows on her
          public /{slug} page where the audience is gifters/visitors,
          not professionals). */}
      <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#ccc', lineHeight: 1.4, maxWidth: 320, margin: '0 auto' }}>
          Secure Your Spot in {data.ambassador.first_name}&rsquo;s Beauty Squad
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1f1f1f', margin: '32px 20px' }} />

      {/* "Your details" read-only card.
          marginBottom 32 (not 28) so the gap from this card's bottom
          to the CHOOSE YOUR PACKAGE eyebrow matches the gap from the
          divider to the YOUR DETAILS eyebrow (also 32px from divider
          margin). Equalized eyebrow rhythm across both sections. */}
      <div style={{ padding: '0 20px', marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: '#777', fontWeight: 600, marginBottom: 10 }}>YOUR DETAILS</div>
        <div style={{ background: '#1c1c1c', border: '1px solid #262626', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DetailRow label="Name" value={data.professional.name} />
          {data.professional.instagram_handle && (
            <DetailRow label="Instagram" value={data.professional.instagram_handle} />
          )}
          {data.category_label && (
            <DetailRow label="Category" value={data.category_label} />
          )}
        </div>
      </div>

      {/* Package picker */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: '#777', fontWeight: 600, marginBottom: 10 }}>CHOOSE YOUR PACKAGE</div>
      </div>
      <PackagePicker
        packages={data.packages}
        selected={selected}
        currency={data.currency}
        onSelect={setSelected}
      />

      {/* Pay note */}
      <div style={{ padding: '16px 20px 8px', textAlign: 'center', fontSize: 11, color: '#666' }}>
        One-time payment · {selected} days visibility
      </div>

      {/* Pay CTA — padding-bottom absorbs iOS Safari toolbar height
          (~50px) + 30px breathing room + env(safe-area-inset-bottom)
          for notched devices. Same pattern as the auth page mobile
          fix in commit 33afd3e. Pay button is the page's bottom-most
          flow element so this padding directly drives its viewport
          clearance. */}
      <div style={{ padding: '0 20px calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: '#e91e8c', border: 'none', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Pay {formatCurrencyText('amount-with-code', data.currency, selectedPkg.total, { decimals: 'flex-0-2' })}
        </button>
      </div>

      {/* Overlays */}
      <UrlOverlay
        isOpen={overlayOpen}
        slug={data.ambassador.slug}
        ambassadorName={ambassadorName}
        tagline={data.ambassador.tagline}
        onClose={() => setOverlayOpen(false)}
      />
      {/* All multi-flow props passed explicitly even though defaults
          would also produce the listings shape — keeps the boundary
          legible and gives Slice 5C wish-checkout a copy-paste model.
          chips memoized so PaymentModalShell's effect deps stay stable
          across CheckoutClient re-renders. */}
      <PaymentModal
        isOpen={modalOpen}
        token={data.payment_link_token}
        packageDays={selected}
        amount={selectedPkg.total}
        currency={data.currency}
        onClose={() => setModalOpen(false)}
        endpointPath="/api/checkout/listing"
        returnPathBuilder={(pi) => `/listing/confirmation/${pi}`}
        chips={listingsChips}
        bodyExtras={LISTINGS_EMPTY_EXTRAS}
        prewarmedIntent={prewarmedIntent}
      />
      </div>
    </main>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}
