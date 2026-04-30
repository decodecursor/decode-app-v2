'use client'

import { useCountUp } from '@/components/ambassador/useCountUp'
import type { NextPayoutSummary } from './types'

/**
 * Next-payout card. Mirrors mockup payouts_list_final.html lines
 * 35-47: padding wrapper 0 20px 16px, inner card #1c1c1c bg / 14px
 * radius / 20px padding. Top row flex justify-between align-items
 * flex-start margin-bottom 14px: "Next payout" 11px #666 LEFT +
 * SCHEDULED badge RIGHT (#e91e8c bg / borderRadius 20px / padding
 * 4px 10px / fontSize 9px/700 / color #000 / letterSpacing 0.3px /
 * lineHeight 1 for vertical centering).
 * Amount row flex baseline gap 8px: 28px/700/-0.3px amount + 11px/
 * 600 #666 letterSpacing 0.8px currency. Date 10px #777 margin-top
 * 4px.
 *
 * useCountUp on amount per Slice 6B-1 decision β (mount-only,
 * 1000ms ease-out cubic — no swap since this page has no filter
 * tabs).
 */
export default function NextPayoutCard({ next }: { next: NextPayoutSummary }) {
  const animatedAmount = useCountUp(next.amount_formatted)
  return (
    <div style={{ padding: '0 20px 16px' }}>
      <div style={{
        background: '#1c1c1c',
        borderRadius: '14px',
        padding: '20px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '11px', color: '#666' }}>Next payout</div>
          <div style={{
            background: '#e91e8c',
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 700,
            color: '#000',
            letterSpacing: '0.3px',
            lineHeight: 1,
          }}>
            SCHEDULED
          </div>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.3px', color: '#fff' }}>
          {animatedAmount}
        </div>
        <div style={{ fontSize: '10px', color: '#777', marginTop: '4px' }}>
          {next.scheduled_for_pretty}
        </div>
      </div>
    </div>
  )
}
