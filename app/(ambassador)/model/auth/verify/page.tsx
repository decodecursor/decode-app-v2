'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'
import { OtpInput, type OtpInputHandle } from '@/components/ambassador/OtpInput'
import { AmbSubmitButton } from '@/components/ambassador/AmbSubmitButton'

type ResendPhase = 'idle' | 'sent' | 'cooldown'

const EMPTY_CODE: string[] = ['', '', '', '', '', '']

export default function VerifyOTPPage() {
  const router = useRouter()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState<string[]>(EMPTY_CODE)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [trackerStep, setTrackerStep] = useState<1 | 2 | 3>(2)
  const [toast, setToast] = useState('')
  const [triggerKey, setTriggerKey] = useState(0)

  const [resendPhase, setResendPhase] = useState<ResendPhase>('idle')
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpRef = useRef<OtpInputHandle | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('ambassador_auth_phone')
    if (!stored) {
      router.replace('/model/auth')
      return
    }
    setPhone(stored)
  }, [router])

  useEffect(() => {
    if (resendPhase !== 'cooldown') return
    if (resendCooldown <= 0) {
      setResendPhase('idle')
      return
    }
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendPhase, resendCooldown])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 5000)
    return () => clearTimeout(t)
  }, [error])

  useEffect(() => {
    if (!shake) return
    const t = setTimeout(() => setShake(false), 450)
    return () => clearTimeout(t)
  }, [shake])

  const allFilled = code.every((d) => d.length === 1)

  const handleCodeChange = useCallback((next: string[]) => {
    setCode(next)
    setError('')
  }, [])

  const callbackUrlRef = useRef<string | null>(null)

  const verify = useCallback(async () => {
    if (!phone) throw new Error('no phone')
    const otpCode = code.join('')
    setError('')

    let res: Response
    try {
      res = await fetch('/api/ambassador/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, otpCode }),
      })
    } catch {
      setError('Network error. Please try again.')
      throw new Error('network')
    }
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Verification failed')
      setShake(true)
      if (res.status === 410 || res.status === 429) {
        setCode(EMPTY_CODE)
        setTimeout(() => otpRef.current?.focusFirst(), 100)
      } else {
        setTimeout(() => {
          setCode(EMPTY_CODE)
          otpRef.current?.focusFirst()
        }, 500)
      }
      throw new Error(data.error || 'verify failed')
    }

    if (!data.hashed_token) {
      console.error('[Ambassador Verify] No token_hash in response')
      setError('Session error. Please try again.')
      throw new Error('no token')
    }

    console.log('[Ambassador Verify] Token received, handing off to server callback for session mint')

    setTrackerStep(3)
    // Server-side callback performs verifyOtp with the SSR cookie adapter,
    // which writes session cookies to the response with the correct flags
    // (sameSite:'lax', secure, path:'/'). Full-page navigation (not
    // router.replace) ensures the callback GET runs and its Set-Cookie
    // headers are applied before /model/setup or /model render.
    callbackUrlRef.current = `/model/auth/callback?token_hash=${encodeURIComponent(
      data.hashed_token,
    )}&type=magiclink`
  }, [phone, code])

  const handleVerifyDone = useCallback(() => {
    const url = callbackUrlRef.current
    if (!url) return
    setToast('Signed in · redirecting…')
    setTimeout(() => {
      window.location.href = url
    }, 500)
  }, [])

  useEffect(() => {
    if (allFilled) setTriggerKey((k) => k + 1)
  }, [allFilled])

  const handleResend = useCallback(async () => {
    if (resendPhase !== 'idle' || !phone) return
    try {
      const res = await fetch('/api/ambassador/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, turnstileToken: '' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to resend')
        return
      }
      setResendPhase('sent')
      setCode(EMPTY_CODE)
      setTimeout(() => {
        setResendPhase('cooldown')
        setResendCooldown(60)
        otpRef.current?.focusFirst()
      }, 2000)
    } catch {
      setError('Network error')
    }
  }, [resendPhase, phone])

  const resendLabel =
    resendPhase === 'sent'
      ? 'Sent!'
      : resendPhase === 'cooldown'
      ? `Resend (${resendCooldown}s)`
      : 'Resend'

  const resendColor = resendPhase === 'sent' ? '#4ade80' : '#e91e8c'
  const resendOpacity = resendPhase === 'cooldown' ? 0.5 : 1
  const resendCursor = resendPhase === 'idle' ? 'pointer' : 'not-allowed'

  return (
    <div style={{ padding: '60px 22px 20px', textAlign: 'center', position: 'relative' }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 9,
          letterSpacing: '-0.2px',
          color: '#fff',
        }}
      >
        Enter your code
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#888',
          lineHeight: 1.6,
          maxWidth: 280,
          margin: '0 auto 36px',
        }}
      >
        We sent a code to{' '}
        <span style={{ color: '#fff', fontWeight: 600 }}>{phone}</span> on WhatsApp
      </div>

      <OtpInput
        ref={otpRef}
        value={code}
        onChange={handleCodeChange}
        error={!!error}
        shake={shake}
      />

      <div style={{ marginBottom: 28 }}>
        <AmbSubmitButton
          verb="verify"
          variant="solid"
          idleLabel="Verify"
          disabled={!allFilled}
          onSubmit={verify}
          onDone={handleVerifyDone}
          triggerKey={triggerKey}
          style={{
            padding: 15,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.2px',
          }}
        />
      </div>

      <ProgressTracker
        steps={['Sent', 'Enter code', 'Done']}
        step={trackerStep}
        marginBottom={36}
      />

      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
        Your code expires in 10 minutes
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

      {error && !shake && (
        <div style={{ color: '#ef4444', fontSize: 11, marginTop: 12 }}>
          {error}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 40,
            transform: 'translateX(-50%)',
            background: 'rgba(28,28,28,0.95)',
            border: '1px solid #333',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 24,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes ambassador-shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
