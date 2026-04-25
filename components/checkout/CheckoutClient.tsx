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

import { useMemo, useState } from 'react'
import type { CheckoutData, PackageDays } from '@/lib/checkout/checkout-shape'
import { ambassadorDisplayName } from '@/lib/checkout/checkout-shape'
import { formatCurrency } from '@/lib/ambassador/utils'
import { PackagePicker } from './PackagePicker'
import { UrlOverlay } from './UrlOverlay'
import { PaymentModal } from './PaymentModalShell'
import { useTurnstile } from '@/components/turnstile/TurnstileWidget'

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
  // Turnstile lives on the checkout page (not the modal) so the token
  // is already warm by the time the user taps Pay.
  const { token: turnstileToken, containerRef: turnstileContainerRef } =
    useTurnstile({ size: 'invisible' })

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
  const displayUrl = shareUrl.replace(/^https?:\/\//, '')

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
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', minHeight: '100vh' }}>
      {/* Cover */}
      <div style={{ position: 'relative', height: 180, width: '100%', ...coverStyle }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, #000 100%)' }} />
      </div>

      {/* Header (overlaps cover) */}
      <div style={{ padding: '0 20px', marginTop: -40, position: 'relative', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>{ambassadorName}</div>
        <div
          onClick={() => setOverlayOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOverlayOpen(true) } }}
          style={{ fontSize: 11, color: '#888', textDecoration: 'underline', cursor: 'pointer', marginBottom: 12, display: 'inline-block' }}
        >
          {displayUrl}
        </div>
        {data.ambassador.tagline && (
          <div style={{ fontSize: 15, fontWeight: 600, color: '#ccc', lineHeight: 1.4, maxWidth: 320, margin: '0 auto' }}>
            {data.ambassador.tagline}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1f1f1f', margin: '32px 20px' }} />

      {/* "Your details" read-only card */}
      <div style={{ padding: '0 20px', marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: '#777', fontWeight: 600, marginBottom: 10 }}>YOUR DETAILS</div>
        <div style={{ background: '#1c1c1c', border: '1px solid #262626', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DetailRow label="Name" value={data.professional.name} />
          {data.professional.instagram_handle && (
            <DetailRow label="Instagram" value={`@${data.professional.instagram_handle}`} />
          )}
          {data.category_label && (
            <DetailRow label="Category" value={data.category_label} />
          )}
        </div>
      </div>

      {/* Package picker */}
      <div style={{ padding: '0 20px 10px' }}>
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

      {/* Pay CTA */}
      <div style={{ padding: '0 20px 28px' }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: '#e91e8c', border: 'none', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Pay {formatCurrency(selectedPkg.total, data.currency)}
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
        turnstileToken={turnstileToken}
        onClose={() => setModalOpen(false)}
        endpointPath="/api/checkout/listing"
        returnPathBuilder={(pi) => `/listing/confirmation/${pi}`}
        chips={listingsChips}
        bodyExtras={LISTINGS_EMPTY_EXTRAS}
      />

      {/* Hidden Turnstile widget. Renders invisibly; token callback sets
          state via the useTurnstile hook, which flows into the PI create
          body when the user taps Pay. Container must exist on mount —
          the hook captures the ref and calls turnstile.render on it. */}
      <div ref={turnstileContainerRef} style={{ display: 'none' }} />
      </div>
    </div>
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
