'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { COUNTRY_CODES, type CountryCode } from '@/lib/country-codes'
import { formatPhoneNumber } from '@/lib/ambassador/phone-format'
import { CountryPicker } from '@/components/ambassador/CountryPicker'
import { AmbSubmitButton } from '@/components/ambassador/AmbSubmitButton'
import { useTurnstile } from '@/components/turnstile/TurnstileWidget'

type ToastState = { msg: string; success: boolean; id: number }

export default function AmbassadorAuthPage() {
  const router = useRouter()

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    () => COUNTRY_CODES.find(c => c.id === 'AE')!
  )
  const [phone, setPhone] = useState('')
  const [showPicker, setShowPicker] = useState(false)
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

  const phoneInputRef = useRef<HTMLInputElement | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const rawDigits = phone.replace(/\D/g, '')
  const isPhoneValid = rawDigits.length >= 6

  const showToast = useCallback((msg: string, success = false) => {
    const id = Date.now()
    setToast({ msg, success, id })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => (prev && prev.id === id ? null : prev))
    }, 5200)
  }, [])

  const selectCountry = (c: CountryCode) => {
    setSelectedCountry(c)
    setPhone('')
    setShowPicker(false)
    setTimeout(() => phoneInputRef.current?.focus(), 50)
  }

  const handleSendOTP = async () => {
    if (!isPhoneValid) {
      showToast('Enter a valid phone number', false)
      throw new Error('invalid phone')
    }
    const fullPhone = `${selectedCountry.code}${rawDigits}`
    let res: Response
    try {
      res = await fetch('/api/ambassador/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullPhone, turnstileToken }),
      })
    } catch (err) {
      console.error('[auth] WhatsApp send failed:', err)
      showToast('Network error. Please try again.', false)
      resetTurnstile()
      throw err
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data.error || 'Failed to send code', false)
      resetTurnstile()
      throw new Error(data.error || 'send failed')
    }
    sessionStorage.setItem('ambassador_auth_phone', fullPhone)
    sessionStorage.setItem('ambassador_auth_country', selectedCountry.code)
    resetTurnstile()
  }

  return (
    <div style={{ position: 'relative', minHeight: '760px' }}>
      <div style={{ position: 'relative', minHeight: '760px' }}>
        <div style={{ padding: '80px 40px 24px', textAlign: 'center' }}>
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

          {/* Phone row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', height: '52px' }}>
            <div
              onClick={() => setShowPicker(true)}
              style={{
                border: '1.5px solid #2a2a2a',
                borderRadius: '12px',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                flexShrink: 0,
                height: '52px',
                boxSizing: 'border-box',
                background: 'transparent',
              }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{selectedCountry.flag}</span>
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                {selectedCountry.code}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <input
              ref={phoneInputRef}
              type="tel"
              placeholder={selectedCountry.placeholder}
              value={phone}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '')
                setPhone(formatPhoneNumber(digits, selectedCountry.code))
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#e91e8c')}
              onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: '1.5px solid #2a2a2a',
                borderRadius: '12px',
                padding: '0 16px',
                fontSize: '15px',
                color: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                height: '52px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {/* WhatsApp button */}
          <AmbSubmitButton
            verb="send"
            variant="outline"
            idleLabel="Continue with WhatsApp"
            disabled={!isPhoneValid}
            onSubmit={handleSendOTP}
            onDone={() => router.push('/model/auth/verify')}
          />
        </div>

        {/* Email fallback link */}
        <div className="amb-auth-fallback-link">
          <Link href="/model/auth/email" style={{ textDecoration: 'none', color: '#888' }}>
            No WhatsApp?{' '}
            <span style={{ color: '#e91e8c', fontWeight: 600 }}>Continue with email →</span>
          </Link>
        </div>

        {/* Legal footer */}
        <div className="amb-auth-legal-footer">
          By continuing, you agree to our{' '}
          <a
            href="https://welovedecode.com/#terms"
            target="_blank"
            rel="noreferrer"
            style={{ cursor: 'pointer', fontWeight: 700, color: '#555', textDecoration: 'none' }}
          >Terms</a>{' '}
          and{' '}
          <a
            href="https://welovedecode.com/#privacy"
            target="_blank"
            rel="noreferrer"
            style={{ cursor: 'pointer', fontWeight: 700, color: '#555', textDecoration: 'none' }}
          >Privacy Policy</a>
        </div>
      </div>

      <CountryPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={selectCountry}
      />

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
