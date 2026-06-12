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

// Fractions of the clip duration to try, in order. Videos commonly open on
// a black/fade-in frame (and .mov first frames are often black before the
// decoder paints), so 0 is deliberately excluded — we start ~1s/10% in and
// walk further if the grab comes back black.
const SEEK_FRACTIONS = [0.1, 0.25, 0.5, 0.4, 0.65]
// Mean luma below this (0–255) is treated as an effectively-black frame and
// rejected. ~12 keeps very dark-but-real frames while catching pure black.
const BLACK_LUMA_THRESHOLD = 12

export async function extractVideoThumbnail(file: File): Promise<Blob> {
  const blobUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
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

    const duration = video.duration && isFinite(video.duration) ? video.duration : 2
    const scale = Math.min(1, MAX_OUTPUT_WIDTH / (video.videoWidth || MAX_OUTPUT_WIDTH))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round((video.videoWidth || MAX_OUTPUT_WIDTH) * scale))
    canvas.height = Math.max(1, Math.round((video.videoHeight || MAX_OUTPUT_WIDTH) * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')

    // Walk candidate timestamps until we capture a non-black frame. Keep the
    // last (brightest) grab as a fallback so a genuinely dark clip still gets
    // a thumbnail rather than failing outright.
    let lastBlob: Blob | null = null
    let bestLuma = -1
    for (const frac of SEEK_FRACTIONS) {
      const seekTime = Math.min(duration * frac, Math.max(0, duration - 0.1))
      await seekTo(video, seekTime)
      await nextPaintedFrame(video)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const luma = meanLuma(ctx, canvas.width, canvas.height)
      const blob = await canvasToJpeg(canvas)
      if (luma > bestLuma) { bestLuma = luma; lastBlob = blob }
      if (luma >= BLACK_LUMA_THRESHOLD) return blob
    }

    if (!lastBlob) throw new Error('thumbnail capture produced no frame')
    return lastBlob
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('video seek timed out')) }, SEEK_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timer)
      video.onseeked = null
      video.onerror = null
    }
    video.onseeked = () => { cleanup(); resolve() }
    video.onerror = () => { cleanup(); reject(new Error('video seek failed')) }
    video.currentTime = time
  })
}

// 'seeked' fires when the seek completes, but the decoded frame may not be
// presented to the element yet — drawImage then captures black. When
// available, requestVideoFrameCallback resolves only once a frame is
// actually painted; otherwise fall back to a double-rAF, which gives the
// compositor a beat to present the frame.
function nextPaintedFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise<void>((resolve) => {
    const rvfc = (video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }).requestVideoFrameCallback
    if (typeof rvfc === 'function') {
      rvfc.call(video, () => resolve())
      return
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      return
    }
    resolve()
  })
}

// Mean luma over a sparse pixel sample. blob: URLs are same-origin so the
// canvas stays untainted and getImageData is readable.
function meanLuma(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const { data } = ctx.getImageData(0, 0, w, h)
  let sum = 0
  let count = 0
  // Sample every ~64th pixel (stride 256 bytes) — enough signal to detect a
  // black frame without reading the whole buffer.
  for (let i = 0; i < data.length; i += 256) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    count++
  }
  return count ? sum / count : 0
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas toBlob returned null'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
