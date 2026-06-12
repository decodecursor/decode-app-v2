/**
 * Orb media pool — single shared <video> element for the public-page
 * MediaOrb thumbnails. Whichever orb is currently active per the
 * §18 single-active orchestrator gets the element appendChild'd into
 * its container; src is set to that orb's video URL and play() fires.
 * On the next active-orb change, the element moves to the new orb
 * (DOM appendChild does an implicit removeChild from the prior
 * parent — element identity is preserved).
 *
 * Decoder ceiling: structurally capped at 1 simultaneous <video>
 * regardless of how many video orbs the page has. iOS Safari's 4-6
 * decoder slot ceiling is unreachable.
 *
 * Differs from lib/public/media-pool.ts (lightbox pool):
 *   - 1 element instead of 2 (no swipe-preload need; orb activation
 *     is scroll-driven, not gesture-paced).
 *   - No blessing — muted autoplay is allowed without a user gesture
 *     under WebKit's autoplay policy. Each scroll into an active orb
 *     just calls play() directly.
 *   - Element moves between orb containers via appendChild, inheriting
 *     each orb's stacking context naturally. No fixed-position host
 *     coordinates to manage.
 *
 * Op queue: every activate/deactivate is enqueued onto a single
 * Promise chain. Sequential ordering prevents load() from interrupting
 * an in-flight play() on rapid scroll.
 *
 * SSR-safe: ensureElement() guards `typeof document` and is only
 * invoked from effects (post-mount).
 */

class OrbMediaPool {
  private element: HTMLVideoElement | null = null
  private opQueue: Promise<void> = Promise.resolve()

  ensureElement(): HTMLVideoElement {
    if (typeof document === 'undefined') {
      throw new Error('OrbMediaPool requires a DOM environment')
    }
    if (!this.element) {
      const el = document.createElement('video')
      el.muted = true
      el.loop = true
      el.playsInline = true
      el.preload = 'auto'
      // Match the orb's <img> thumbnail layout so the element fills the
      // 72×72 circular container exactly.
      el.style.position = 'absolute'
      el.style.inset = '0'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.objectFit = 'cover'
      el.style.display = 'block'
      // Start hidden so the orb's thumbnail <img> beneath shows through
      // until the video genuinely paints a frame. Without this the bare
      // <video> renders black while loading — and stays black forever for
      // sources the browser can't decode (e.g. .mov/quicktime in
      // Chrome/Firefox), covering an otherwise-valid thumbnail.
      el.style.opacity = '0'
      el.style.transition = 'opacity 120ms ease'
      // 'playing' fires only once frames are actually being presented;
      // 'error' / stalled sources never reach it, so the orb stays on its
      // thumbnail. We reset opacity to 0 on each new src in activate().
      el.addEventListener('playing', () => {
        el.style.opacity = '1'
      })
      this.element = el
    }
    return this.element
  }

  /**
   * Move the shared <video> into `parent`, set src to `src`, and play.
   * Idempotent: if parent and src are already current, this is a no-op
   * apart from a redundant play() (which iOS treats as a no-op when
   * already playing).
   */
  activate(parent: HTMLElement, src: string): void {
    this.opQueue = this.opQueue
      .then(async () => {
        const el = this.ensureElement()

        if (el.parentElement !== parent) {
          if (el.parentElement) el.parentElement.removeChild(el)
          parent.appendChild(el)
        }
        if (el.getAttribute('src') !== src) {
          // New source: hide until the 'playing' listener reveals it, so
          // the new orb's thumbnail shows through during load instead of
          // the prior orb's last frame or a black box.
          el.style.opacity = '0'
          el.src = src
          el.load()
        }

        try {
          await el.play()
        } catch {
          // Muted autoplay rejection is rare under WebKit policy. If it
          // does happen, the orb falls back to its static thumbnail
          // beneath; the user can still tap to open the lightbox where
          // blessing handles activation.
        }
      })
      .catch(() => { /* swallow so the queue continues for next activation */ })
  }

  /**
   * Pause and detach the shared <video> from its current parent. The
   * element itself is not destroyed — it stays alive for the next
   * activation. Called when no orb is active (e.g. user scrolled past
   * all video orbs).
   */
  deactivate(): void {
    this.opQueue = this.opQueue
      .then(async () => {
        const el = this.element
        if (!el) return
        el.pause()
        el.style.opacity = '0'
        if (el.parentElement) el.parentElement.removeChild(el)
      })
      .catch(() => {})
  }
}

export const orbMediaPool = new OrbMediaPool()
