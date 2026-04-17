import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'DECODE',
  description: 'Beauty ambassador platform',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function AmbassadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'safe center',
        justifyContent: 'safe center',
        padding: '24px 16px',
        overflowX: 'hidden',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>{children}</div>
    </div>
  )
}
