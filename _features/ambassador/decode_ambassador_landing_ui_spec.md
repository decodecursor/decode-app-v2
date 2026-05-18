# DECODE Ambassador — Landing Page Spec

## URL

| Item | Value |
|---|---|
| Page lives at | `https://app.welovedecode.com/ambassador` |
| CTA target | `https://app.welovedecode.com/model/auth` |
| Story page | Overlay (no separate URL) |
| Root URL | Reserved for the choice gate — *out of scope for this round* |

The root URL `app.welovedecode.com/` will eventually serve a choice gate (silent: logo + two buttons — *I'm an Ambassador* / *I'm a Beauty Professional*), but that's a separate next step. This page should be wired to `/ambassador` from the start.

---

## Wordmark / logo treatment

The brand wordmark appears in two navs in this file. They are intentionally rendered differently:

| Location | Treatment | Reason |
|---|---|---|
| Landing nav (top of main view) | `<img>` pointing to `/logo.png` | Brand recognition at first contact |
| Story overlay nav (top of slide-up dialog) | Italic Cormorant text "DECODE" | The story is the editorial register — typography stays the visual |

The logo file is at `public/logo.png`. Path in `src` is `/logo.png`.

---

## Why story is an overlay, not a separate page

The story slides up from the bottom over the landing, full-screen, and dismisses with × or Escape. Reasons:

1. **Context preserved.** She came from the landing; the landing waits for her. No reload, no back-button confusion.
2. **It's faster.** No route change, no asset reload. The transition is the experience.
3. **Brand fit.** Hermès editorial, Apple Music's "About this song," any luxury app — overlays deliver mythology. Routes deliver utilities.
4. **The story is mythology, not a page.** It earns its way in with a tap and out with a tap. It doesn't deserve a URL.

---

## Video assets

### Specifications

| Property | Value |
|---|---|
| Aspect ratio | 9:16 (vertical, Reels format) |
| Format | `.mp4` (H.264) |
| Resolution | 1080×1920 minimum |
| Length | 15–30 seconds |
| Audio | Muted by default; user taps controls to unmute |
| Posters | `.jpg`, same aspect, optional but recommended |

### Where to upload

```
/ambassador/videos/
```

(In the project: served from whatever path your build setup uses for static media. If `/public/ambassador/videos/`, the URL `/ambassador/videos/` will resolve. Otherwise adjust.)

### Files and block mapping

| Block (top → bottom) | Title | Video file | Poster file |
|---|---|---|---|
| 1 | An endorsement. Not a tag. | `endorsement.mp4` | `endorsement.jpg` |
| 2 | Today the loudest wins. Let's change that. | `loudest-wins.mp4` *(pending)* | `loudest-wins.jpg` |
| 3 | The whisper, finally a page. | `whisper.mp4` | `whisper.jpg` |

---

## "Under production" state

Block 2 currently shows a quiet placeholder — same dark grey 9:16 container, a small grey dot, and *Under production* in tracked uppercase. No play button. Better than *Coming soon* because it implies craft, not marketing.

When `loudest-wins.mp4` is ready, replace this:

```html
<div class="media" data-status="pending">
  <div class="media-pending">
    <span class="dot"></span>
    <span class="label">Under production</span>
  </div>
</div>
```

With this:

```html
<div class="media">
  <video playsinline preload="metadata" controls poster="/ambassador/videos/loudest-wins.jpg">
    <source src="/ambassador/videos/loudest-wins.mp4" type="video/mp4">
  </video>
</div>
```

That's the only change required.

---

## Behaviors

### Story overlay
- **Open:** tap *The story →* in nav. Slides up from bottom in 0.4s, ease-out.
- **Close:** tap × top-right, or press Escape. Slides back down.
- **Body scroll:** locked while overlay open.
- **Internal scroll:** overlay scrolls itself; opens at top each time.

### CTA
- Standard `<a href>` to `/model/auth`. No JS hijack.

### Videos
- `playsinline` is essential — without it, iOS forces fullscreen on tap.
- `preload="metadata"` — only loads enough for poster + duration.
- Native `controls` shown — user-driven. Brand is contemplative; videos are not feed.

---

## Mobile / desktop

Mobile-first. On viewports ≥ 600px, the page is constrained to **440px max-width and centered**, with the rest black. The page IS the phone — no fake frame in production.

---

## Tech notes

- **Single HTML file**, vanilla JS for the overlay (~20 lines).
- **Cormorant Garamond + Inter** via Google Fonts.
- **Accessibility:** `role="dialog"`, `aria-hidden` toggle, Escape key handling, real `<button>` elements, `aria-label` on the close button.
- **No analytics included** — add separately.
