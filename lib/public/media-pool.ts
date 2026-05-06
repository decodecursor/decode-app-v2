/**
 * Media Pool with Blessing for the public-page lightbox.
 *
 * Pattern adapted from AMP's media-pool (extensions/amp-story/1.0/
 * media-pool.js) and pshihn/media-pool. Two pre-created <video>
 * elements are "blessed" — given a synchronous play() call inside the
 * user's tap-to-open gesture — so iOS Safari clears them for unmuted
 * autoplay on subsequent src swaps. Without blessing, every fresh
 * <video> mounted later in the session needs its own per-element
 * gesture, which is impossible to provide for slide N+1 when the
 * user's only gesture was on slide 1.
 *
 * Two elements (A: visible, B: preload spare) are enough for a
 * TikTok-style swipe deck:
 *   - On open: A.src = first video, B.src = silent placeholder. Both
 *     get a synchronous play() then pause(), inside the gesture handler.
 *   - On swipe: the deck calls setVisibleSrc(nextSrc) — pool routes
 *     this to whichever element already has nextSrc preloaded
 *     (rotating the active slot), or loads on A if neither slot has it.
 *     The other slot is then assigned to preload the next-next video.
 *   - Worst case decoder usage = 2 (≪ iOS's 4-6 ceiling).
 *
 * Singleton lifetime = browser tab. Elements live in a detached
 * fragment until LightboxDeck appends them; Deck unmount detaches them
 * back. Re-opening reuses the same elements so blessing carries over,
 * but bless() is also re-invoked on each open to refresh (idempotent).
 *
 * SSR safety: ensureElements() guards `typeof document` and is only
 * ever invoked from event handlers / effects (post-mount).
 */

const SILENT_PLACEHOLDER_SRC = '/silent.mp4'

type Slot = 'a' | 'b'

class MediaPool {
  private a: HTMLVideoElement | null = null
  private b: HTMLVideoElement | null = null

  /** Create the pool's <video> elements if they don't exist yet. */
  ensureElements(): { a: HTMLVideoElement; b: HTMLVideoElement } {
    if (typeof document === 'undefined') {
      throw new Error('MediaPool requires a DOM environment')
    }
    if (!this.a) this.a = this.createElement()
    if (!this.b) this.b = this.createElement()
    return { a: this.a, b: this.b }
  }

  private createElement(): HTMLVideoElement {
    const el = document.createElement('video')
    el.playsInline = true
    el.loop = true
    el.muted = true
    el.preload = 'auto'
    return el
  }

  /**
   * Synchronous gesture-time priming. Call this from inside the click /
   * touchend handler that opens the lightbox — the play() call must run
   * in the same call stack as the user gesture for iOS to register the
   * element as user-activated. The .then(pause) chain runs in a later
   * microtask; iOS only requires the play() invocation to be in-gesture.
   *
   * primarySrc is the video that will play first (so A is preloaded
   * with it). B gets a silent placeholder so it's also blessed without
   * playing user-audible content.
   */
  bless(primarySrc: string): void {
    const { a, b } = this.ensureElements()

    if (a.getAttribute('src') !== primarySrc) {
      a.src = primarySrc
      a.load()
    }
    if (b.getAttribute('src') !== SILENT_PLACEHOLDER_SRC) {
      b.src = SILENT_PLACEHOLDER_SRC
      b.load()
    }
    a.muted = true
    b.muted = true

    // Synchronous play() inside the gesture handler captures iOS's
    // user-activation token. The .catch swallows any rejection
    // (e.g. play() rejected because src is still loading) — the
    // gesture is captured at invocation, not resolution.
    void a.play().then(() => a.pause()).catch(() => { /* gesture captured */ })
    void b.play().then(() => b.pause()).catch(() => { /* gesture captured */ })
  }

  /**
   * Make the slot whose src matches `targetSrc` the visible/playing
   * one. If neither slot has it, load+play on `preferredSlot`. Returns
   * which slot ended up active so the caller can preload the next on
   * the other slot.
   */
  setVisible(targetSrc: string, preferredSlot: Slot = 'a'): Slot {
    const { a, b } = this.ensureElements()
    let activeSlot: Slot
    if (a.getAttribute('src') === targetSrc) {
      activeSlot = 'a'
    } else if (b.getAttribute('src') === targetSrc) {
      activeSlot = 'b'
    } else {
      activeSlot = preferredSlot
      const el = activeSlot === 'a' ? a : b
      el.src = targetSrc
      el.load()
    }

    const active = activeSlot === 'a' ? a : b
    const inactive = activeSlot === 'a' ? b : a

    // Pause the inactive slot — frees its decoder slot if iOS holds
    // one. Active slot plays.
    inactive.pause()
    void active.play().catch(() => { /* see canplay retry below */ })

    // canplay retry — readyState may be too low at first attempt on
    // newly-loaded src, especially on videos without faststart.
    if (active.readyState < 3) {
      const onCanplay = () => {
        void active.play().catch(() => {})
      }
      active.addEventListener('canplay', onCanplay, { once: true })
    }

    return activeSlot
  }

  /** Preload `src` on the given slot without playing. */
  preload(slot: Slot, src: string): void {
    const el = slot === 'a' ? this.a : this.b
    if (!el) return
    if (el.getAttribute('src') === src) return
    el.src = src
    el.load()
  }

  /** Pause both elements (e.g. on photo slides). */
  pauseAll(): void {
    if (this.a) this.a.pause()
    if (this.b) this.b.pause()
  }

  /** Sync the muted state to both elements. */
  setMuted(muted: boolean): void {
    if (this.a) this.a.muted = muted
    if (this.b) this.b.muted = muted
  }

  getElement(slot: Slot): HTMLVideoElement | null {
    return slot === 'a' ? this.a : this.b
  }
}

export const mediaPool = new MediaPool()
