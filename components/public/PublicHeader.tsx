import type { PublicProfile } from '@/lib/public/slug-page-shape'
import { ShareButton } from './ShareButton'

/**
 * Cover + ambassador name + tagline, with the share button overlaid
 * top-right. Gradient scrim at the bottom of the cover guarantees
 * readable text over any image (mockup: 120px black gradient).
 *
 * Spec: public_page_final_UI_Spec.md §4.1 Cover.
 * Mockup: public_page_final.html lines 6-22.
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
      {/* Share button, top-right */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 0,
          right: 0,
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        <ShareButton url={shareUrl} title={`${displayName} — WeLoveDecode`} />
      </div>

      {/* Cover image — positioned with cover_photo_position_y (0-100)
          translating to background-position percentage so the ambassador's
          chosen crop frame shows. Falls back to a gradient placeholder
          when no cover is uploaded yet. */}
      {profile.cover_photo_url ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${profile.cover_photo_url})`,
            backgroundSize: 'cover',
            backgroundPosition: `center ${profile.cover_photo_position_y ?? 50}%`,
            backgroundRepeat: 'no-repeat',
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
            fontSize: 30,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 6,
            letterSpacing: '-0.3px',
          }}
        >
          {displayName}
        </div>
        {profile.tagline && (
          <div style={{ fontSize: 12, color: '#777' }}>{profile.tagline}</div>
        )}
      </div>
    </div>
  )
}
