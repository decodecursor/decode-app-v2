'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { COUNTRY_CODES, type CountryCode } from '@/lib/country-codes'
import { formatPhoneNumber } from '@/lib/ambassador/phone-format'
import { CountryPicker } from '@/components/ambassador/CountryPicker'
import { OtpInput, type OtpInputHandle } from '@/components/ambassador/OtpInput'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'
import { AmbSubmitButton } from '@/components/ambassador/AmbSubmitButton'

type Step = 1 | 2 | 3

const EMPTY_CODE: string[] = ['', '', '', '', '', '']

export function AddWhatsAppModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (phoneE164: string) => void
}) {
  const [step, setStep] = useState<Step>(1)

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    () => COUNTRY_CODES.find(c => c.id === 'AE')!,
  )
  const [phone, setPhone] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const [code, setCode] = useState<string[]>(EMPTY_CODE)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const [addedPhone, setAddedPhone] = useState('')

  const otpRef = useRef<OtpInputHandle | null>(null)
  const phoneInputRef = useRef<HTMLInputElement | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState('')
  const [toastKey, setToastKey] = useState(0)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setSelectedCountry(COUNTRY_CODES.find(c => c.id === 'AE')!)
    setPhone('')
    setShowPicker(false)
    setCode(EMPTY_CODE)
    setVerifying(false)
    setError('')
    setShake(false)
    setResendCooldown(0)
    setAddedPhone('')
  }, [open])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  useEffect(() => {
    if (!shake) return
    const t = setTimeout(() => setShake(false), 450)
    return () => clearTimeout(t)
  }, [shake])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 5200)
  }

  const rawDigits = phone.replace(/\D/g, '')
  const e164 = `${selectedCountry.code}${rawDigits}`
  const canSend = rawDigits.length >= 7

  const selectCountry = (c: CountryCode) => {
    setSelectedCountry(c)
    setPhone('')
    setShowPicker(false)
    setTimeout(() => phoneInputRef.current?.focus(), 50)
  }

  const sendOtp = async (phoneE164: string) => {
    const res = await fetch('/api/ambassador/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneE164, turnstileToken: '' }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error as string | undefined }
  }

  const handleSendCode = async () => {
    if (!canSend) throw new Error('invalid phone')
    const { ok, error: err } = await sendOtp(e164)
    if (!ok) {
      showToast(err || 'Failed to send code')
      throw new Error(err || 'send failed')
    }
  }

  const verifyCode = useCallback(
    async (fullCode: string) => {
      if (verifying) return
      setVerifying(true)
      setError('')
      try {
        const res = await fetch('/api/ambassador/auth/add-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: e164, otpCode: fullCode }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data?.error || 'Verification failed')
          setShake(true)
          setTimeout(() => {
            setCode(EMPTY_CODE)
            otpRef.current?.focusFirst()
          }, 500)
          setVerifying(false)
          return
        }
        setAddedPhone(data.phone || e164)
        setStep(3)
      } catch {
        setError('Network error. Please try again.')
        setVerifying(false)
      }
    },
    [verifying, e164],
  )

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    const { ok, error: err } = await sendOtp(e164)
    if (!ok) {
      showToast(err || 'Failed to resend')
      return
    }
    setCode(EMPTY_CODE)
    setError('')
    setResendCooldown(60)
    otpRef.current?.focusFirst()
  }

  const handleBack = () => {
    setStep(1)
    setCode(EMPTY_CODE)
    setError('')
  }

  const handleDone = () => {
    onAdded(addedPhone)
    onClose()
  }

  if (!open) return null

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
          maxWidth: 420,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
          position: 'relative',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />

        {step === 1 && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
              Add WhatsApp
            </div>
            <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              Add WhatsApp for faster access.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div
                onClick={() => setShowPicker(true)}
                style={{
                  width: 108,
                  background: '#111',
                  borderRadius: 10,
                  padding: '14px 12px',
                  flexShrink: 0,
                  border: '1px solid #333',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{selectedCountry.flag}</span>
                <span style={{ fontSize: 14, color: '#fff', flex: 1, textAlign: 'center' }}>
                  {selectedCountry.code}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div
                style={{
                  flex: 1,
                  background: '#111',
                  borderRadius: 10,
                  padding: '14px 16px',
                  border: '1px solid #333',
                  minWidth: 0,
                }}
              >
                <input
                  ref={phoneInputRef}
                  type="tel"
                  autoFocus
                  placeholder={selectedCountry.placeholder}
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    setPhone(formatPhoneNumber(digits, selectedCountry.code))
                  }}
                  onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendCode().then(() => setStep(2)).catch(() => {})
                  }
                }}
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
            </div>

            <div style={{ marginBottom: 10 }}>
              <AmbSubmitButton
                verb="send"
                variant="solid"
                idleLabel="Send code via WhatsApp"
                disabled={!canSend}
                onSubmit={handleSendCode}
                onDone={() => setStep(2)}
              />
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
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
              Enter code
            </div>
            <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              We sent a 6-digit code to{' '}
              <span style={{ color: '#fff', fontWeight: 500 }}>{e164}</span>
            </div>

            <ProgressTracker
              steps={['Send', 'Enter code', 'Done']}
              step={2}
              marginBottom={22}
            />

            <OtpInput
              ref={otpRef}
              value={code}
              onChange={(next) => { setCode(next); if (error) setError('') }}
              onComplete={(full) => verifyCode(full)}
              error={!!error}
              shake={shake}
            />

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
                onClick={handleResendOtp}
                style={{
                  color: '#e91e8c',
                  fontWeight: 600,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  opacity: resendCooldown > 0 ? 0.5 : 1,
                  display: 'inline-block',
                  minWidth: 44,
                }}
              >
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend code'}
              </span>
            </div>

            {error && !shake && (
              <div style={{ color: '#ef4444', fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <div
                onClick={handleBack}
                style={{
                  flex: 1,
                  background: '#262626',
                  borderRadius: 12,
                  padding: 14,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#fff',
                  userSelect: 'none',
                }}
              >
                Back
              </div>
              <div
                onClick={onClose}
                style={{
                  flex: 1,
                  background: '#262626',
                  borderRadius: 12,
                  padding: 14,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#fff',
                  userSelect: 'none',
                }}
              >
                Cancel
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              textAlign: 'center',
              letterSpacing: '-0.2px',
              marginBottom: 32,
              color: '#fff',
            }}>
              WhatsApp added!
            </div>

            <ProgressTracker
              steps={['Send', 'Enter code', 'Done']}
              step={4}
              marginBottom={22}
            />

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <div
                style={{
                  width: 200,
                  background: '#1c1c1c',
                  border: '1px solid #e91e8c',
                  borderRadius: 12,
                  padding: '14px 12px',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontSize: 9,
                  color: '#e91e8c',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 6,
                  fontWeight: 600,
                }}>
                  Added
                </div>
                <div style={{
                  fontSize: 13,
                  color: '#fff',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {formatAddedPhone(addedPhone, selectedCountry.code)}
                </div>
              </div>
            </div>

            <div
              onClick={handleDone}
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
              Done
            </div>
          </>
        )}

        {toast && (
          <div
            key={toastKey}
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
              animation:
                'amb-toast-in 1200ms cubic-bezier(.2,.7,.2,1) forwards, ' +
                'amb-toast-out 1200ms cubic-bezier(.5,.2,.8,.1) 4000ms forwards',
            }}
          >
            {toast}
          </div>
        )}
      </div>

      <CountryPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={selectCountry}
      />

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

function formatAddedPhone(e164: string, dialCode: string): string {
  if (!e164.startsWith(dialCode)) return e164
  const local = e164.slice(dialCode.length)
  return `${dialCode} ${formatPhoneNumber(local, dialCode)}`
}
