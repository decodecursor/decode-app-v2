import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'WeLoveDecode',
  description: 'Beauty ambassador platform',
}

export const viewport: Viewport = {
  themeColor: '#000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

/**
 * Public route-group layout. Auth-free — no Supabase getUser, no redirect.
 * Dark chrome matches the mockup (public_page_final.html, background #000).
 * Full-width mobile-first; no ambassador-dashboard side padding.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {children}
    </div>
  )
}
