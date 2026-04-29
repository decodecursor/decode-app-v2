'use client'

import { useCountUp } from '@/components/ambassador/useCountUp'
import { CurrencyAmount } from '@/components/ambassador/CurrencyAmount'
import type { StatementResponse } from '../types'

/**
 * Statement hero card. Mirrors mockup payout_statement_final.html
 * lines 57-95 — #1c1c1c bg / 14px radius / 20px padding.
 *
 * Top row (60-63): "Payout" 11px #666 LEFT + status hero badge RIGHT
 * (background color carries the status: paid #34d399 / pending +
 * processing #f59e0b / failed #ef4444 — text color black for the
 * three light bgs, white for failed bg). Decision α override: failed
 * = #ef4444 red, NOT pink (fintech convention; Stripe / Wise / Revolut
 * pattern).
 *
 * Amount + currency row (65-68): 28px/700/-0.3px + 11px/600 #666
 * letterSpacing 0.8px (USD inline).
 *
 * Meta row (70-77): 10px #777 flex align-center gap 5px — date span +
 * middle-dot separator (#555 14px line-height 1) + reference copy
 * button. Copy interaction (CSS lines 23-36 + script 228-263):
 * "Copied!" label appears BELOW the button at top:calc(100% + 4px),
 * centered with translateX(-50%), 10px/600 #34d399, opacity 0→1 over
 * 0.15s, hides after 1500ms.
 *
 * Stats row (79-92): border-top 0.5px #272727, padding-top 14px,
 * margin-top 16px, flex gap 20px — listings count 15px/700 + label
 * 9px #666 letterSpacing 0.3px, wishes count + label, bank name
 * 10px #999 + bank last4 10px #666 (margin-left auto, text-align
 * right).
 *
 * useCountUp on amount per decision β (mount-only, 1000ms ease-out
 * cubic).
 */
export default function HeroCard({ data, copied, onCopy }: {
  data: StatementResponse
  copied: boolean
  onCopy: () => void
}) {
  const animatedAmount = useCountUp(data.amount_formatted)
  return (
    <div style={{ padding: '0 20px 16px' }}>
      <div style={{ background: '#1c1c1c', borderRadius: '14px', padding: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '11px', color: '#666' }}>Payout</div>
          <div style={{
            background: data.hero_badge.bg,
            color: data.hero_badge.fg,
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.3px',
          }}>
            {data.hero_badge.label}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.3px', color: '#fff' }}>
            {animatedAmount}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', letterSpacing: '0.8px' }}>
            <CurrencyAmount currency={data.currency} variant="code-only" />
          </div>
        </div>

        <div style={{
          fontSize: '10px',
          color: '#777',
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          <span>{data.date_pretty}</span>
          <span style={{ color: '#555', fontSize: '14px', lineHeight: 1 }}>•</span>
          <span
            className="pd-copybtn"
            onClick={onCopy}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCopy() }}
            role="button"
            tabIndex={0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '3px 6px',
              margin: '-3px -6px',
              borderRadius: '6px',
              position: 'relative',
            }}
          >
            <span>{data.payout_reference}</span>
            <span style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '10px',
              fontWeight: 600,
              color: '#34d399',
              opacity: copied ? 1 : 0,
              pointerEvents: 'none',
              transition: 'opacity 0.15s ease',
              whiteSpace: 'nowrap',
            }}>
              Copied!
            </span>
          </span>
        </div>

        <div style={{
          display: 'flex',
          gap: '20px',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '0.5px solid #272727',
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{data.listings_count}</div>
            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px', letterSpacing: '0.3px' }}>Listings</div>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{data.wishes_count}</div>
            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px', letterSpacing: '0.3px' }}>Wishes</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#999' }}>{data.bank_name}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>{data.bank_last4_formatted}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
