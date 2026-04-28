import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'WeLoveDecode',
  description: 'Beauty ambassador platform',
}

// Slice 7C item 35 fix 1: dropped maximumScale + userScalable per
// Lighthouse a11y. width + initialScale inherit from root layout
// (app/layout.tsx). themeColor + viewportFit are public-route-group
// overrides.
export const viewport: Viewport = {
  themeColor: '#000',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

/**
 * Public route-group layout. Auth-free — no Supabase getUser, no redirect.
 * Dark chrome matches the mockup (public_page_final.html, background #000).
 * Full-width mobile-first; no ambassador-dashboard side padding.
 *
 * Slice 7C item 35 fix 2: outer wrapper is <main> so the seven
 * (public)-route-group surfaces (/{slug}, /listing/confirmation,
 * /wish/confirmation, /listing/paid, /wish/taken, /expired, /terms,
 * /privacy) all carry the landmark Lighthouse a11y requires.
 * /not-found gets its own <main> in NotFoundClient; /pay/[token]
 * gets it in CheckoutClient + WishCheckoutClient (top-level app/pay,
 * not in this route group).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {children}
    </main>
  )
}
