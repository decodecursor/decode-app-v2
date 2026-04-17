'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

export default function VerifyOTPPage() {
  const router = useRouter()
  const supabase = createClient()

  const [code, setCode] = useState<string[]>(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [phone, setPhone] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Load phone from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('ambassador_auth_phone')
    if (!stored) {
      router.replace('/model/auth')
      return
    }
    setPhone(stored)
    // Focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }, [router])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  // Auto-clear error
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 5000)
      return () => clearTimeout(t)
    }
  }, [error])

  // Clear shake
  useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 450)
      return () => clearTimeout(t)
    }
  }, [shake])

  const handleInput = useCallback((index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1)

    setCode(prev => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    setError('')

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setCode(prev => {
        const next = [...prev]
        next[index - 1] = ''
        return next
      })
    }
  }, [code])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const digits = text.split('')
    setCode(prev => {
      const next = [...prev]
      digits.forEach((d, i) => { if (i < 6) next[i] = d })
      return next
    })
    const focusIdx = Math.min(digits.length, 5)
    inputRefs.current[focusIdx]?.focus()
  }, [])

  // Submit verification
  const verify = useCallback(async (otpCode: string) => {
    if (loading || !phone) return
    setLoading(true)
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
        setLoading(false)
        if (res.status === 410 || res.status === 429) {
          // Expired/locked — clear all digits
          setCode(['', '', '', '', '', ''])
          setTimeout(() => inputRefs.current[0]?.focus(), 100)
        }
        return
      }

      // Exchange hashed_token for session
      if (data.hashed_token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'email',
        })

        if (verifyError) {
          setError('Session error. Please try again.')
          setLoading(false)
          return
        }

        await supabase.auth.refreshSession()
      }

      setSuccess(true)

      // Redirect based on profile existence
      setTimeout(() => {
        if (data.hasProfile) {
          router.replace('/model')
        } else {
          router.replace('/model/setup')
        }
      }, 500)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }, [loading, phone, supabase, router])

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    const full = code.join('')
    if (full.length === 6 && /^\d{6}$/.test(full) && !loading && !success) {
      verify(full)
    }
  }, [code, loading, success, verify])

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0 || !phone) return
    setResendCooldown(60)
    setError('')
    setCode(['', '', '', '', '', ''])

    try {
      const res = await fetch('/api/ambassador/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, turnstileToken: '' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to resend')
      }
    } catch {
      setError('Failed to resend')
    }

    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }

  // Mask phone: +971501234567 → +971 50 ****67
  const maskedPhone = phone
    ? `${phone.slice(0, 4)} ** ****${phone.slice(-2)}`
    : ''

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
      <ProgressTracker steps={['Sent', 'Enter code', 'Done']} step={2} />

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '40px', marginTop: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Enter your code
        </h1>
        <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.65, whiteSpace: 'nowrap' }}>
          We sent a code to {maskedPhone} on WhatsApp
        </p>
      </div>

      {/* Code inputs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '32px',
          animation: shake ? 'shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97)' : undefined,
        }}
        onPaste={handlePaste}
      >
        {code.map((digit, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            style={{
              width: '42px',
              height: '54px',
              textAlign: 'center',
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
              background: 'transparent',
              border: `1.5px solid ${error ? '#ef4444' : digit ? '#e91e8c' : '#262626'}`,
              borderRadius: '12px',
              outline: 'none',
              caretColor: '#e91e8c',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => {
              if (!error) e.target.style.borderColor = '#e91e8c'
            }}
            onBlur={e => {
              if (!error && !digit) e.target.style.borderColor = '#262626'
            }}
          />
        ))}
      </div>

      {/* Verify button */}
      <button
        onClick={() => {
          const full = code.join('')
          if (full.length === 6) verify(full)
        }}
        disabled={code.join('').length < 6 || loading}
        style={{
          width: '100%',
          height: '52px',
          borderRadius: '12px',
          border: 'none',
          fontSize: '14px',
          fontWeight: 600,
          cursor: code.join('').length === 6 && !loading ? 'pointer' : 'not-allowed',
          background: success ? '#34d399' : code.join('').length === 6 ? '#e91e8c' : '#1c1c1c',
          color: code.join('').length === 6 || success ? '#fff' : '#555',
          transition: 'all 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {success ? 'Verified!' : loading ? 'Verifying...' : 'Verify'}
      </button>

      {/* Error */}
      {error && (
        <p style={{
          textAlign: 'center',
          color: '#ef4444',
          fontSize: '13px',
          marginTop: '16px',
        }}>
          {error}
        </p>
      )}

      {/* Resend */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        {resendCooldown > 0 ? (
          <p style={{ color: '#555', fontSize: '13px' }}>
            Resend in {resendCooldown}s
          </p>
        ) : (
          <button
            onClick={handleResend}
            style={{
              background: 'none',
              border: 'none',
              color: '#e91e8c',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Resend code
          </button>
        )}
      </div>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}

