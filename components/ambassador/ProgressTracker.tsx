'use client'

import { Fragment } from 'react'

const CheckIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="3.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CIRCLE: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
}

const RAIL_BASE: React.CSSProperties = {
  flex: 1,
  height: 1.5,
  margin: '0 2px',
}

export function ProgressTracker({
  steps,
  step,
  padding = '0 8px',
  marginBottom,
}: {
  steps: readonly string[]
  // 1..steps.length = active step; steps.length + 1 = all-done state.
  step: number
  padding?: string
  marginBottom?: number | string
}) {
  const n = steps.length
  const stepState = (i: number) =>
    i < step ? 'done' : i === step ? 'active' : 'future'

  const circles: ('done' | 'active' | 'future')[] = Array.from(
    { length: n },
    (_, i) => stepState(i + 1),
  )
  const rails: ('solid' | 'dashed')[] = Array.from(
    { length: Math.max(0, n - 1) },
    (_, i) => (circles[i] === 'done' ? 'solid' : 'dashed'),
  )

  const renderCircle = (state: 'done' | 'active' | 'future') => {
    if (state === 'done') {
      return (
        <div style={{ ...CIRCLE, background: '#e91e8c' }}>
          <CheckIcon />
        </div>
      )
    }
    if (state === 'active') {
      return (
        <div
          style={{
            ...CIRCLE,
            border: '1.5px solid #e91e8c',
            background: 'transparent',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#e91e8c',
            }}
          />
        </div>
      )
    }
    return (
      <div
        style={{
          ...CIRCLE,
          border: '1.5px solid #3a3a3a',
          background: 'transparent',
        }}
      />
    )
  }

  const renderRail = (state: 'solid' | 'dashed') =>
    state === 'solid' ? (
      <div style={{ ...RAIL_BASE, background: '#e91e8c' }} />
    ) : (
      <div
        style={{
          ...RAIL_BASE,
          backgroundImage:
            'repeating-linear-gradient(90deg,#3a3a3a 0 3px,transparent 3px 6px)',
          backgroundSize: '100% 100%',
        }}
      />
    )

  const labelStyle = (state: 'done' | 'active' | 'future'): React.CSSProperties => ({
    fontSize: 9,
    fontWeight: state === 'active' ? 700 : 600,
    color: state === 'active' ? '#e91e8c' : '#777',
    position: 'absolute',
    whiteSpace: 'nowrap',
  })

  // Grid template: N fixed 20px columns for circles, (N-1) 1fr spacers between.
  // e.g. N=3 → "20px 1fr 20px 1fr 20px"; N=4 → "20px 1fr 20px 1fr 20px 1fr 20px".
  const gridTemplateColumns = ['20px', ...Array(Math.max(0, n - 1)).fill('1fr 20px')].join(' ')

  const labelPosition = (i: number): React.CSSProperties => {
    if (i === 0) return { left: 0 }
    if (i === n - 1) return { right: 0 }
    return { left: '50%', transform: 'translateX(-50%)' }
  }

  return (
    <div style={{ padding, marginBottom }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {circles.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && renderRail(rails[i - 1])}
            {renderCircle(c)}
          </Fragment>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          marginTop: 10,
        }}
      >
        {circles.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <div />}
            <div style={{ position: 'relative' }}>
              <span style={{ ...labelStyle(c), ...labelPosition(i) }}>
                {steps[i]}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
