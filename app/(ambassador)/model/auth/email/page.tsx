'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AmbSubmitButton } from '@/components/ambassador/AmbSubmitButton'
import { useTurnstile } from '@/components/turnstile/TurnstileWidget'

type ToastState = { msg: string; success: boolean; id: number }

function isValidEmail(email: string): boolean {
  const e = email.trim()
  if (e.length < 5) return false
  const at = e.indexOf('@')
  if (at < 1) return false
  const dot = e.lastIndexOf('.')
  if (dot < at + 2) return false
  if (dot === e.length - 1) return false
  return true
}

export default function AmbassadorAuthEmailPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const {
    token: turnstileToken,
    reset: resetTurnstile,
    containerRef: turnstileContainerRef,
  } = useTurnstile({
    size: 'compact',
    appearance: 'interaction-only',
    refreshExpired: 'auto',
  })

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const showToast = useCallback((msg: string, success = false) => {
    const id = Date.now()
    setToast({ msg, success, id })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => (prev && prev.id === id ? null : prev))
    }, 5200)
  }, [])

  const isButtonActive = email.length > 0 && email.includes('@')

  const handleSendMagicLink = async () => {
    if (!isButtonActive || !isValidEmail(email)) {
      showToast('Enter a valid email', false)
      throw new Error('invalid email')
    }
    const normalized = email.toLowerCase().trim()
    let res: Response
    try {
      res = await fetch('/api/ambassador/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, turnstileToken }),
      })
    } catch (err) {
      console.error('[auth-email] magic link send failed:', err)
      showToast('Network error. Please try again.', false)
      resetTurnstile()
      throw err
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data.error || 'Failed to send link', false)
      resetTurnstile()
      throw new Error(data.error || 'send failed')
    }
    sessionStorage.setItem('ambassador_auth_email', normalized)
    resetTurnstile()
  }

  return (
    <div style={{ position: 'relative', minHeight: '760px' }}>
      <div style={{ padding: '126px 40px 24px', textAlign: 'center' }}>
        <div style={{
          fontSize: '10px',
          letterSpacing: '3px',
          color: '#888',
          fontWeight: 700,
          marginBottom: '10px',
        }}>
          SHOW YOUR BEAUTY SQUAD
        </div>
        <div style={{
          fontSize: '32px',
          fontWeight: 800,
          letterSpacing: '-0.8px',
          marginBottom: '48px',
        }}>
          WeLoveDecode
        </div>
        <div style={{
          width: '40px',
          height: '1.5px',
          background: '#e91e8c',
          margin: '0 auto 48px',
          transformOrigin: 'center',
          animation: 'drawLine 1s ease-out forwards',
        }} />

        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onFocus={e => (e.currentTarget.style.borderColor = '#e91e8c')}
          onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1.5px solid #2a2a2a',
            borderRadius: '12px',
            padding: '0 16px',
            fontSize: '16px',
            color: '#fff',
            outline: 'none',
            fontFamily: 'inherit',
            height: '52px',
            boxSizing: 'border-box',
            marginBottom: '12px',
            transition: 'border-color 0.2s',
          }}
        />

        <AmbSubmitButton
          verb="send"
          variant="outline"
          idleLabel="Continue with Email"
          disabled={!isButtonActive}
          onSubmit={handleSendMagicLink}
          onDone={() => {
            const normalized = email.toLowerCase().trim()
            router.push(`/model/auth/sent?email=${encodeURIComponent(normalized)}`)
          }}
        />
      </div>

      {/* WhatsApp fallback link */}
      <div className="amb-auth-fallback-link">
        <Link href="/model/auth" style={{ textDecoration: 'none', color: '#888' }}>
          <span style={{ color: '#e91e8c', fontWeight: 600 }}>← Use WhatsApp</span> instead
        </Link>
      </div>

      {/* Legal footer */}
      <div className="amb-auth-legal-footer">
        By continuing, you agree to our{' '}
        <Link
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ cursor: 'pointer', fontWeight: 700, color: '#555', textDecoration: 'none' }}
        >Terms</Link>{' '}
        and{' '}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ cursor: 'pointer', fontWeight: 700, color: '#555', textDecoration: 'none' }}
        >Privacy Policy</Link>
      </div>

      {toast && (
        <div
          key={toast.id}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '60px',
            transform: 'translateX(-50%)',
            background: 'rgba(28,28,28,0.95)',
            border: `1px solid ${toast.success ? '#e91e8c' : '#333'}`,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '24px',
            fontSize: '12px',
            zIndex: 20,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation:
              'amb-toast-in 1200ms cubic-bezier(.2,.7,.2,1) forwards, ' +
              'amb-toast-out 1200ms cubic-bezier(.5,.2,.8,.1) 4000ms forwards',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div ref={turnstileContainerRef} style={{ display: 'none' }} />

      <style>{`
        @keyframes drawLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        input::placeholder { color: #555; opacity: 1; }
        input::-webkit-input-placeholder { color: #555; }
      `}</style>
    </div>
  )
}
