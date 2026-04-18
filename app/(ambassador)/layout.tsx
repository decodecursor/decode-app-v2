import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'WeLoveDecode',
  description: 'Beauty ambassador platform',
}

export const viewport: Viewport = {
  themeColor: '#000001',
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
        padding: '24px 16px',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto',
          minHeight: 'calc(100vh - 48px)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
