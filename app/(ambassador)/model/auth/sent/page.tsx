'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

export default function MagicLinkSentPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(60)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('ambassador_auth_email')
    if (!stored) {
      router.replace('/model/auth')
      return
    }
    setEmail(stored)
  }, [router])

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return
    setResendCooldown(60)
    setResendSuccess(false)
    setError('')

    try {
      const res = await fetch('/api/ambassador/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken: '' }),
      })
      if (res.ok) {
        setResendSuccess(true)
        setTimeout(() => setResendSuccess(false), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to resend')
      }
    } catch {
      setError('Network error')
    }
  }

  return (
    <div style={{ padding: '0 24px', paddingTop: '60px', paddingBottom: '40px' }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          background: 'none',
          border: 'none',
          color: '#888',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '8px',
        }}
      >
        &#8592;
      </button>

      {/* Progress tracker */}
      <ProgressTracker steps={['Sent', 'Open email', 'Done']} step={2} />

      {/* Content */}
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Check your email
        </h1>
        <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.65, marginBottom: '8px' }}>
          We sent a magic link to
        </p>
        <p style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '24px' }}>
          {email}
        </p>
        <p style={{ fontSize: '11px', color: '#555', marginBottom: '40px' }}>
          Your magic link expires in 10 minutes
        </p>

        {/* Resend */}
        {error && (
          <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
        )}

        {resendCooldown > 0 ? (
          <p style={{ color: '#555', fontSize: '13px' }}>
            Resend ({resendCooldown}s)
          </p>
        ) : (
          <button
            onClick={handleResend}
            style={{
              background: 'none',
              border: 'none',
              color: resendSuccess ? '#34d399' : '#e91e8c',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {resendSuccess ? 'Sent!' : 'Resend magic link'}
          </button>
        )}
      </div>
    </div>
  )
}

