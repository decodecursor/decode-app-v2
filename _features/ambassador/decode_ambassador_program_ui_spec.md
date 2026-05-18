# DECODE — UI Specification

The complete design system and behavioral spec for all consumer-facing pages of `app.welovedecode.com`.

| Route | File | Purpose |
|---|---|---|
| `/` | `decode_choice_gate.html` | Choice gate — first impression, optional founder note, two doors |
| `/ambassador` | `decode_ambassador_landing.html` | Ambassador-facing landing — "We finally pay women to be real" |
| `/professional` | `decode_professional_landing.html` | Beauty professional landing — "Get recommended by women who already love you" |
| `/ambassador-program` | `decode_ambassador_program.html` | Informational summary — the canonical Ambassador deal page |

---

## 1. Brand foundation

### Colors

The entire system uses **three colors only**:

| Token | Hex | Usage |
|---|---|---|
| `#000` | Pure black | All page backgrounds, founder overlay, story overlay |
| `#FFF` | Pure white | All primary text, logos, CTA fills, button borders, signature |
| `#888` | Mid grey | Body copy, sub-headings, eyebrows, section quiet text |
| `#CCC` | Light grey | Bullet text on bullet pages (`/ambassador-program`) |
| `#444` | Dark grey | Section dividers (Trust Stack, Story overlay, Program page) |
| `#1a1a1a` | Near-black | Video container backgrounds (before video loads) |

**No gold. No accents. No gradients on UI surfaces.** The only saturation in the entire system comes from the DECODE pattern image used in the bloom transition on `/`.

### Typography

Two typefaces, layered intentionally:

| Use | Typeface | Weights loaded |
|---|---|---|
| Headlines, blocks, story, founder note | **Cormorant Garamond Italic** | 400, 500, 600, 700 |
| Headlines (regular, rare) | Cormorant Garamond Regular | 400, 500 |
| Body, eyebrows, UI text | **Inter** | 400, 500, 600 |

**Google Fonts import** (identical on all four pages):

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500;1,600;1,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

### Layout grid

- **Max viewport width** for content: `440px` (centered horizontally)
- **Side padding**: `28px` (nav, blocks, footer) or `24px` (sections), `32px` (overlays)
- **Mobile-first**, but constrained to 440px on desktop too — the page IS the phone
- **Safe-area-insets** respected on all top/bottom padding

### Brand language (locked, never edit without explicit permission)

- "company" — never "platform"
- "Ambassador" — never "ambassador" (capital A in product context)
- "Professional" / "beauty professional" — never "salon owner" alone (excludes clinics, doctors)
- "supporters" — never "fans" or "followers"
- AED only for currency
- No use of the word "manifesto"

---

## 2. The choice gate (`/`)

### Purpose
The visitor lands here from any external link to `app.welovedecode.com`. They are not yet committed to either audience. The page asks one question: *who are you?* — silently, with the brand presence underneath.

### Layout

```
┌─ safe-area-top ────────────────┐
│                                │
│  [nav padding 32px]            │
│            "A note from us →"  │  ← top-right link, 12px sans, white
│  [nav height 48px]             │
│                                │
│  [margin-top 94px]             │
│           DECODE               │  ← 38px tall, white logo, centered
│                                │
│  [auto-fill space]             │
│                                │
│  I'm an Ambassador →           │  ← full-width text link, 14px, white, no border
│  I'm a Beauty Professional →   │  ← same
│  [padding-bottom 160px]        │
│                                │
│  safe-area-bottom              │
└────────────────────────────────┘
```

### Logo

- **Source**: `/logo.png`
- **Color treatment**: `filter: brightness(0) invert(1)` — forces source to white
- **Height**: 38px (taller than other pages — center stage)
- **Margin-top**: 94px

### Buttons

Two text-with-arrow links, NO box, NO border:

| Property | Value |
|---|---|
| Font | Inter regular, 14px |
| Color | `#FFF` |
| Letter-spacing | 0.5px |
| Padding | 22px vertical, 20px horizontal |
| Hover | `opacity: 0.65` |
| Active (tap) | `opacity: 0.5` |
| Gap between buttons | 8px |
| Bottom padding (`.gate-actions`) | 160px |

### Founder overlay (opens via *A note from us →*)

Black overlay slides up from bottom (`translateY(100%) → 0`, 400ms cubic-bezier).

**Content (centered):**

```
The beauty industry is broken.       ← 21px italic Cormorant 400, color #FFF
Trust is at an all-time low.         ← same
We put our heart and soul into       ← same
crafting tools to fix what has
been lost.
                                     ← 24px gap (margin-bottom on cta line)
Come build it with us.               ← 21px italic Cormorant 600 (BOLDER), #FFF

[ signature image ]                  ← 100px tall, max 380px wide,
                                       object-fit: cover (cropped to middle)
```

**Signature** at `https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/founder/Signature_no%20line.png`.

**Dismiss**: × button, Escape key. NO Continue button.

### Bloom click effect

When the visitor taps either button, the DECODE pattern image fills the screen (550ms fade in), holds, then navigates.

| Timing | Phase |
|---|---|
| 0–500ms | Bloom fades in (opacity 0→1) + image scales 1.04→1.0 |
| 500–1100ms | Pattern visible at full opacity |
| 1100ms | `window.location.href` to destination |

**Pattern image** at `https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/brand/DECODE%20Pattern_4k.jpeg`. Display at 130% width/height, `object-fit: cover` for full edge-to-edge fill.

### Back-button behavior

`pageshow` event listener resets bloom + founder overlay state on every page show, including BFCache restore. Prevents frozen-bloom-on-back bug.

### Founder overlay visibility

During launch phase: founder note is **on-demand only** (visitor must tap the link). NOT auto-shown. NO localStorage gating.

---

## 3. Ambassador landing (`/ambassador`)

### Purpose
Convert beauty creators (5k–15k Instagram follower range, Dubai/Abu Dhabi based) into Ambassadors. Self-serve signup is live. CTA goes to `/model/auth`.

### Layout

```
[ nav: DECODE logo / The story → ]

   AMBASSADOR              ← eyebrow 11px tracked uppercase, #888

   Find her
   beauty squad.
   Show yours.             ← hero 62px italic Cormorant 400

   We finally pay women    ← sub 14px Inter, #888
   to be real.

[ VIDEO 9:16 - endorsement.mp4 ]

   The whisper, finally    ← block-title 26px italic Cormorant 500
   a page.
   [body about DMs, paid, public]

[ IMAGE 9:16 + SOON badge ]

   Today the loudest wins.
   Let's change that.
   [body about budget, golden hands]

[ VIDEO 9:16 with whisper.png poster ]

   An endorsement.
   Not a tag.
   [body about real customer, paid]

      See her page →       ← side-door link

   ┌────────────────────┐
   │ Become an          │
   │ Ambassador         │  ← CTA, white fill, black text → /model/auth
   └────────────────────┘

   META interrupts.       ← footer 19px italic Cormorant
   DECODE meets.
   A page she chose to visit.
```

### Hero typography
- Font: Cormorant Garamond Italic 400
- Size: **62px**
- Letter-spacing: -1.8px
- Line-height: 1.0
- Three lines forced via `<br>`: *Find her* / *beauty squad.* / *Show yours.*

### Three media blocks — same architecture, different content

Every block has:
- 9:16 media container (`width: 100%; aspect-ratio: 9/16; background: #1a1a1a; border-radius: 14px`)
- `block-title`: 26px italic Cormorant 500, white
- `block-body`: 14px Inter 400, `#888`

| Block | Title | Media | Status |
|---|---|---|---|
| 1 | *An endorsement. Not a tag.* | `endorsement.mp4` | LIVE |
| 2 | *Today the loudest wins. / Let's change that.* | `loudest-wins.jpg` + `Soon` badge | placeholder |
| 3 | *The whisper, finally a page.* | `whisper.mp4` + custom `whisper.png` poster | LIVE |

### SOON badge (Block 2)
White background, black text, Inter 600, 9px, 2.4px tracking, uppercase, top-right of media container.

### CTA
- *Become an Ambassador*
- Inter 500, 15px, white fill, black text, 10px radius, 22px padding
- Links to: `https://app.welovedecode.com/model/auth`

### Footer (italic Cormorant)
```
META interrupts. DECODE meets.
A page she chose to visit.
```
Weight contrast: `DECODE meets.` at 600, rest at 400.

### Story overlay
Slide-up from bottom, 400ms cubic-bezier. Manifesto content (5 beats + 1 quote + 1 final line). Shared with all other pages.

---

## 4. Professional landing (`/professional`)

### Purpose
Convert beauty professionals (salon owners, clinic founders, doctors) into early customers. PRO infrastructure is NOT yet live — CTA goes to WhatsApp.

### Differences from `/ambassador`

Mirrors the Ambassador architecture exactly with these specific differences:

| Element | Ambassador | Professional |
|---|---|---|
| Eyebrow | `AMBASSADOR` (1 line) | `AMBASSADOR` / `FOR BEAUTY PROFESSIONALS` (2 lines) |
| Hero size | 62px | **56px** (smaller — longer copy) |
| Hero copy | *Find her beauty squad. Show yours.* | *Get recommended by women who already love you.* |
| Sub | *We finally pay women to be real.* | *Real clients replace ads. / Real recommendations replace influencers.* |
| Block 1 title | *The whisper, finally a page.* | *She is a real client. She vouches with her name.* |
| Block 2 title | *Today the loudest wins. / Let's change that.* | *1 day vs 90 days.* |
| Block 3 title | *An endorsement. Not a tag.* | *You didn't train 15 years to film TikToks. Return to your craft.* |
| Trust Stack section | NOT present | **PRESENT** (between Block 3 and side door) |
| CTA copy | *Become an Ambassador* | *Let's Chat on WhatsApp* |
| CTA destination | `/model/auth` | `https://wa.me/971554275547` |
| Footer line 2 | *A page she chose to visit.* | *Craft beats marketing. Finally.* |

### Trust Stack section — PRO only

Between Block 3 and the side door. The intellectual climax — the moat statement.

```
─── (32px wide, 0.5px, #444 divider)
       THE TRUST STACK              ← 12px tracked uppercase, #888

   Personal endorsement.            ← 30px italic Cormorant 500, #FFF
   Crowd reviews.
   Live demand.

   The combination is unique.       ← 16px italic Cormorant 500, #888
   Not on Meta. Not on Google. Not on TikTok.
   Only here.
─── (divider)
```

### Why the Trust Stack lives only on PRO
The PRO is comparing platforms — Meta, Google, TikTok, agencies. She needs the moat made explicit before she commits budget. The Ambassador isn't comparing; she's joining a movement.

---

## 5. Ambassador Program page (`/ambassador-program`)

### Purpose
The canonical summary of the Ambassador deal. **Informational, not conversion-driven.** Used by:
- New Ambassadors deciding whether to say yes (linked from WhatsApp / cold email replies)
- Existing Ambassadors who want to reference terms
- Sebastian when answering FAQ questions on WhatsApp

This is the page that replaces a PDF agreement. Public URL, no auth required, updateable at any time.

### Layout

```
[ nav: DECODE logo / The story → ]

       AMBASSADOR PROGRAM            ← eyebrow 11px tracked uppercase (one line)

         The Summary.                ← hero 56px italic Cormorant 400

       What you get. What you give.  ← sub 14px Inter, #888

[ How it works. ]
· We agree on professional and service.
· You try the service (free).
· You create your DECODE page.
· You upload a before/after video.
· You get paid.
· Listing stays live for 90 days.

─── (32px wide, 0.5px, #444)

[ What you get. ]
· Free service.
· AED XX for 90 days.
· Payment cycle is each Wednesday.
· Vetted salons, clinics and doctors.

─── (divider)

[ What you give. ]
· One 15 sec before/after video for 90 days.
· Publish video on your DECODE page.
· No monthly content.
· No posts on your socials required.

─── (divider)

[ Your content. Your rules. ]
· You own your content.
· DECODE will never use your content.
· Professional will never use your content.
· You handle your advertising compliance.

[ Footer ]
Questions? WhatsApp us →
[ social icons row ]
```

### Hero typography
- Font: Cormorant Garamond Italic 400
- Size: **56px** (same as Professional, smaller than Ambassador's 62px)
- One line: *The Summary.*

### Section headings
- Italic Cormorant 500, 26px, white
- All end with a period
- Letter-spacing: -0.4px

### Bullet typography
- Marker: `&middot;` (middle dot character)
- Font: Inter 400, 14px
- Color: `#CCC` (slightly lighter than `#888` sub copy — for readability of dense list)
- Line-height: 1.7
- Margin-bottom between bullets: 4px
- All bullets end with a period

### Section dividers
Thin horizontal lines between bullet sections only — NOT between intro and first section, NOT between last section and footer.

| Property | Value |
|---|---|
| Width | 32px |
| Height | 0.5px |
| Color | `#444` |
| Spacing | 80px below; previous section provides 80px above |

### Differences from landing pages

| Element | Landings | Program |
|---|---|---|
| Media blocks (9:16 video) | 3 blocks | None — text only |
| CTA button (white-filled) | Present | **Absent** — footer link only |
| Side-door link (*See her page →*) | Present | Absent |
| Footer mantra (italic Cormorant *META interrupts*) | Present | **Absent** — replaced by *Questions? WhatsApp us →* |
| Trust Stack section | PRO only | Absent (program is informational, not selling) |
| Hero size | 62px (Ambassador) / 56px (PRO) | 56px |
| Total content density | Marketing-paced | List-paced, scannable in 30 seconds |

### Footer

```
Questions? WhatsApp us →     ← 12px Inter, white, *WhatsApp us →* bolded weight 600, no underline
[ social icons row ]         ← Instagram / TikTok / YouTube
```

**Footer CTA**: WhatsApp link to `https://wa.me/971554275547`. The `WhatsApp us →` portion is `font-weight: 600`, no underline, opens WhatsApp.

**Social icons**: same component as `/ambassador` and `/professional` footers. URLs, design, horizontal gap — all identical to existing pages. Source from existing codebase, do NOT reinvent.

### Story overlay
Same content, same behavior as Ambassador and Professional pages. The story is mythology — shared across all branded pages.

### No advertising compliance bullet content
The fourth bullet under *Your content. Your rules.* — *"You handle your advertising compliance."* — is the page's only legal language. Comprehensive terms (advertiser permit specifics, disclosure rules, governing law, etc.) will live on a separate `/terms/ambassador` page once UAE legal counsel is engaged.

### Placeholder content
- **AED XX for 90 days.** — literal *XX* in production until Sila confirms the final amount per tier. Sila replaces inline before announcing publicly.

---

## 6. Asset registry (Supabase)

All public, no auth needed.

| Path | Used by | Status |
|---|---|---|
| `marketing/ambassador/videos/endorsement.mp4` | Ambassador & PRO Block 1 | LIVE |
| `marketing/ambassador/videos/whisper.mp4` | Ambassador & PRO Block 3 | LIVE |
| `marketing/ambassador/videos/whisper.png` | Ambassador & PRO Block 3 (custom poster) | LIVE |
| `marketing/ambassador/videos/loudest-wins.jpg` | Ambassador & PRO Block 2 (placeholder image) | LIVE |
| `marketing/founder/Signature_no%20line.png` | Choice gate founder overlay | LIVE |
| `marketing/brand/DECODE%20Pattern_4k.jpeg` | Choice gate bloom transition | LIVE |
| `loudest-wins.mp4` | Block 2 video (replaces placeholder image) | NOT YET PRODUCED |
| PRO-specific Block 1 & Block 3 videos | Differentiate PRO from Ambassador placeholders | NOT YET PRODUCED |

Bucket: `marketing` (public). Project URL: `https://vdgjzaaxvstbouklgsft.supabase.co`. Full URL prefix: `https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/`

---

## 7. Cross-page consistency rules

These are inviolable. Any change must be applied to all pages or explicitly justified for divergence.

1. **Header pattern**: white logo top-left + secondary link top-right (12px sans, white, with arrow). Same nav slot across all four pages. Secondary link content varies by page:
   - `/` → *A note from us →*
   - `/ambassador`, `/professional`, `/ambassador-program` → *The story →*

2. **Color palette**: black, white, three greys (`#888`, `#CCC`, `#444`). No accents anywhere except inside the bloom pattern image on `/`.

3. **Typography pairing**: Cormorant italic for emotion/headlines, Inter for utility/bullets. Never swap.

4. **Max-width 440px** on both mobile and desktop. Page is the phone. Surrounding viewport stays black on desktop.

5. **Logo**: `/logo.png` rendered via `<img>` with `filter: brightness(0) invert(1)`. Height varies:
   - `/` choice gate: 38px (center stage)
   - All other pages: 26px (top nav)

6. **Story overlay**: identical content and behavior on `/ambassador`, `/professional`, `/ambassador-program`. Slide-up from bottom, 400ms cubic-bezier, `body.overlay-open` lock, dismissible via × or Escape.

7. **Social icons in footer**: shared component, same URLs, same design, same horizontal gap. Lives on `/ambassador`, `/professional`, and `/ambassador-program`. (Not on `/` choice gate — minimal-by-design.)

8. **Slide-up overlay animation**: `translateY(100%) → 0` over 400ms cubic-bezier(0.16, 1, 0.3, 1).

9. **Body lock during overlay**: `.overlay-open` class on body, `overflow: hidden; height: 100vh;`

10. **All overlays dismissible via × and Escape key**.

11. **Page-type distinction**:
   - **Landing pages** (`/ambassador`, `/professional`): media-rich, story-led, CTA-driven, italic Cormorant footer mantra
   - **Informational pages** (`/ambassador-program`, future `/discovery-package`, future `/terms/*`): bullet-led, no media, no CTA button, WhatsApp link in footer
   - **Gate** (`/`): minimal, two-choice, founder overlay, bloom transition

---

## 8. Files in this delivery

| File | Purpose |
|---|---|
| `decode_choice_gate.html` | Production HTML for `/` |
| `decode_ambassador_landing.html` | Production HTML for `/ambassador` |
| `decode_professional_landing.html` | Production HTML for `/professional` |
| `decode_ambassador_program.html` | Production HTML for `/ambassador-program` |
| `decode_ambassador_cc_prompt.md` | Latest deploy prompt for Ambassador |
| `decode_professional_cc_prompt.md` | Latest deploy prompt for Professional |
| `decode_ambassador_program_cc_prompt.md` | Latest deploy prompt for Ambassador Program |
| `decode_ui_spec.md` | This document |

---

## 9. What's still to come

| Item | Status |
|---|---|
| `loudest-wins.mp4` (Block 2 video) | Not yet produced |
| PRO-specific Block 1 video | Not yet produced (currently uses Ambassador's `endorsement.mp4`) |
| PRO-specific Block 3 video | Not yet produced (currently uses Ambassador's `whisper.mp4`) |
| Cleaned signature image (no Gemini watermark, less padding) | Workaround in CSS via `object-fit: cover` |
| `/ambassador-program` AED XX placeholder | Sila replaces inline before public announcement |
| `/discovery-package` page for Professionals | Same architecture as `/ambassador-program`, different content |
| `/terms/ambassador` comprehensive legal page | After UAE legal counsel engagement |
| Signup flow compliance checkboxes at `/model/auth` | Separate dev round (Advertiser Permit acknowledgment, terms acceptance) |

---

*Last updated for the Ambassador Program page launch: 4-section summary structure, single payment amount placeholder, content ownership protections, advertising compliance acknowledgment, footer with shared social icons component from `/ambassador` and `/professional` pages.*
