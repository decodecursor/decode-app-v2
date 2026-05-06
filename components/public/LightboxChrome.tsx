'use client'

/**
 * Per-slide chrome that rides with each lightbox page: top + bottom
 * scrims and the photo-dot indicator row (when slidesCount > 1).
 *
 * Close + mute buttons + the bottom info bar (avatar / name / IG /
 * category) all live at the LightboxDeck wrapper level — close and
 * mute because they're deck-wide and shouldn't drift with slide
 * scroll-snap; info bar because iOS Safari's -webkit-overflow-
 * scrolling:touch compositing layer doesn't reliably stack the info
 * bar above the pool video at z:4 when it's nested inside the per-slide
 * scroll container (visible on desktop, hidden on mobile).
 */
export function LightboxChrome({
  slidesCount,
  activeIdx,
  onJumpSlide,
  isVideo,
}: {
  slidesCount: number
  activeIdx: number
  onJumpSlide: (i: number) => void
  isVideo: boolean
}) {
  return (
    <>
      {/* Top scrim */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 90,
          background: 'linear-gradient(rgba(0,0,0,0.55),transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Bottom scrim */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 130,
          background: 'linear-gradient(transparent,rgba(0,0,0,0.92))',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Dots — photos with ≥2 slides */}
      {!isVideo && slidesCount > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 86,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            zIndex: 2,
          }}
        >
          {Array.from({ length: slidesCount }).map((_, i) => (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                onJumpSlide(i)
              }}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === activeIdx ? '#e91e8c' : 'rgba(255,255,255,0.35)',
                transition: 'background 0.2s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}
