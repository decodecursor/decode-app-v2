'use client'

import { useEffect, useRef } from 'react'
import type { RangeData, RangeKey } from './types'

/**
 * Breakdown split bar — own section per mockup (lines 112-123).
 * Section padding 18px 0 + border-bottom 1px #1f1f1f. Split bar is
 * 4px height, 2px radius, #262626 unfilled bg, with pink + mint
 * segments that grow from width 0 to target% over 1500ms
 * cubic-bezier(.2,.7,.2,1) (CSS lines 14-17). Legend below has a
 * 6px circle + label + amount per side, justify-content
 * space-between.
 */
export default function BreakdownSection({ data, range }: { data: RangeData; range: RangeKey }) {
  const pinkRef = useRef<HTMLDivElement | null>(null)
  const mintRef = useRef<HTMLDivElement | null>(null)
  const { listings_pct, wishes_pct, listings_formatted, wishes_formatted } = data.breakdown

  // Re-animate from 0 → target on every range change. Mirrors mockup
  // applyDataset() pattern (lines 720-721, 753-754).
  useEffect(() => {
    const pink = pinkRef.current
    const mint = mintRef.current
    if (!pink || !mint) return
    pink.style.width = '0'
    mint.style.width = '0'
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pink.style.width = `${listings_pct}%`
        mint.style.width = `${wishes_pct}%`
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [range, listings_pct, wishes_pct])

  return (
    <div style={{ padding: '18px 0', borderBottom: '1px solid #1f1f1f' }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', textAlign: 'left' }}>Breakdown</div>
      <div style={{
        display: 'flex',
        height: '4px',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '4px',
        background: '#262626',
      }}>
        <div ref={pinkRef} className="an-split-pink" />
        <div ref={mintRef} className="an-split-mint" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#e91e8c', marginRight: '6px', verticalAlign: 'middle' }} />
          <span style={{ fontSize: '11px', color: '#777' }}>Listings</span>{' '}
          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{listings_formatted}</span>
        </div>
        <div>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', marginRight: '6px', verticalAlign: 'middle' }} />
          <span style={{ fontSize: '11px', color: '#777' }}>Gifts</span>{' '}
          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{wishes_formatted}</span>
        </div>
      </div>
    </div>
  )
}
