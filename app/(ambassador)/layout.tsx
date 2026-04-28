import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'WeLoveDecode',
  description: 'Beauty ambassador platform',
}

// Slice 7C item 35 fix 1: dropped maximumScale + userScalable per
// Lighthouse a11y. width + initialScale inherit from root layout
// (app/layout.tsx). themeColor + viewportFit are ambassador-route-
// group overrides.
export const viewport: Viewport = {
  themeColor: '#000',
  colorScheme: 'dark',
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
        overflowX: 'hidden',
        touchAction: 'pan-y',
        scrollPaddingTop: '120px',
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
        /* Phase 7 internal-cluster top-padding carriers. Desktop
           preserves the locked 36px first-content gap; mobile
           (≤768px) reduces top to 20px (~16px reclaimed on
           phone-width viewports). Per-page divergent shapes
           preserved (Settings 24 bottom, Setup 22 horiz, Dashboard
           margin not padding) — only the top dimension changes. */
        .amb-internal-header {
          padding: 36px 20px 20px;
        }
        .amb-internal-header-flush {
          padding: 36px 20px 0;
        }
        .amb-settings-header {
          padding: 36px 20px 24px;
        }
        .amb-dashboard-cover {
          margin: 36px 20px 0;
        }
        .amb-setup-tracker {
          padding: 36px 22px 0;
        }
        @media (max-width: 768px) {
          .amb-internal-header { padding-top: 16px; }
          .amb-internal-header-flush { padding-top: 16px; }
          .amb-settings-header { padding-top: 16px; }
          .amb-dashboard-cover { margin-top: 16px; }
          .amb-setup-tracker { padding-top: 16px; }
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
        /* Toast entrance + exit. Baked-in translateX(-50%) preserves
           the horizontal centering used by every ambassador toast. */
        @keyframes amb-toast-in {
          0%   { opacity: 0; transform: translate(-50%, 20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes amb-toast-out {
          0%   { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, 20px); }
        }
        /* Slice 8: row-saved-flash. Used by Settings cards on save —
           dark → green → dark over 1.2s. Spec settings_final_UI_Spec
           §4.8 calls this keyframe "existing"; it wasn't in repo
           pre-Slice-8 (only amb-submit-flash brightness-flash existed).
           Defining canonically here so future card-save flashes reuse
           one source of truth. */
        @keyframes row-saved-flash {
          0%   { background-color: #1c1c1c; }
          30%  { background-color: #14532d; }
          100% { background-color: #1c1c1c; }
        }
      `}</style>
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto',
          minHeight: 'calc(100vh - 48px)',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}
