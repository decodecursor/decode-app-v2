'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

type Step = 1 | 2

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

export function AddEmailModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [inlineError, setInlineError] = useState('')
  const [toast, setToast] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setEmail('')
    setSending(false)
    setInlineError('')
    setResendCooldown(0)
  }, [open])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }

  const sendVerification = async (normalizedEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: normalizedEmail })
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        setInlineError('This email is already in use')
      } else if (msg.includes('invalid') || msg.includes('format')) {
        setInlineError('Enter a valid email')
      } else {
        showToast('Network error. Please try again.')
      }
      return false
    }
    return true
  }

  const handleSend = async () => {
    if (sending) return
    const normalized = email.toLowerCase().trim()
    if (!isValidEmail(normalized)) {
      setInlineError('Enter a valid email')
      return
    }
    setSending(true)
    setInlineError('')
    const ok = await sendVerification(normalized)
    setSending(false)
    if (ok) setStep(2)
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    const normalized = email.toLowerCase().trim()
    const ok = await sendVerification(normalized)
    if (ok) {
      showToast('Sent!')
      setResendCooldown(60)
    }
  }

  if (!open) return null

  const isButtonActive = email.includes('@') && !sending

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: '#1c1c1c',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 500,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />

        {step === 1 ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
              Add email
            </div>
            <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              Add an email to recover your account.
            </div>

            <div
              style={{
                background: '#111',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: inlineError ? 6 : 14,
                border: `1px solid ${inlineError ? '#ef4444' : '#333'}`,
                transition: 'border-color 0.2s',
              }}
            >
              <input
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (inlineError) setInlineError('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  color: '#fff',
                  caretColor: '#e91e8c',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {inlineError && (
              <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12, paddingLeft: 4 }}>
                {inlineError}
              </div>
            )}

            <div
              onClick={isButtonActive ? handleSend : undefined}
              style={{
                background: isButtonActive ? '#e91e8c' : '#333',
                color: isButtonActive ? '#fff' : '#666',
                borderRadius: 12,
                padding: 14,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: isButtonActive ? 'pointer' : 'not-allowed',
                marginBottom: 10,
                transition: 'all 0.2s',
                userSelect: 'none',
              }}
            >
              {sending ? 'Sending…' : 'Send verification'}
            </div>
            <div
              onClick={onClose}
              style={{
                textAlign: 'center',
                fontSize: 14,
                color: '#888',
                cursor: 'pointer',
                padding: 8,
              }}
            >
              Cancel
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
              Check your email
            </div>
            <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              We sent a verification link to<br />
              <span style={{ color: '#fff', fontWeight: 600 }}>{email.toLowerCase().trim()}</span>
            </div>

            <ProgressTracker
              steps={['Sent', 'Open email', 'Done']}
              step={2}
              marginBottom={22}
            />

            <div
              style={{
                background: '#111',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 16,
                border: '1px solid #262626',
              }}
            >
              <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.6 }}>
                Click the link we just sent to finish adding your email. The link expires in 10 minutes.
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: '#888',
                textAlign: 'center',
                height: 18,
                lineHeight: '18px',
                marginBottom: 16,
              }}
            >
              Didn&apos;t receive it?{' '}
              <span
                onClick={handleResend}
                style={{
                  color: '#e91e8c',
                  fontWeight: 600,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  opacity: resendCooldown > 0 ? 0.5 : 1,
                  display: 'inline-block',
                  minWidth: 44,
                }}
              >
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
              </span>
            </div>

            <div
              onClick={onClose}
              style={{
                background: '#e91e8c',
                color: '#fff',
                borderRadius: 12,
                padding: 14,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Got it
            </div>
          </>
        )}

        {toast && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 40,
              transform: 'translateX(-50%)',
              background: 'rgba(28,28,28,0.95)',
              border: '1px solid #e91e8c',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 24,
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 1000,
              whiteSpace: 'nowrap',
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
