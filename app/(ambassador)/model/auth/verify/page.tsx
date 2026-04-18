'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

type VerifyPhase = 'idle' | 'ready' | 'verifying' | 'success'
type ResendPhase = 'idle' | 'sent' | 'cooldown'

export default function VerifyOTPPage() {
  const router = useRouter()
  const supabase = createClient()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState<string[]>(['', '', '', '', '', ''])
  const [phase, setPhase] = useState<VerifyPhase>('idle')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [trackerStep, setTrackerStep] = useState<1 | 2 | 3>(2)
  const [toast, setToast] = useState('')

  const [resendPhase, setResendPhase] = useState<ResendPhase>('idle')
  const [resendCooldown, setResendCooldown] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const stored = sessionStorage.getItem('ambassador_auth_phone')
    if (!stored) {
      router.replace('/model/auth')
      return
    }
    setPhone(stored)
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
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

  useEffect(() => {
    if (phase === 'verifying' || phase === 'success') return
    setPhase(allFilled ? 'ready' : 'idle')
  }, [allFilled, phase])

  const handleInput = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    setCode((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    setError('')
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        setCode((prev) => {
          const next = [...prev]
          next[index - 1] = ''
          return next
        })
      }
    },
    [code],
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const digits = text.split('')
    setCode((prev) => {
      const next = [...prev]
      digits.forEach((d, i) => {
        if (i < 6) next[i] = d
      })
      return next
    })
    const focusIdx = Math.min(digits.length, 5)
    inputRefs.current[focusIdx]?.focus()
  }, [])

  const verify = useCallback(async () => {
    if (phase !== 'ready' || !phone) return
    const otpCode = code.join('')
    setPhase('verifying')
    setError('')

    try {
      const res = await fetch('/api/ambassador/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, otpCode }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed')
        setShake(true)
        if (res.status === 410 || res.status === 429) {
          setCode(['', '', '', '', '', ''])
          setTimeout(() => inputRefs.current[0]?.focus(), 100)
        } else {
          setTimeout(() => {
            setCode(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
          }, 500)
        }
        setPhase('idle')
        return
      }

      if (data.hashed_token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'email',
        })
        if (verifyError) {
          setError('Session error. Please try again.')
          setPhase('idle')
          return
        }
        await supabase.auth.refreshSession()
      }

      setPhase('success')
      setTrackerStep(3)

      setTimeout(() => {
        setToast('Signed in · redirecting…')
        setTimeout(() => {
          if (data.hasProfile) router.replace('/model')
          else router.replace('/model/setup')
        }, 500)
      }, 450)
    } catch {
      setError('Network error. Please try again.')
      setPhase('idle')
    }
  }, [phase, phone, code, supabase, router])

  useEffect(() => {
    if (phase === 'ready' && allFilled) verify()
  }, [phase, allFilled, verify])

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
      setCode(['', '', '', '', '', ''])
      setTimeout(() => {
        setResendPhase('cooldown')
        setResendCooldown(60)
        inputRefs.current[0]?.focus()
      }, 2000)
    } catch {
      setError('Network error')
    }
  }, [resendPhase, phone])

  const verifyLabel =
    phase === 'success'
      ? 'Verified!'
      : phase === 'verifying'
      ? 'Verifying…'
      : 'Verify'

  const verifyActive =
    phase === 'ready' || phase === 'verifying' || phase === 'success'

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

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          marginBottom: 24,
          animation: shake
            ? 'ambassador-shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97)'
            : undefined,
        }}
        onPaste={handlePaste}
      >
        {code.map((digit, i) => {
          const isError = !!error && shake
          const borderColor = isError
            ? '#ef4444'
            : digit
            ? '#e91e8c'
            : '#262626'
          return (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => {
                if (!isError) e.target.style.borderColor = '#e91e8c'
              }}
              onBlur={(e) => {
                if (!isError && !digit) e.target.style.borderColor = '#262626'
              }}
              style={{
                width: 42,
                height: 54,
                background: 'transparent',
                border: `1.5px solid ${borderColor}`,
                borderRadius: 10,
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
                textAlign: 'center',
                caretColor: '#e91e8c',
                transition: 'border-color 0.15s',
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          )
        })}
      </div>

      <div
        onClick={verify}
        style={{
          background: verifyActive ? '#e91e8c' : '#1c1c1c',
          border: `1px solid ${verifyActive ? '#e91e8c' : '#262626'}`,
          borderRadius: 12,
          padding: 15,
          fontSize: 15,
          fontWeight: 700,
          color: verifyActive ? '#fff' : '#555',
          cursor: phase === 'ready' ? 'pointer' : 'not-allowed',
          marginBottom: 28,
          letterSpacing: '0.2px',
          transition: 'all 0.2s',
          userSelect: 'none',
        }}
      >
        {verifyLabel}
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
