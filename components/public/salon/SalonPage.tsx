import Image from 'next/image'
import type { OtherAmbassador } from '@/lib/public/slug-page-shape'
import { formatLocation } from '@/lib/format-location'
import { PublicFooter } from '@/components/public/PublicFooter'
import { ShareButton } from '@/components/public/ShareButton'
import { AmbassadorInstagramButton } from '@/components/public/AmbassadorInstagramButton'

/**
 * Public SALON page — served at /{slug} when the slug resolves to a
 * model_professionals row (ambassador resolution wins first; see the
 * route resolver in app/(public)/[slug]/page.tsx).
 *
 * Mirrors the ambassador page shell (dark theme, Inter, 420px mobile-first
 * column) but lists every ambassador who trusts this salon. ADDITIVE — it
 * shares no components with the ambassador page except PublicFooter.
 *
 * Ambassador rows reuse the exact shape returned by the existing trusted-by
 * query (fetchOtherAmbassadorsByPro). Row styling mirrors the
 * OtherAmbassadorsModal's AmbassadorRow.
 */

export interface SalonData {
  id: string
  slug: string
  name: string
  city: string | null
  country: string | null
  instagram_handle: string | null
  cover_photo_url: string | null
}

export function SalonPage({
  salon,
  ambassadors,
  shareUrl,
}: {
  salon: SalonData
  ambassadors: OtherAmbassador[]
  shareUrl: string
}) {
  const location = formatLocation(salon.city, salon.country)

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        background: '#000',
        color: '#fff',
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* COVER */}
      <div style={{ position: 'relative', height: 300, background: '#222', overflow: 'hidden' }}>
        {/* IG button, top-left — reuses the ambassador page's exact button */}
        <div style={{ position: 'absolute', top: 12, left: 20, zIndex: 2 }}>
          <AmbassadorInstagramButton
            instagramHandle={salon.instagram_handle}
            slug={salon.slug}
            ambassadorName={salon.name}
          />
        </div>

        {/* Share button, top-right — reuses the ambassador page's exact button */}
        <div style={{ position: 'absolute', top: 12, right: 20, zIndex: 2 }}>
          <ShareButton url={shareUrl} title={salon.name} slug={salon.slug} />
        </div>

        {/* Cover image — gradient fallback when null (never a broken image) */}
        {salon.cover_photo_url ? (
          <Image
            src={salon.cover_photo_url}
            alt=""
            fill
            priority
            sizes="(max-width: 420px) 100vw, 420px"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, #777 0%, #333 40%, #222 70%, #000 100%)',
            }}
          />
        )}

        {/* Bottom scrim for legibility */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background: 'linear-gradient(transparent, #000)',
          }}
        />

        {/* Name + location, centered */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 2,
            padding: '0 20px',
          }}
        >
          <div style={{ fontSize: 31, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.15 }}>
            {salon.name}
          </div>
          {location && (
            <div style={{ fontSize: 14, color: '#c9bfc2', marginTop: 4 }}>{location}</div>
          )}
        </div>
      </div>

      {/* TRUSTED BY */}
      <div style={{ padding: '24px 20px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
          Trusted by
        </div>
      </div>

      {/* AMBASSADOR LIST */}
      {/* paddingBottom: '50vh' mirrors the ambassador page (PublicPageClient)
          so a short salon pushes the footer below the fold instead of
          floating it up under the last row. */}
      <div style={{ padding: '4px 12px 8px', paddingBottom: '50vh' }}>
        {ambassadors.map((amb, i) => (
          <AmbassadorRow
            key={amb.id}
            slug={amb.slug}
            name={`${amb.first_name} ${amb.last_name}`.trim()}
            coverPhotoUrl={amb.cover_photo_url}
            instagramHandle={amb.instagram_handle}
            isFirst={i === 0}
          />
        ))}
      </div>

      <PublicFooter />
    </div>
  )
}

// One ambassador row — mirrors OtherAmbassadorsModal's AmbassadorRow.
// Whole row links to /{slug}.
function AmbassadorRow({
  slug,
  name,
  coverPhotoUrl,
  instagramHandle,
  isFirst,
}: {
  slug: string
  name: string
  coverPhotoUrl: string | null
  instagramHandle: string | null
  isFirst: boolean
}) {
  const handle = instagramHandle?.replace(/^@/, '') || null
  return (
    <a
      href={`/${slug}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 8px',
        borderRadius: 12,
        borderTop: isFirst ? undefined : '1px solid #1a1a1a',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <AmbassadorAvatar coverPhotoUrl={coverPhotoUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        {handle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{ width: 13, height: 13, stroke: '#777', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span
              style={{ fontSize: 13, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {handle}
            </span>
          </div>
        )}
      </div>

      {/* Chevron */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ width: 18, height: 18, stroke: '#555', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  )
}

// 56px circle showing the FULL cover photo (contain, never cropped) over a
// blurred cover-fit copy. Person-glyph fallback when null.
function AmbassadorAvatar({ coverPhotoUrl }: { coverPhotoUrl: string | null }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        background: '#1a1a1a',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {coverPhotoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverPhotoUrl}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px)', transform: 'scale(1.2)', opacity: 0.55 }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverPhotoUrl}
            alt=""
            style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </>
      ) : (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ width: 22, height: 22, stroke: '#666', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </div>
  )
}
