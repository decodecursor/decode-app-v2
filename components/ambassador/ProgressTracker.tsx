'use client'

export function ProgressTracker({
  steps,
  step,
}: {
  steps: readonly [string, string, string]
  step: 1 | 2 | 3
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        const accent = done || active ? '#e91e8c' : '#3a3a3a'
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 56 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done ? '#e91e8c' : 'transparent',
                border: `2px solid ${accent}`,
                fontSize: 12,
                fontWeight: 700,
                color: done ? '#fff' : active ? '#e91e8c' : '#3a3a3a',
              }}>
                {done ? '✓' : active ? (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e91e8c' }} />
                ) : ''}
              </div>
              <span style={{
                fontSize: 12,
                lineHeight: 1.3,
                color: done || active ? '#e91e8c' : '#555',
                marginTop: 6,
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 40,
                height: 2,
                background: done ? '#e91e8c' : '#3a3a3a',
                marginTop: 11,
                borderRadius: 1,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
