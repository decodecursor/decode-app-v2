import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DECODE',
  description: 'Beauty ambassador platform',
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
        background: '#111',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          background: '#000',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}
