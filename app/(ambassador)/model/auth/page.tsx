'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { COUNTRY_CODES, type CountryCode } from '@/lib/country-codes'

const PHONE_FORMATS: Record<string, string> = {
  '+971': '## ### ####',
  '+1': '(###) ###-####',
  '+44': '#### ######',
  '+49': '### ########',
  '+33': '# ## ## ## ##',
  '+39': '### ### ####',
  '+34': '### ## ## ##',
  '+31': '# ########',
  '+32': '### ## ## ##',
  '+41': '## ### ## ##',
  '+43': '### ######',
  '+46': '## ### ## ##',
  '+47': '### ## ###',
  '+45': '## ## ## ##',
  '+358': '## #######',
  '+91': '##### #####',
  '+92': '### #######',
  '+880': '#### ######',
  '+966': '## ### ####',
  '+974': '#### ####',
  '+973': '#### ####',
  '+965': '### #####',
  '+968': '#### ####',
  '+962': '# #### ####',
  '+961': '## ### ###',
  '+20': '### ### ####',
  '+212': '### ######',
  '+216': '## ### ###',
  '+90': '### ### ## ##',
  '+7': '### ### ## ##',
  '+380': '## ### ####',
  '+48': '### ### ###',
  '+420': '### ### ###',
  '+40': '### ### ###',
  '+30': '### ### ####',
  '+351': '### ### ###',
  '+353': '## ### ####',
  '+81': '## #### ####',
  '+82': '## #### ####',
  '+86': '### #### ####',
  '+852': '#### ####',
  '+65': '#### ####',
  '+60': '## ### ####',
  '+63': '### ### ####',
  '+66': '## ### ####',
  '+84': '## ### ## ##',
  '+62': '### #### ####',
  '+61': '### ### ###',
  '+64': '## ### ####',
  '+27': '## ### ####',
  '+234': '### ### ####',
  '+254': '### ######',
  '+55': '## ##### ####',
  '+52': '### ### ####',
  '+54': '## #### ####',
  '+56': '# #### ####',
  '+57': '### #######',
}

function formatPhoneNumber(digits: string, dialCode: string): string {
  const mask = PHONE_FORMATS[dialCode]
  if (!mask) return digits
  let out = ''
  let di = 0
  for (let i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === '#') {
      out += digits[di]
      di++
    } else {
      out += mask[i]
    }
  }
  if (di < digits.length) out += ' ' + digits.slice(di)
  return out
}

const POPULAR_IDS = ['AE', 'US', 'GB']

type ToastState = { msg: string; success: boolean; id: number }

export default function AmbassadorAuthPage() {
  const router = useRouter()

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    () => COUNTRY_CODES.find(c => c.id === 'AE')!
  )
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')

  const turnstileWidgetId = useRef<string | null>(null)
  const phoneInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = () => {
      if (window.turnstile) {
        const widgetId = window.turnstile.render('#turnstile-container', {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
          'refresh-expired': 'auto',
          size: 'compact',
          appearance: 'interaction-only',
        })
        turnstileWidgetId.current = widgetId
      }
    }
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    if (window.turnstile && turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current)
    }
  }, [])

  const rawDigits = phone.replace(/\D/g, '')
  const isPhoneValid = rawDigits.length >= 6
  const isEmailValid = email.length > 0 && email.includes('@')

  const showToast = useCallback((msg: string, success = false) => {
    const id = Date.now()
    setToast({ msg, success, id })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => (prev && prev.id === id ? null : prev))
    }, 2000)
  }, [])

  useEffect(() => {
    const trimmed = pickerSearch.trim()
    if (trimmed.length === 1 && /[a-zA-Z]/.test(trimmed) && listRef.current) {
      const letter = trimmed.toUpperCase()
      requestAnimationFrame(() => {
        const container = listRef.current
        if (!container) return
        const el = container.querySelector(`#section-${letter}`)
        if (el instanceof HTMLElement) {
          container.scrollTop = el.offsetTop - 8
        }
      })
    }
  }, [pickerSearch])

  const openPicker = () => {
    setShowPicker(true)
    setPickerSearch('')
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const closePicker = () => {
    setShowPicker(false)
    setPickerSearch('')
  }

  const selectCountry = (c: CountryCode) => {
    setSelectedCountry(c)
    setPhone('')
    closePicker()
    setTimeout(() => phoneInputRef.current?.focus(), 50)
  }

  const handleSendOTP = async () => {
    if (!isPhoneValid) {
      showToast('Enter a valid phone number', false)
      return
    }
    const fullPhone = `${selectedCountry.code}${rawDigits}`
    try {
      const res = await fetch('/api/ambassador/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullPhone, turnstileToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to send code', false)
        resetTurnstile()
        return
      }
      sessionStorage.setItem('ambassador_auth_phone', fullPhone)
      sessionStorage.setItem('ambassador_auth_country', selectedCountry.code)
      resetTurnstile()
      router.push('/model/auth/verify')
    } catch {
      showToast('Network error. Please try again.', false)
      resetTurnstile()
    }
  }

  const handleSendMagicLink = async () => {
    if (!isEmailValid) {
      showToast('Enter a valid email', false)
      return
    }
    const normalized = email.toLowerCase().trim()
    try {
      const res = await fetch('/api/ambassador/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, turnstileToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to send link', false)
        resetTurnstile()
        return
      }
      sessionStorage.setItem('ambassador_auth_email', normalized)
      resetTurnstile()
      router.push(`/model/auth/sent?email=${encodeURIComponent(normalized)}`)
    } catch {
      showToast('Network error. Please try again.', false)
      resetTurnstile()
    }
  }

  const popular = COUNTRY_CODES.filter(c => POPULAR_IDS.includes(c.id))
  const rest = COUNTRY_CODES
    .filter(c => !POPULAR_IDS.includes(c.id))
    .sort((a, b) => a.country.localeCompare(b.country))

  const searchTrimmed = pickerSearch.trim()
  const isSingleLetter = searchTrimmed.length === 1 && /[a-zA-Z]/.test(searchTrimmed)
  const showFullList = searchTrimmed.length === 0 || isSingleLetter

  const filtered = showFullList
    ? []
    : COUNTRY_CODES
        .filter(c => {
          const q = searchTrimmed.toLowerCase()
          return (
            c.country.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q)
          )
        })
        .sort((a, b) => a.country.localeCompare(b.country))

  const fullListItems: React.ReactNode[] = []
  let currentLetter = ''
  rest.forEach(c => {
    const first = c.country.charAt(0).toUpperCase()
    if (first !== currentLetter) {
      currentLetter = first
      fullListItems.push(
        <div
          key={`section-${first}`}
          id={`section-${first}`}
          style={{
            fontSize: '10px',
            letterSpacing: '1px',
            color: '#888',
            fontWeight: 700,
            padding: '18px 0 6px',
          }}
        >
          {first}
        </div>
      )
    }
    fullListItems.push(
      <CountryRow key={c.id} country={c} onSelect={() => selectCountry(c)} />
    )
  })

  return (
    <div style={{ position: 'relative', minHeight: '760px' }}>
      {!showPicker ? (
        <div style={{ position: 'relative', minHeight: '760px' }}>
          <div style={{ padding: '64px 40px 24px', textAlign: 'center' }}>
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
              marginBottom: '18px',
            }}>
              WeLoveDecode
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '24px' }}>
              Enter your number or email
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
                onClick={openPicker}
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
            <div
              onClick={handleSendOTP}
              style={{
                border: `1.5px solid ${isPhoneValid ? '#e91e8c' : '#2a2a2a'}`,
                borderRadius: '12px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '28px',
                textAlign: 'center',
                transition: 'all 0.3s',
                background: isPhoneValid ? '#e91e8c' : 'transparent',
              }}
            >
              <span style={{ color: isPhoneValid ? '#fff' : '#555', transition: 'color 0.3s' }}>
                Continue with WhatsApp
              </span>
            </div>

            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '28px',
              letterSpacing: '1px',
              fontWeight: 600,
            }}>OR</div>

            <input
              type="email"
              placeholder="Enter your email"
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
                fontSize: '15px',
                color: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                height: '52px',
                boxSizing: 'border-box',
                marginBottom: '12px',
                transition: 'border-color 0.2s',
              }}
            />

            <div
              onClick={handleSendMagicLink}
              style={{
                border: `1.5px solid ${isEmailValid ? '#e91e8c' : '#2a2a2a'}`,
                borderRadius: '12px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: 600,
                color: isEmailValid ? '#fff' : '#555',
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: isEmailValid ? '#e91e8c' : 'transparent',
              }}
            >Continue with Email</div>
          </div>

          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: '9px',
            color: '#555',
            lineHeight: 1.6,
            padding: '0 40px',
          }}>
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
      ) : (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px 20px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
          }}>
            <div
              onClick={closePicker}
              style={{
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '-8px',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Select country</div>
          </div>

          <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '16px',
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country or code"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#e91e8c')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1.5px solid #2a2a2a',
                  borderRadius: '12px',
                  padding: '0 16px 0 42px',
                  fontSize: '14px',
                  color: '#fff',
                  outline: 'none',
                  fontFamily: 'inherit',
                  height: '48px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>
          </div>

          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 20px 24px',
              maxHeight: '620px',
              position: 'relative',
            }}
          >
            {showFullList ? (
              <>
                <div style={{
                  fontSize: '10px',
                  letterSpacing: '1px',
                  color: '#888',
                  fontWeight: 700,
                  padding: '14px 0 6px',
                }}>POPULAR</div>
                {popular.map(c => (
                  <CountryRow key={c.id} country={c} onSelect={() => selectCountry(c)} />
                ))}
                {fullListItems}
              </>
            ) : filtered.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '13px',
              }}>
                No countries found
              </div>
            ) : (
              filtered.map(c => (
                <CountryRow key={c.id} country={c} onSelect={() => selectCountry(c)} />
              ))
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: '60px',
          transform: 'translateX(-50%)',
          background: 'rgba(28,28,28,0.95)',
          border: `1px solid ${toast.success ? '#4ade80' : '#333'}`,
          color: toast.success ? '#4ade80' : '#fff',
          padding: '10px 18px',
          borderRadius: '24px',
          fontSize: '12px',
          zIndex: 20,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {toast.msg}
        </div>
      )}

      <div id="turnstile-container" style={{ display: 'none' }} />

      <style>{`
        @keyframes drawLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        input::placeholder { color: #666; opacity: 1; }
        input::-webkit-input-placeholder { color: #666; }
      `}</style>
    </div>
  )
}

function CountryRow({
  country,
  onSelect,
}: {
  country: CountryCode
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 4px',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>{country.flag}</span>
      <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#fff' }}>
        {country.country}
      </span>
      <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>{country.code}</span>
    </div>
  )
}

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}
