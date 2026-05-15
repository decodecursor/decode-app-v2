/**
 * Pure helpers + sub-components extracted from AddListingClient.
 *
 * Slice 3C Phase 2a prep — behavior-preserving refactor. Nothing in
 * this file closes over component state; everything is either a pure
 * function, a browser-API wrapper (video metadata probe, path UUID
 * generation), or a self-contained React component (PriceBox).
 *
 * No 'use client' directive — plain module. Browser-only helpers
 * (validateVideoFile, path builders via crypto.randomUUID) are only
 * meaningful when called from client code; importing the module from
 * a server component is safe as long as those specific functions
 * aren't invoked on the server.
 *
 * File is .tsx because PriceBox carries JSX. If a future slice needs
 * PriceBox in a second consumer (rule of three), split it into
 * components/ambassador/PriceBox.tsx and keep the rest here as .ts.
 */

// ---------------------------------------------------------------------------
// Constants (module-private — the wrapping functions are the public API)
// ---------------------------------------------------------------------------

const PRICE_FLOORS: Record<string, number> = { usd: 10, eur: 10, gbp: 10, aed: 50 }
const DEFAULT_PRICE_FLOOR = 10

const MAX_VIDEO_BYTES = 40 * 1024 * 1024
const MAX_VIDEO_DURATION_S = 15
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm']

// ---------------------------------------------------------------------------
// Pure utilities
// ---------------------------------------------------------------------------

export function priceFloorForCurrency(currency: string): number {
  return PRICE_FLOORS[currency.toLowerCase()] ?? DEFAULT_PRICE_FLOOR
}

export function capFirst(s: string): string {
  if (!s) return s
  const first = s.charAt(0).toUpperCase()
  return first === s.charAt(0) ? s : first + s.slice(1)
}

export function videoExtForMime(mime: string): string {
  if (mime === 'video/mp4') return 'mp4'
  if (mime === 'video/quicktime') return 'mov'
  if (mime === 'video/webm') return 'webm'
  return 'mp4'
}

export function normalizeInstagram(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '')
}

// ---------------------------------------------------------------------------
// Path builders — user-scoped per the model-media INSERT RLS policy.
// crypto.randomUUID is available in all modern browsers; Node 19+ provides
// it via the Web Crypto API so SSR-side imports don't break.
// ---------------------------------------------------------------------------

export function buildAvatarPath(userId: string): string {
  return `${userId}/professionals/avatars/${crypto.randomUUID()}.jpg`
}
export function buildListingPhotoPath(userId: string): string {
  return `${userId}/listings/photos/${crypto.randomUUID()}.jpg`
}
export function buildListingVideoPath(userId: string, mime: string): string {
  return `${userId}/listings/videos/${crypto.randomUUID()}.${videoExtForMime(mime)}`
}
export function buildListingThumbPath(userId: string): string {
  return `${userId}/listings/thumbs/${crypto.randomUUID()}.jpg`
}

// ---------------------------------------------------------------------------
// Video validation — probes duration via a hidden <video preload="metadata">.
// Browser-only (uses document + URL.createObjectURL). Safe under SSR as long
// as server code never calls this — which it doesn't; only the
// client-side media picker reaches it.
// ---------------------------------------------------------------------------

export type VideoValidation = { ok: true } | { ok: false; error: string }

export function validateVideoFile(file: File): Promise<VideoValidation> {
  return new Promise<VideoValidation>((resolve) => {
    if (file.size > MAX_VIDEO_BYTES) {
      resolve({ ok: false, error: 'Video must be 40 MB or less' })
      return
    }
    if (!ALLOWED_VIDEO_MIMES.includes(file.type)) {
      resolve({ ok: false, error: 'Video must be MP4, MOV, or WebM' })
      return
    }
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (video.duration > MAX_VIDEO_DURATION_S) {
        resolve({ ok: false, error: 'Video must be 15 seconds or less' })
      } else {
        resolve({ ok: true })
      }
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ ok: false, error: "Couldn't read that video" })
    }
    video.src = url
  })
}

// ---------------------------------------------------------------------------
// PriceBox — the 30/60/90 input card shared by the pricing section. Pure
// presentation, no hooks, no state. Caller owns all state + handlers.
// ---------------------------------------------------------------------------

export function PriceBox({
  days, value, onInput, onFocus, onBlur, perDay, symbol, bad, offPct, locked = false,
}: {
  days: 30 | 60 | 90
  value: string
  onInput: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: () => void
  perDay: string
  symbol: string
  bad: boolean
  offPct?: number | null
  locked?: boolean
}) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {offPct != null && !locked && (
        <div style={{
          display: 'block', position: 'absolute', top: -10, left: '50%',
          transform: 'translateX(-50%)', zIndex: 2,
          fontSize: 9, fontWeight: 600, background: '#e91e8c', color: '#fff',
          padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap',
        }}>
          {offPct}% OFF
        </div>
      )}
      <div style={{
        position: 'relative',
        background: locked ? '#141414' : '#1c1c1c',
        border: locked
          ? '1px solid #1c1c1c'
          : `1.5px solid ${bad ? '#e91e8c' : '#262626'}`,
        borderRadius: 12, padding: 10, textAlign: 'center',
        transition: 'border-color 0.15s',
        cursor: locked ? 'not-allowed' : undefined,
      }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{days} days</div>
        <input
          type="text" inputMode="numeric" placeholder={symbol}
          value={value}
          onChange={onInput}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={locked}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontSize: 18, fontWeight: 600,
            color: locked ? '#666' : '#fff',
            textAlign: 'center',
            fontFamily: 'inherit', padding: 0,
            cursor: locked ? 'not-allowed' : 'text',
          }}
        />
        <div style={{ fontSize: 11, color: '#666', marginTop: 4, height: 13 }}>
          {perDay ? `${symbol}${perDay}/day` : ''}
        </div>
        {locked && (
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="#777"
            style={{ position: 'absolute', top: 6, right: 6, pointerEvents: 'none' }}
          >
            <path d="M18 8h-1V6c0-2.761-2.239-5-5-5S7 3.239 7 6v2H6c-1.105 0-2 .895-2 2v10c0 1.105.895 2 2 2h12c1.105 0 2-.895 2-2V10c0-1.105-.895-2-2-2zM9 6c0-1.654 1.346-3 3-3s3 1.346 3 3v2H9V6z" />
          </svg>
        )}
      </div>
    </div>
  )
}
