# DECODE Case Study Page — UI Spec

The reference file is `case-study-boujie-FINAL.html`. This spec documents the design system and every section so the page can be rebuilt as a Next.js route, extended to other salons, or maintained without guessing.

## Purpose
A public proof page ("receipts, not promises") linked from cold emails to beauty professionals. One salon, real results from a single Discovery Package. Design language matches the live `/discovery-package` and `/professional` pages.

## Route
- Live at `/case/boujie`, built as a reusable pattern `/case/[salon-slug]`.
- Public, no auth, no data fetching. Self-contained static page.

## Design tokens (locked — match live DECODE pages)
- Background: `#000` pure black
- Accent (DECODE blue): `#5BA3E0`
- Text greys: `#fff` (primary), `#CCC` (secondary), `#888` (muted), `#777`/`#666` (faint)
- Borders: `#1f1f1f` (default), `#2a3a4a` (blue-tinted), `#2a2a2a` (frames)
- Headline/number font: Cormorant Garamond, italic, weight 400–500
- Body/label font: Inter, weight 400–700
- Eyebrows: 11px, letter-spacing 3–4px, uppercase, `#888`
- Nav link weight: 400 (NOT bold — matches live "The story →")
- Amber "remaining time" on progress bar: track `#3a2f1a`, border `#5a4a28` (deliberate off-palette so the unfilled portion is visible against blue)

## Layout primitives
- `.stage` = full-bleed section, `min-height:88vh`, centered, used for hero / mega numbers / quote / CTA.
- `.stage.short` = auto height with 120px padding, used for content sections.
- Max content width ~760–960px depending on section.
- Mobile breakpoint at 760px: grids collapse to 1 column, font sizes drop.

## Sections (top → bottom)
1. **Nav** — logo (`app.welovedecode.com/logo.png`, inverted to white) + "Discovery Package →" link (weight 400) to `/discovery-package`.
2. **Hero** — eyebrow "Case Study Number 1 · May 2026" / h1 "What the first month / actually delivered" / sub "With three ambassadors."
3. **Business** (Option 1 centered stack) — centered salon name "Boujie Ladies Salon" + "Khalifa City, Abu Dhabi, UAE", then a centered pair: real IG screenshot (left, ~200px, padded phone-bezel frame, links to instagram.com/boujie.ae, "View on Instagram →") + rating cluster (right: giant "4.7★", "Google rating / 428 reviews", "Discovery Package · 3 Ambassadors").
4. **Mega number 1** — "13 / New clients" + description.
5. **Mega number 2** — "AED 10,400 / Revenue earned" (AED is 64px baseline-aligned, the number is 170px).
6. **Supporting strip** — 3 numbers: 47 WhatsApp conversations · 9 Phone calls · 2.9× Return on investment.
7. **90-day progress bar** — eyebrow "90-day contract"; bar with blue fill 0–33%, amber remaining; white "We are here ▼" marker + "Day 30" under it at 33%; faint Day 60 marker at 66%; axis Day 0 / Day 90; caption "Profitable in 30 days. The contract runs for 90. The remaining two months add returning clients and referrals at zero additional cost."
8. **Quote** — "My team kept asking who Alesia was. / Then we realized: she'd sent us six new clients." — SILA · FOUNDER · BOUJIE LADIES SALON. (38px, not dominating the mega numbers.)
9. **Ambassadors** — eyebrow "The ambassadors" / "Three real women. With real jobs." / "no influencers · no fake followers · no bots". Three clickable cards (hover = border color only, no movement): real circular photo, first name, italic-blue job title, Instagram-icon + handle (no "@"), "N clients" (number + word both white).
10. **Agency comparison** — eyebrow "Agency comparison", "Boujie spent AED 3,600.", bars DECODE 3,600 vs Agency 76,320 (red), punch "21× cheaper for 90 days.", then real agency-quote screenshot under label "Agency numbers based on a real quotation".
11. **Why it works** — "It isn't magic." + 2 centered sourced cards: 2–3× (Digital Applied / Stack Influence 2026), 88% (Nielsen 2021).
12. **CTA** — "Want the same?" / "We cooperate with limited ambassadors per city." (13px) / solid white "Start with Ambassadors →" button (opacity fade on hover, no scale) → wa.me/971554275547.
13. **Footer** — "Questions? WhatsApp us →" (white) + social icons (Instagram/TikTok/YouTube @welovedecode).

## Real assets (all live, Supabase bucket `case-studies`, project ref `vdgjzaaxvstbouklgsft`)
- Boujie IG screenshot: `.../IMG_2108.PNG`
- Boujie IG: instagram.com/boujie.ae/
- Alesia · Ballet dancer · instagram.com/divin_alesia/ · photo `.../Screenshot%202026-05-31%20130445.png` · 6 clients (quote star)
- Valeryia · Dancing teacher · instagram.com/nonstop_dancer_valeryia · photo `.../Screenshot%202026-05-31%20130622.png` · 4 clients
- Sarah · Piano teacher · instagram.com/snh_pianist · photo `.../Screenshot%202026-05-31%20153810.png` · 3 clients
- Agency quote: `.../Screenshot%202026-05-31%20100044.png`

## Real vs assumed data
REAL: salon profile (name, @boujie.ae, 551/7,820/974, 4.7★/428 reviews, location, services), all 3 ambassador identities/photos/handles/jobs, agency quote screenshot, DECODE price (AED 3,600 / 3 ambassadors / 90 days), owner name (Sila), launch month (May 2026).
ASSUMED (believable placeholders — swap when real Discovery #1 data lands): 13 new clients, AED 10,400 revenue, 2.9× ROI, 47 conversations, 9 phone calls, the per-ambassador split (6/4/3), the quote number (six).

## Data-consistency rules (MUST hold if numbers change)
1. The 3 ambassador card numbers sum to the "new clients" mega-number.
2. The star ambassador's card number = the quote number; she is the highest.
3. Revenue ÷ 3,600 = the ROI shown.
4. Keep 30-day ROI modest enough that the page's repeat/referral framing (not ×3 extrapolation) carries the upside; the bar caption must not imply linear tripling.
5. Agency comparison (3,600 vs 76,320, "21×") still needs an honest 90-day normalization pass — currently flagged for later.
