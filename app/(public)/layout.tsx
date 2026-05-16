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
      {/* Trust Stack — SquadRow WhatsApp-badge pulse keyframe + the
          Pro Info modal's per-element hover/active rules (inline styles
          can't express :hover/:active). Modal slide/backdrop keyframes
          removed when ProInfoModal moved to vaul (vaul owns open/close
          + drag animations). */}
      <style>{`
        @keyframes decode-pulse {
          0%   { transform: scale(0.85); opacity: 0.6; }
          70%  { transform: scale(1.4);  opacity: 0;   }
          100% { transform: scale(1.4);  opacity: 0;   }
        }
        .decode-modal__d-fill {
          transition: width 1500ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        .decode-modal__quick-btn:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .decode-modal__quick-btn:active {
          filter: brightness(0.95);
        }
        .decode-modal__btn-primary:hover {
          filter: brightness(1.08);
        }
        .decode-modal__btn-primary:active {
          filter: brightness(0.95);
        }
        .decode-modal__btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .decode-modal__cancel:hover {
          color: #ddd;
        }
        .decode-modal__cancel:active {
          color: #aaa;
        }
        @media (prefers-reduced-motion: reduce) {
          .decode-modal__d-fill {
            transition: none;
          }
        }
      `}</style>
      {children}
    </main>
  )
}
