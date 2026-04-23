# Professional Avatar Cropper — UI Spec (FINAL)

**File:** `professional_avatar_cropper_final.html`
**Project:** WeLoveDecode — beauty ambassador platform
**Route:** Not a standalone route. Rendered as a full-screen overlay from the Add Listing page (`/model/listings/new`).
**Access:** Authenticated ambassadors only (inherits Add Listing's auth context).
**Design philosophy:** Same dark-overlay language as the public media lightbox. Full-bleed crop stage, scrim-legible chrome, no floating panels. Consistent visual family across overlays.

---

## 1. Purpose

A full-screen overlay for cropping a professional's avatar photo before upload. The ambassador picks a photo from their device, positions it within a circular frame using drag + zoom, and confirms the crop. Output is a 400×400 JPEG uploaded to `model-media` storage under the ambassador's user-scoped folder.

Used on the Add Listing page when the ambassador taps the profile-photo upload button in the Professional section.

---

## 2. Navigation — Full Map

### 2.1 Inbound (entry points)

| Source | Mechanism | Notes |
|---|---|---|
| Add Listing page (`/model/listings/new`) | Tap the profile-photo upload circle in the Professional section. Opens a native file picker. After user selects an image, the cropper overlay mounts with the selected file as input. | **Primary and only path.** Input is a `File` object; the cropper renders it via `URL.createObjectURL()`. |

**No standalone entry.** The cropper is never navigated to directly — it's always invoked from the Add Listing form.

### 2.2 Outbound (all exits)

| Element | Destination | Behavior | Notes |
|---|---|---|---|
| **Cancel button** (X, top-left) | Dismiss overlay | Cropper unmounts. Add Listing form in background, profile photo unchanged. | Convention (lightbox close is top-right, but cropper Cancel is top-left to differentiate "discard work" from "close viewer"). |
| **Use button** (top-right, pink) | Confirm crop → pass Blob to parent → dismiss overlay | Canvas-exports the cropped region as a 400×400 JPEG Blob at quality 0.9. Parent Add Listing form receives the Blob via `onCropComplete(blob)`, shows local preview, starts upload. | Primary action. Brand pink (`#e91e8c`). |
| **Escape key** | Dismiss overlay (same as Cancel) | Cropper unmounts without committing. | Works on desktop with physical keyboards. |

**No click-outside-to-dismiss.** Unlike the lightbox (where the frame floats over a backdrop), the cropper fills the full screen — there is no outside to click. Cancel is the only non-Use exit.

### 2.3 In-cropper interactions (state changes only)

| Element | Action |
|---|---|
| **Drag image** (inside crop container) | Pan image within the circular frame. Clamped so the image cannot leave the frame. |
| **Slider** (bottom) | Zoom 1× to 4×. Re-clamps pan position on zoom change (so image never escapes frame after zoom-out). |
| **Touch pinch** (mobile, future) | Not implemented in V1. Slider handles all zoom. |

---

## 3. Data contract

### 3.1 Mount inputs

The cropper is a React component with this prop shape:

```ts
interface ImageCropperProps {
  sourceFile: File;                       // The file selected from native picker
  mode: 'avatar' | 'listing';             // Avatar: 400x400 circle. Listing: 720x1280 rect (separate spec, this file covers avatar only).
  onCropComplete: (blob: Blob) => void;   // Called with output Blob on Use
  onCancel: () => void;                   // Called on Cancel / Escape
}
```

### 3.2 Mount lifecycle

1. Add Listing form opens native file picker (`<input type="file" accept="image/*">`)
2. User selects image → Add Listing passes `File` to cropper via props
3. Cropper mounts, calls `URL.createObjectURL(sourceFile)` for display
4. Image loads into cropper, auto-fits to fill the 280×280 frame (cover-fit, zoom=1)
5. User drags + zooms to pick crop region
6. User taps Use → cropper canvas-exports → calls `onCropComplete(blob)` → unmounts
7. OR user taps Cancel / presses Escape → cropper calls `onCancel()` → unmounts. No Blob produced.

### 3.3 Output shape

**Blob specification:**
- Format: `image/jpeg`
- Quality: `0.9`
- Dimensions: exactly 400×400 pixels
- Source region: the circular area currently visible in the 280×280 frame, sampled from the original uploaded image at current pan + zoom state
- Visual crop shape: circle (what the user sees as the frame)
- Technical crop shape: square (400×400) — the circle mask is visual only; the exported Blob is a square JPEG and is displayed as a circle via CSS `border-radius: 50%` throughout the app

**Why the Blob is square, not pre-masked circle:**
- JPEGs don't support transparency (can't store alpha for the corners)
- PNG would support it but file size ~5× larger for the same dimensions
- Display layer always renders as circle via CSS — the square corners are never visible

### 3.4 Storage integration (handled by Add Listing, not cropper)

Out of scope for this spec. Add Listing receives the Blob, uploads to `model-media/{uid}/professionals/avatars/{filename}.jpg`, stores the returned public URL in form state, then includes it in the professional-creation POST.

---

## 4. Layout structure

Full-screen overlay. All elements absolutely positioned relative to the viewport (or portal root).

1. **Scrim top** — 110px gradient `rgba(0,0,0,0.55) → transparent` — keeps the top chrome legible over bright images.
2. **Scrim bottom** — 170px gradient `transparent → rgba(0,0,0,0.92)` — keeps the slider legible.
3. **Cancel button** (top-left, 32×32) — X icon, white, at `top:20px; left:18px`.
4. **Title** ("Crop photo") — centered at `top:20px`, white, 14px/500, 32px tall to vertically align with Cancel + Use. Pointer-events disabled (decorative).
5. **Use button** (top-right) — "Use" text, brand pink `#e91e8c`, 14px/600, at `top:20px; right:18px`, 32px tall.
6. **Crop stage** — fills the middle region (`top:70px; bottom:170px`). Contains:
   - **Crop container** (280×280 square for avatar, 280×498 rect for listing; centered) — the interactive drag surface
   - **Image** (absolutely positioned inside container, initially cover-fit)
7. **Dim + frame overlay** — a single **full-viewport** SVG rendered as a sibling of the crop stage (not nested inside the crop container). Contains:
   - **Mask cutout** — dims the entire viewport at `rgba(0,0,0,0.55)` **except** the crop-frame region (circle for avatar mode, rounded rectangle for listing mode). The cutout is positioned at the same center as the crop container (viewport horizontal center, crop-stage vertical center = `viewportHeight / 2 − 50`).
   - **Frame border** (2px white) — rendered in the same SVG overlaying the cutout, crisp edge on the dim/clear boundary. Circle for avatar, 8px-radius rect for listing.
   - `pointer-events: none` so drag + zoom events still reach the crop container below.
8. **Slider** (bottom, `bottom:48px`) — horizontal zoom control with −/+ icons and helper text.

### Z-index stacking (bottom to top)

1. Crop container + image (implicit, behind the dim overlay)
2. Scrims — top and bottom (`z-index: 1`)
3. Crop stage (`z-index: 2`)
4. Dim + frame overlay (`z-index: 3`, full viewport, `pointer-events: none`)
5. Slider (`z-index: 3`, above the slider-region's dim)
6. Title, Cancel, Use buttons (`z-index: 4`)

**Note:** No status bar is rendered by the cropper. The device's native status bar shows through at the top of the screen (iOS / Android handle it). The mockup file intentionally omits a fake status bar to prevent design-drift into painting our own — production is cleaner this way.

---

## 5. Interaction mechanics

### 5.1 Cover-fit on load

When the image loads, compute base scale so the image's shorter dimension fills the 280×280 frame:

```js
baseScale = Math.max(FRAME_SIZE / naturalW, FRAME_SIZE / naturalH);
renderedW = naturalW * baseScale * zoom;
renderedH = naturalH * baseScale * zoom;
```

At `zoom=1`, one axis fills the frame, the other overflows. User can drag to reveal the overflowing region.

### 5.2 Drag pan + clamping

Drag is translated directly to pixel offset (`posX`, `posY`). On every move, position is clamped so the image cannot leave the frame:

```js
function getBounds(zoom) {
  var renderedW = naturalW * baseScale * zoom;
  var renderedH = naturalH * baseScale * zoom;
  return {
    maxX: Math.max(0, (renderedW - FRAME_SIZE) / 2),
    maxY: Math.max(0, (renderedH - FRAME_SIZE) / 2)
  };
}

function clampPos(x, y, zoom) {
  var b = getBounds(zoom);
  return {
    x: Math.max(-b.maxX, Math.min(b.maxX, x)),
    y: Math.max(-b.maxY, Math.min(b.maxY, y))
  };
}
```

When `renderedW === FRAME_SIZE` (landscape image at zoom=1), `maxX=0` — image can't pan horizontally. Same for height/vertical. This is correct — user must zoom to pan that axis.

### 5.3 Zoom recalc on slider change

On zoom change, re-clamp current position:

```js
zoom = newValue;
clamped = clampPos(posX, posY, zoom);
posX = clamped.x;
posY = clamped.y;
```

Prevents image escaping the frame when user zooms out from a heavily-panned state.

### 5.4 Event sources

- **Mouse:** `mousedown` on container starts drag; `mousemove` + `mouseup` on `document` (not container) so drag continues past container edge
- **Touch:** `touchstart` on container, `touchmove` + `touchend` on `document`. Single-finger only (`e.touches.length === 1`).
- **Keyboard:** `Escape` on document closes cropper (same as Cancel).

### 5.5 Cursor feedback

- Idle: `cursor: grab`
- Active drag: `cursor: grabbing`
- Slider thumb: `cursor: grab` / `grabbing` during drag
- Buttons: `cursor: pointer`

---

## 6. Canvas export math

On Use tap, the current visible region of the image (the 280×280 window, circular visually but square technically) is sampled from the original uploaded `File` and rendered to a 400×400 canvas.

```js
var canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 400;
var ctx = canvas.getContext('2d');

var renderedW = naturalW * baseScale * zoom;
var srcScale = naturalW / renderedW;  // multiplier from rendered px to source px
var srcW = FRAME_SIZE * srcScale;     // source region width covering the frame
var srcH = FRAME_SIZE * srcScale;
var srcX = (naturalW - srcW) / 2 - (posX * srcScale);
var srcY = (naturalH - srcH) / 2 - (posY * srcScale);

ctx.drawImage(sourceImg, srcX, srcY, srcW, srcH, 0, 0, 400, 400);
canvas.toBlob(cb, 'image/jpeg', 0.9);
```

**Why sample from the original, not the rendered DOM image:** the DOM image may be downscaled for display. Sampling from the natural-resolution source preserves maximum quality in the output.

**Source file stays in memory only.** No pre-upload file is written anywhere. The Blob handed to `onCropComplete` is the first persisted artifact.

---

## 7. Typography + color

All `system-ui, -apple-system, sans-serif`.

| Element | Size | Weight | Color |
|---|---|---|---|
| Title "Crop photo" | 14px | 500 | `#fff` |
| Cancel icon stroke | — | — | `#fff` @ 1.8px stroke |
| Use button | 14px | 600 | `#e91e8c` |
| Slider track base | — | — | `rgba(255,255,255,0.2)` |
| Slider fill | — | — | `#e91e8c` |
| Slider thumb | — | — | `#fff` with `0 1px 4px rgba(0,0,0,0.4)` shadow |
| Slider +/− icons | — | — | `rgba(255,255,255,0.75)` stroke |
| Helper text "Drag to position · Slider to zoom" | 11px | 400 | `rgba(255,255,255,0.5)` |
| Circle border | — | — | `#fff` @ 2px |
| Outside-circle dim | — | — | `rgba(0,0,0,0.55)` |

---

## 8. Keyboard shortcuts

| Key | Action |
|---|---|
| Esc | Close cropper (same as Cancel). No Blob emitted. |

Intentionally limited. Enter / Space could map to Use but risks accidental confirmation when user just loaded an image — not worth it for V1.

---

## 9. Resolved decisions

| Item | Decision |
|---|---|
| Overlay style | Full-screen overlay — same visual language as the public media lightbox |
| Interaction model | Drag + zoom slider. Matches original mockup (`add_listing_final.html` lines 168-603). NOT reposition-only. |
| Crop frame shape | Circle for avatar mode (round avatar is how it displays throughout the app). Square for listing mode (separate spec, separate component instance). |
| Output format | 400×400 JPEG quality 0.9 |
| Output shape | Square JPEG; circle is visual only, rendered via CSS `border-radius:50%` wherever the avatar displays |
| Cancel position | Top-left (discard-work convention, distinct from lightbox's top-right close) |
| Use position | Top-right, brand pink |
| Click-outside-to-dismiss | Not supported — cropper fills screen, no "outside" to click |
| Zoom range | 1× to 4× (same as original mockup) |
| Pinch-to-zoom | Not in V1. Slider only. |
| Mobile/desktop | Same UX both. Mouse + touch event handlers parallel. |
| File format accepted (input) | Any `image/*` the browser can decode (JPEG, PNG, WebP, HEIC on supported browsers) |
| Compression before upload | Handled by parent Add Listing form via `browser-image-compression` AFTER crop (not inside cropper). Cropper outputs raw 400×400 JPEG quality 0.9; parent compresses if needed. |
| HEIC handling | If browser can't decode, `tmp.onerror` fires — parent shows error toast. Out of scope for cropper. |
| Analytics | None. Cropper is a private interaction, not a tracked event. |
| Retry / re-upload | User cancels cropper, taps avatar upload again, native picker reopens. Cropper is not session-state-persistent. |

---

## 10. Consistency with public media lightbox

This spec explicitly mirrors `public_media_lightbox_final_UI_Spec.md` where applicable. Shared design tokens:

| Token | Cropper | Lightbox | Match? |
|---|---|---|---|
| Full-screen dark overlay | ✓ | ✓ | Yes |
| Scrim top height | 110px | 90px | Cropper is slightly taller (more chrome to darken) |
| Scrim bottom height | 170px | 130px | Cropper is taller (slider + helper text) |
| Scrim top color | `rgba(0,0,0,0.55)→transparent` | `rgba(0,0,0,0.55)→transparent` | Yes |
| Scrim bottom color | `transparent→rgba(0,0,0,0.92)` | `transparent→rgba(0,0,0,0.92)` | Yes |
| Brand pink | `#e91e8c` | `#e91e8c` | Yes |
| Top-button size | 32×32 | 32×32 | Yes |
| Top-button icon stroke | 1.8px | 1.8px | Yes |
| Typography | `system-ui, -apple-system, sans-serif` | Same | Yes |
| Close icon (X) | Top-left | Top-right | Different (intentional — discard vs close semantics) |

The cropper feels like a sibling of the lightbox, not a parallel invention. This is Principle I (DECODE_PROJECT_STATE.md) — generic UI primitives must be defined once and reused everywhere.

---

## 11. Build checklist for Claude Code

### Frontend (this file)

- [ ] Create `components/ambassador/ImageCropper.tsx` React component
- [ ] Props: `sourceFile: File`, `mode: 'avatar' | 'listing'`, `onCropComplete: (blob: Blob) => void`, `onCancel: () => void`
- [ ] For `mode='avatar'`: 280×280 crop container with circular mask + circle border, 400×400 output
- [ ] For `mode='listing'`: 280×498 crop container with rectangular mask + rectangle border, 720×1280 output (extend spec with listing-mode details if diverges meaningfully)
- [ ] Use `URL.createObjectURL(sourceFile)` to display; revoke on unmount
- [ ] Implement drag (mouse + touch, document-level move/end listeners)
- [ ] Implement zoom slider (1–4×, input type="range" overlaid on styled track)
- [ ] Clamp position on every drag + zoom change
- [ ] Canvas export: sample from natural-resolution image, output via `canvas.toBlob(cb, 'image/jpeg', 0.9)`
- [ ] Escape key handler (document-level) → `onCancel()`
- [ ] Portal the overlay to `document.body` so it escapes any parent overflow/z-index context

### Design system compliance

- [ ] Use same scrim values as lightbox (verified in §10)
- [ ] Use brand pink `#e91e8c` (verified in §10) — NOT the lighter `#ED93B1` variant
- [ ] Typography matches lightbox
- [ ] Cancel icon matches lightbox close-X icon style exactly (1.8px stroke, 18×18 viewBox, same path coords)

### Add Listing integration (out of scope for this spec, but assumed)

- [ ] Profile photo upload tile opens native file picker on tap
- [ ] On file selection, mount `<ImageCropper sourceFile={file} mode="avatar" onCropComplete={...} onCancel={...} />`
- [ ] On `onCropComplete(blob)`: show local preview (URL.createObjectURL on blob), start upload to `model-media/{uid}/professionals/avatars/{uuid}.jpg`
- [ ] On `onCancel`: unmount cropper, leave form state unchanged
- [ ] Upload uses existing cover-upload pattern in `/api/ambassador/model/settings/route.ts` for Principle E consistency

### ~~Dev verifier (previously at `/dev/cropper`)~~

~~- [ ] Update to match this spec (circle mask, scrims, brand pink, icon-based slider marks)~~
~~- [ ] Both avatar and listing presets verifiable in isolation~~

**RETIRED at Slice 3B closeout.** The `/dev/cropper` standalone verifier route served its purpose during Phase 2 (pre-integration sanity checks on the cropper in isolation). Once the cropper was verified in production as an actual overlay on the Add Listing page, the verifier became throwaway scaffolding and was deleted to keep the public route surface clean.

---

## 12. Files

- `professional_avatar_cropper_final.html` — interactive mockup (standalone, self-contained)
- `professional_avatar_cropper_final_UI_Spec.md` — this document
- `public_media_lightbox_final.html` / `_UI_Spec.md` — sibling spec, shared visual language
- `add_listing_final.html` — parent form that invokes this cropper

---

## 13. Edge cases

| Case | Behavior |
|---|---|
| User selects a corrupted image file | `tmp.onerror` fires on hidden Image load. Cropper emits `onCancel` after showing a toast "Couldn't load that photo." Parent handles retry. |
| User selects a very large image (e.g. 8000×8000 DSLR) | Image loads fine; browser downscales for display. Canvas export samples from natural resolution regardless — output is still 400×400 JPEG. Memory spike possible on low-end devices — monitor for OOM crashes; acceptable for V1. |
| User selects a very small image (e.g. 200×200, smaller than frame) | `baseScale > 1` means rendered image fills frame but pixelates. Output still 400×400 but visibly blurry. No code prevents this; acceptable — the upload will be ugly but functional. Consider a min-resolution warning in a future iteration. |
| User rapidly drags then taps Use mid-drag | Drag end fires first (touchend/mouseup), then Use click. Final position is the drag-end position. Correct. |
| User drags outside the cropper frame (mouse crosses browser edge) | Document-level mousemove/mouseup listeners ensure drag state cleans up correctly. Tested. |
| User rotates phone mid-crop | Frame dimensions unchanged (280×280 is CSS pixels, not viewport-relative). Image stays at its last position. Acceptable. |
| HEIC image on Firefox (can't decode) | `tmp.onerror` → onCancel with error toast. HEIC → JPEG conversion is out of scope; user needs to convert externally or use a supported browser. |
| User cancels before image finishes loading | Cropper unmounts cleanly; `URL.createObjectURL`'d URL is revoked in cleanup. No leaks. |
| Slider drag + image drag simultaneously (two fingers) | Touchstart guards with `e.touches.length === 1` → pinch gestures don't start a drag. Slider's native range input handles its own touch. No conflict. |

---

## 14. Outstanding items

- [ ] Pinch-to-zoom (V2 — current users can use slider; add if feedback demands)
- [ ] Tap-to-reset (V2 — button to reset zoom=1, pos=0,0 if user gets lost)
- [ ] Rotation (V2 — rotate 90° in case user's photo imported sideways; iOS often does this)
- [ ] Min-resolution warning (V2 — if source image < 400×400 natural, warn before upload)
- [ ] HEIC → JPEG client-side conversion (V2 — would unlock iOS photo library HEIC files on Firefox/desktop; requires ~200KB library like heic2any)
