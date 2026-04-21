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
  viewportFit: 'cover',
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
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .amb-auth-fallback-link {
          position: absolute;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 12px;
          color: #888;
          bottom: calc(54px + env(safe-area-inset-bottom, 0px));
        }
        .amb-auth-legal-footer {
          position: absolute;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 9px;
          color: #555;
          line-height: 1.6;
          padding: 0 40px;
          bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        }
        @media (max-width: 450px) {
          .amb-auth-fallback-link {
            bottom: calc(54px + env(safe-area-inset-bottom, 0px) + 56px);
          }
          .amb-auth-legal-footer {
            bottom: calc(20px + env(safe-area-inset-bottom, 0px) + 56px);
          }
        }
        .amb-dot {
          display: inline-block;
          vertical-align: baseline;
          animation: amb-dot-bounce 1s infinite ease-in-out;
        }
        .amb-dot-1 { animation-delay: 0ms; }
        .amb-dot-2 { animation-delay: 130ms; }
        .amb-dot-3 { animation-delay: 260ms; }
        @keyframes amb-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%           { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes amb-submit-flash {
          0%   { filter: brightness(1); }
          40%  { filter: brightness(1.15); }
          100% { filter: brightness(1); }
        }
      `}</style>
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
