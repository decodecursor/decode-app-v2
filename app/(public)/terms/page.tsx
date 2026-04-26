import type { Metadata } from 'next'
import { Suspense } from 'react'
import TermsBackArrow from './TermsBackArrow'
import TermsTabs from './TermsTabs'
import GeneralSection from './sections/General'
import ScheduleASection from './sections/ScheduleA'
import ScheduleBSection from './sections/ScheduleB'
import ScheduleCSection from './sections/ScheduleC'

/**
 * Terms of Service — public, SEO-indexable. Tabbed single-page covering
 * General Terms + Schedule A (Beauty Pay) + Schedule B (Beauty Deals
 * Business) + Schedule C (Beauty Deals Client). Deep-linkable via
 * `#a/#b/#c` or `?tab=a|b|c`.
 *
 * Source of truth for the legal text: `_features/ambassador/terms_final.html`
 * (locked Slice 7A pre-flight Q7). State doc PHASE 10 references
 * `terms_upload.docx` as a separate canonical — the V1-launch gate is
 * partner-counsel reconciliation between mockup HTML and any signed-off
 * .docx (NOT a 7A blocker; flagged in 7A closeout doc).
 *
 * Decomposed upfront per G12 §8 file-size planning (~500 LOC of
 * content-equivalent split across 4 schedule files + tabs client +
 * back arrow client + this page server).
 *
 * All four sections render at all times in the DOM (display:none/block
 * toggle inside TermsTabs) so crawlers, screen readers, and ctrl-F
 * navigate every schedule. Per terms_final_UI_Spec.md §4.
 */

export const metadata: Metadata = {
  title: 'Terms of Service — DECODE',
  description:
    'DECODE Terms of Service — General Terms, Beauty Pay (Schedule A), Beauty Deals Business Partner (Schedule B), Beauty Deals Client (Schedule C).',
}

function TermsTabsFallback() {
  // Pre-hydration render: the server has no access to window.location,
  // so render General by default. TermsTabs swaps post-mount if the
  // URL hash/query param points elsewhere.
  return (
    <div className="tp-body">
      <section id="sec-general" className="tp-section active">
        <GeneralSection />
      </section>
    </div>
  )
}

export default function TermsPage() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 500,
      margin: '0 auto',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        .tp-tabs {
          display: flex; gap: 18px; padding: 0 22px 18px;
          overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;
          border-bottom: 1px solid #1f1f1f; margin-bottom: 4px;
        }
        .tp-tabs::-webkit-scrollbar { display: none }
        .tp-tab {
          flex-shrink: 0; padding: 6px 0 8px; margin-bottom: -1px;
          background: transparent; border: none; border-bottom: 1.5px solid transparent;
          font-size: 13px; font-weight: 600; color: #777;
          cursor: pointer; white-space: nowrap; font-family: inherit;
          transition: color 0.15s, border-color 0.15s;
        }
        .tp-tab:hover { color: #aaa }
        .tp-tab.active { color: #fff; border-bottom-color: #e91e8c }

        .tp-body { padding: 8px 22px 30px; font-size: 13px; color: #ccc; line-height: 1.65 }
        .tp-intro { color: #aaa; margin-bottom: 20px }
        .tp-body h2 { color: #fff; font-size: 13px; font-weight: 600; margin: 22px 0 8px; letter-spacing: 0.1px }
        .tp-body h2:first-child { margin-top: 0 }
        .tp-body h3 { color: #fff; font-size: 12px; font-weight: 600; margin: 14px 0 6px; letter-spacing: 0.1px }
        .tp-body p { margin: 0 0 12px }
        .tp-body ul { margin: 0 0 12px; padding-left: 20px }
        .tp-body li { margin-bottom: 6px }
        .tp-body a { color: #e91e8c; text-decoration: none }
        .tp-body a:hover { text-decoration: underline }
        .tp-body a[href^="mailto:"] { color: #ccc }
        .tp-body a[href^="mailto:"]:hover { color: #fff; text-decoration: underline }
        .tp-body strong { color: #fff; font-weight: 600 }

        .tp-table-wrap { margin: 0 0 14px; border-radius: 8px; overflow: hidden; border: 1px solid #1f1f1f }
        .tp-table { width: 100%; border-collapse: collapse; font-size: 12px }
        .tp-table th, .tp-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #1f1f1f }
        .tp-table tr:last-child td { border-bottom: none }
        .tp-table th { background: #1c1c1c; color: #fff; font-weight: 600; font-size: 11px; letter-spacing: 0.2px; text-transform: uppercase }
        .tp-table td { color: #ccc }
        .tp-table tr.tot td { background: #161616; color: #fff; font-weight: 600 }

        .tp-sched-head { margin: 0 0 18px; padding: 0 }
        .tp-sched-badge {
          display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.1px;
          color: #e91e8c; margin-bottom: 6px;
        }
        .tp-sched-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 10px; letter-spacing: -0.1px }
        .tp-sched-sub { font-size: 13px; color: #ccc; line-height: 1.65 }
      `}</style>

      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TermsBackArrow />
      </div>

      <div style={{ padding: '8px 22px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 6 }}>
          Terms of Service
        </div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Effective: upon account registration or first purchase</div>
        <div style={{ fontSize: 9, color: '#666' }}>Last updated: March 2026</div>
      </div>

      <Suspense fallback={<TermsTabsFallback />}>
        <TermsTabs
          sections={{
            general: <GeneralSection />,
            a: <ScheduleASection />,
            b: <ScheduleBSection />,
            c: <ScheduleCSection />,
          }}
        />
      </Suspense>
    </div>
  )
}
