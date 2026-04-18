'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

type ResendPhase = 'idle' | 'sent' | 'cooldown'

function MagicLinkSentInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<ResendPhase>('idle')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const fromQuery = searchParams.get('email') || ''
    const stored = typeof window !== 'undefined'
      ? sessionStorage.getItem('ambassador_auth_email') || ''
      : ''
    const resolved = fromQuery || stored
    if (!resolved) {
      router.replace('/model/auth')
      return
    }
    setEmail(resolved)
  }, [router, searchParams])

  useEffect(() => {
    if (phase !== 'cooldown') return
    if (cooldown <= 0) {
      setPhase('idle')
      return
    }
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, cooldown])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 5000)
    return () => clearTimeout(t)
  }, [error])

  const handleResend = useCallback(async () => {
    if (phase !== 'idle' || !email) return
    try {
      const res = await fetch('/api/ambassador/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken: '' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to resend')
        return
      }
      setPhase('sent')
      setTimeout(() => {
        setPhase('cooldown')
        setCooldown(60)
      }, 2000)
    } catch {
      setError('Network error')
    }
  }, [phase, email])

  const resendLabel =
    phase === 'sent'
      ? 'Sent!'
      : phase === 'cooldown'
      ? `Resend (${cooldown}s)`
      : 'Resend'

  const resendColor = phase === 'sent' ? '#4ade80' : '#e91e8c'
  const resendOpacity = phase === 'cooldown' ? 0.5 : 1
  const resendCursor = phase === 'idle' ? 'pointer' : 'not-allowed'

  return (
    <div style={{ padding: '60px 22px 20px', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 9,
          letterSpacing: '-0.2px',
          color: '#fff',
        }}
      >
        Check your email
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#888',
          lineHeight: 1.6,
          maxWidth: 260,
          margin: '0 auto 42px',
        }}
      >
        We sent a magic link to{' '}
        <span style={{ color: '#fff', fontWeight: 600 }}>{email}</span>
      </div>

      <ProgressTracker
        steps={['Sent', 'Open email', 'Done']}
        step={2}
        marginBottom={40}
      />

      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
        Your magic link expires in 10 minutes
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#888',
          lineHeight: '18px',
          height: 18,
        }}
      >
        Didn't receive it?{' '}
        <span
          onClick={handleResend}
          style={{
            color: resendColor,
            fontWeight: 600,
            cursor: resendCursor,
            opacity: resendOpacity,
            transition: 'color 0.2s, opacity 0.2s',
            display: 'inline-block',
            minWidth: 44,
            textAlign: 'center',
            verticalAlign: 'baseline',
            lineHeight: '18px',
            height: 18,
          }}
        >
          {resendLabel}
        </span>
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 11, marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default function MagicLinkSentPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkSentInner />
    </Suspense>
  )
}
