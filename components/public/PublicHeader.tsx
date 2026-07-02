import Image from 'next/image'
import type { PublicProfile } from '@/lib/public/slug-page-shape'
import { ShareButton } from './ShareButton'
import { AmbassadorInstagramButton } from './AmbassadorInstagramButton'

/**
 * Cover + ambassador name + tagline, with the share button overlaid
 * top-right. Gradient scrim at the bottom of the cover guarantees
 * readable text over any image (mockup: 120px black gradient).
 *
 * Spec: public_page_final_UI_Spec.md §4.1 Cover.
 * Mockup: public_page_final.html lines 6-22.
 *
 * Slice 7C item 36 (public-page LCP perf): the cover image is the
 * LCP element on /{slug} for mobile. Migrated from CSS background-
 * image → next/image with `priority` so the browser:
 *   - Receives an automatic <link rel="preload" as="image"> hint
 *     (resolves Lighthouse "LCP request discovery")
 *   - Sets fetchpriority="high" on the request
 *   - Gets responsive srcset + automatic WebP/AVIF (resolves
 *     "Improve image delivery" — ~309 KiB savings)
 *   - Inherits 30-day cache TTL via the bumped minimumCacheTTL in
 *     next.config.ts (resolves "Use efficient cache lifetimes" —
 *     ~308 KiB savings)
 *
 * Layout preservation: the parent stays position:relative + height:300
 * for the gradient scrim + name absolute-positioning to layer on top.
 * `fill` makes Image fill the parent. `objectFit: cover` + `objectPosition`
 * translate the original `backgroundSize: cover` + `backgroundPosition:
 * center {y}%` 1:1.
 *
 * `sizes` hints — page wrappers cap at 420px (batch (d) design contract),
 * so 100vw on mobile and 420px on desktop covers all viewport widths.
 */
export function PublicHeader({
  profile,
  shareUrl,
}: {
  profile: PublicProfile
  shareUrl: string
}) {
  const displayName = `${profile.first_name} ${profile.last_name}`.trim()

  return (
    <div style={{ position: 'relative', height: 300, background: '#222', overflow: 'hidden' }}>
      {/* Ambassador Instagram button, top-left. Independent wrapper from
          the share button — additive, won't shift the share button when
          the ambassador has no IG handle (the inner component returns
          null in that case, leaving an empty 32×32 wrapper that doesn't
          affect layout because the share-button wrapper is absolutely
          positioned and self-anchored to the right edge). */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 20,
          zIndex: 2,
        }}
      >
        <AmbassadorInstagramButton
          instagramHandle={profile.instagram_handle}
          slug={profile.slug}
          ambassadorName={displayName}
        />
      </div>
      {/* Share button, top-right */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 20,
          zIndex: 2,
        }}
      >
        <ShareButton url={shareUrl} title={displayName} slug={profile.slug} text={`${displayName}'s Beauty Squad 🌸`} />
      </div>

      {/* Cover image — positioned with cover_photo_position_y (0-100)
          translating to background-position percentage so the ambassador's
          chosen crop frame shows. Falls back to a gradient placeholder
          when no cover is uploaded yet. */}
      {profile.cover_photo_url ? (
        <Image
          src={profile.cover_photo_url}
          alt=""
          fill
          priority
          sizes="(max-width: 420px) 100vw, 420px"
          style={{
            objectFit: 'cover',
            objectPosition: `center ${profile.cover_photo_position_y ?? 50}%`,
          }}
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

      {/* Bottom gradient scrim — readable name/tagline over any cover */}
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

      {/* Name + tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 0,
            letterSpacing: '-0.3px',
          }}
        >
          {displayName}
        </div>
        {profile.tagline && (
          <div style={{ fontSize: 14, color: '#bbb' }}>{profile.tagline}</div>
        )}
      </div>
    </div>
  )
}
