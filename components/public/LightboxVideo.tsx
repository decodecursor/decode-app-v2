'use client'

/**
 * Full-frame video for the media lightbox. Autoplays muted (mobile
 * autoplay requires muted+playsInline); parent owns the mute toggle
 * and passes the controlled value.
 *
 * Spec: public_media_lightbox_final_UI_Spec.md video frame.
 */
export function LightboxVideo({
  src,
  isMuted,
}: {
  src: string
  isMuted: boolean
}) {
  return (
    <video
      src={src}
      autoPlay
      loop
      playsInline
      muted={isMuted}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  )
}
