'use client'

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
  steps: readonly [string, string, string]
  step: 1 | 2 | 3
  padding?: string
  marginBottom?: number | string
}) {
  const stepState = (n: 1 | 2 | 3) =>
    n < step ? 'done' : n === step ? 'active' : 'future'

  const circles: ('done' | 'active' | 'future')[] = [1, 2, 3].map((n) =>
    stepState(n as 1 | 2 | 3),
  )
  const rails: ('solid' | 'dashed')[] = [
    circles[0] === 'done' ? 'solid' : 'dashed',
    circles[1] === 'done' ? 'solid' : 'dashed',
  ]

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

  return (
    <div style={{ padding, marginBottom }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {renderCircle(circles[0])}
        {renderRail(rails[0])}
        {renderCircle(circles[1])}
        {renderRail(rails[1])}
        {renderCircle(circles[2])}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '20px 1fr 20px 1fr 20px',
          marginTop: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <span style={{ ...labelStyle(circles[0]), left: 0 }}>{steps[0]}</span>
        </div>
        <div />
        <div style={{ position: 'relative' }}>
          <span
            style={{
              ...labelStyle(circles[1]),
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {steps[1]}
          </span>
        </div>
        <div />
        <div style={{ position: 'relative' }}>
          <span style={{ ...labelStyle(circles[2]), right: 0 }}>{steps[2]}</span>
        </div>
      </div>
    </div>
  )
}
