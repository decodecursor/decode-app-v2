'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function EmailChangedContent() {
  const searchParams = useSearchParams()
  const oldEmail = searchParams.get('old') || 'previous@email.com'
  const newEmail = searchParams.get('new') || 'new@email.com'

  return (
    <div style={{
      padding: '0 24px',
      paddingTop: '80px',
      paddingBottom: '40px',
      textAlign: 'center',
    }}>
      {/* Progress tracker — all done */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
      }}>
        {['Sent', 'Opened', 'Done'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e91e8c',
              border: '2px solid #e91e8c',
              fontSize: '10px',
              color: '#fff',
              fontWeight: 600,
            }}>
              &#10003;
            </div>
            <span style={{ fontSize: '9px', color: '#e91e8c', marginLeft: '4px', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {i < 2 && (
              <div style={{
                width: '40px',
                height: '2px',
                margin: '0 6px',
                background: '#e91e8c',
                borderRadius: '1px',
              }} />
            )}
          </div>
        ))}
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '32px' }}>
        Email changed!
      </h1>

      {/* Email comparison */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '40px',
      }}>
        <div style={{
          background: '#1c1c1c',
          border: '1px solid #262626',
          borderRadius: '12px',
          padding: '12px 16px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Old</div>
          <div style={{ fontSize: '13px', color: '#888' }}>{oldEmail}</div>
        </div>

        <span style={{ color: '#e91e8c', fontSize: '16px' }}>&rarr;</span>

        <div style={{
          background: '#1c1c1c',
          border: '1px solid #262626',
          borderRadius: '12px',
          padding: '12px 16px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '9px', color: '#e91e8c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>New</div>
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{newEmail}</div>
        </div>
      </div>

      <a
        href="/model/settings"
        style={{
          display: 'inline-block',
          background: '#e91e8c',
          color: '#fff',
          textDecoration: 'none',
          padding: '14px 32px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        Go to Settings
      </a>
    </div>
  )
}

export default function EmailChangedPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <EmailChangedContent />
    </Suspense>
  )
}
