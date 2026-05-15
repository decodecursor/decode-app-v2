/**
 * Client-side video thumbnail extractor.
 *
 * Extracts a single JPEG frame from a video File via an off-screen
 * <video> + <canvas>, BEFORE the file is uploaded to Supabase Storage.
 * The blob: URL is same-origin to the page, so the canvas stays clean
 * and toBlob() works — extracting from the post-upload Supabase
 * Storage URL taints the canvas (the bucket doesn't serve
 * canvas-readable CORS headers), which is why the prior commit
 * 1e55c49 attempt was reverted.
 *
 * Browser-only (uses document + URL.createObjectURL + HTMLCanvasElement).
 * iOS Safari requires muted + playsInline to allow programmatic seek
 * on an off-screen video element — without them iOS silently refuses
 * to advance currentTime and the 'seeked' event never fires.
 *
 * Caller handles fallback: extractor throws on any failure, the
 * AddListingClient wiring catches and falls back to a null
 * video_thumbnail_url. The public-page orb already renders a dark
 * gradient + play triangle when the thumbnail is null.
 */

const SEEK_TIMEOUT_MS = 5000
const MAX_OUTPUT_WIDTH = 800
const JPEG_QUALITY = 0.85

export async function extractVideoThumbnail(file: File): Promise<Blob> {
  const blobUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  video.src = blobUrl

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.onloadedmetadata = null
        video.onerror = null
      }
      video.onloadedmetadata = () => { cleanup(); resolve() }
      video.onerror = () => { cleanup(); reject(new Error('video metadata load failed')) }
    })

    const seekTime = Math.min(1, (video.duration || 2) / 2)

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('video seek timed out'))
      }, SEEK_TIMEOUT_MS)
      const cleanup = () => {
        clearTimeout(timer)
        video.onseeked = null
        video.onerror = null
      }
      video.onseeked = () => { cleanup(); resolve() }
      video.onerror = () => { cleanup(); reject(new Error('video seek failed')) }
      video.currentTime = seekTime
    })

    const scale = Math.min(1, MAX_OUTPUT_WIDTH / (video.videoWidth || MAX_OUTPUT_WIDTH))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round((video.videoWidth || MAX_OUTPUT_WIDTH) * scale))
    canvas.height = Math.max(1, Math.round((video.videoHeight || MAX_OUTPUT_WIDTH) * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas toBlob returned null'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })

    return blob
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}
