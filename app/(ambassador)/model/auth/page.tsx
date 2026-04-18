'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { COUNTRY_CODES, type CountryCode, findCountryByCode } from '@/lib/country-codes'

// Group countries: popular first, then A-Z
const POPULAR_IDS = ['AE', 'US', 'GB', 'IN', 'SA', 'EG']
const popularCountries = COUNTRY_CODES.filter(c => POPULAR_IDS.includes(c.id))
const allCountries = COUNTRY_CODES.filter(c => !POPULAR_IDS.includes(c.id))
  .sort((a, b) => a.country.localeCompare(b.country))

export default function AmbassadorAuthPage() {
  const router = useRouter()

  // Phone state
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    COUNTRY_CODES.find(c => c.id === 'AE')!
  )
  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  // Email state
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  // Country picker
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')

  // Feedback
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileWidgetId = useRef<string | null>(null)

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const countrySearchRef = useRef<HTMLInputElement>(null)

  // Auto-clear errors
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 5000)
      return () => clearTimeout(t)
    }
  }, [error])

  // Focus country search when picker opens
  useEffect(() => {
    if (showCountryPicker) {
      setTimeout(() => countrySearchRef.current?.focus(), 100)
    }
  }, [showCountryPicker])

  // Load Turnstile
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

  // Format phone based on country placeholder pattern
  const formatPhone = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    const pattern = selectedCountry.placeholder.split(' ').map(g => g.length)
    const parts: string[] = []
    let pos = 0
    for (const size of pattern) {
      if (pos >= digits.length) break
      parts.push(digits.slice(pos, pos + size))
      pos += size
    }
    if (pos < digits.length) parts.push(digits.slice(pos))
    return parts.join(' ')
  }, [selectedCountry])

  // Reset Turnstile token (tokens are single-use; must refresh after each attempt)
  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    if (window.turnstile && turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current)
    }
  }, [])

  const rawDigits = phone.replace(/\D/g, '')
  const isPhoneValid = rawDigits.length >= 6
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Filter countries
  const filteredCountries = countrySearch
    ? [...popularCountries, ...allCountries].filter(c =>
        c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
      )
    : null

  // Send WhatsApp OTP
  const handleSendOTP = async () => {
    if (!isPhoneValid || phoneLoading) return
    setPhoneLoading(true)
    setError('')

    const fullPhone = `${selectedCountry.code}${rawDigits}`

    try {
      const res = await fetch('/api/ambassador/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullPhone, turnstileToken }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send code')
        setPhoneLoading(false)
        resetTurnstile()
        return
      }

      // Store phone for verify page
      sessionStorage.setItem('ambassador_auth_phone', fullPhone)
      sessionStorage.setItem('ambassador_auth_country', selectedCountry.code)
      resetTurnstile()
      router.push('/model/auth/verify')
    } catch {
      setError('Network error. Please try again.')
      setPhoneLoading(false)
      resetTurnstile()
    }
  }

  // Send magic link
  const handleSendMagicLink = async () => {
    if (!isEmailValid || emailLoading) return
    setEmailLoading(true)
    setError('')

    try {
      const res = await fetch('/api/ambassador/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), turnstileToken }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send link')
        setEmailLoading(false)
        resetTurnstile()
        return
      }

      sessionStorage.setItem('ambassador_auth_email', email.toLowerCase().trim())
      resetTurnstile()
      router.push('/model/auth/sent')
    } catch {
      setError('Network error. Please try again.')
      setEmailLoading(false)
      resetTurnstile()
    }
  }

  return (
    <div style={{ padding: '0 24px', paddingTop: '60px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <p style={{
          fontSize: '9px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: '#666',
          marginBottom: '8px',
        }}>
          SHOW YOUR BEAUTY SQUAD
        </p>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.2px',
          marginBottom: '4px',
        }}>
          WeLoveDecode
        </h1>
        {/* Animated accent line */}
        <div style={{
          width: '40px',
          height: '2px',
          background: '#e91e8c',
          margin: '12px auto 16px',
          borderRadius: '1px',
        }} />
        <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.65 }}>
          Enter your number or email
        </p>
      </div>

      {/* WhatsApp section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          fontSize: '9px',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: '#666',
          marginBottom: '8px',
        }}>
          WhatsApp
        </div>

        {/* Country picker + phone input */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {/* Country button */}
          <button
            onClick={() => setShowCountryPicker(true)}
            style={{
              height: '52px',
              padding: '0 12px',
              background: 'transparent',
              border: '1.5px solid #262626',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span>{selectedCountry.flag}</span>
            <span style={{ color: '#888' }}>{selectedCountry.code}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Phone input */}
          <input
            ref={phoneInputRef}
            type="tel"
            inputMode="numeric"
            placeholder={selectedCountry.placeholder}
            value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') handleSendOTP() }}
            style={{
              flex: 1,
              height: '52px',
              padding: '0 16px',
              background: 'transparent',
              border: '1.5px solid #262626',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '15px',
              outline: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
            onFocus={e => e.target.style.borderColor = '#e91e8c'}
            onBlur={e => e.target.style.borderColor = '#262626'}
          />
        </div>

        {/* WhatsApp button */}
        <button
          onClick={handleSendOTP}
          disabled={!isPhoneValid || phoneLoading}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isPhoneValid && !phoneLoading ? 'pointer' : 'not-allowed',
            background: isPhoneValid ? '#e91e8c' : '#1c1c1c',
            color: isPhoneValid ? '#fff' : '#555',
            transition: 'all 0.2s',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {phoneLoading ? 'Sending...' : 'Continue with WhatsApp'}
        </button>
      </div>

      {/* Divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '32px',
      }}>
        <div style={{ flex: 1, height: '1px', background: '#262626' }} />
        <span style={{ fontSize: '11px', color: '#555' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: '#262626' }} />
      </div>

      {/* Email section */}
      <div>
        <div style={{
          fontSize: '9px',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: '#666',
          marginBottom: '8px',
        }}>
          Email
        </div>

        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSendMagicLink() }}
          style={{
            width: '100%',
            height: '52px',
            padding: '0 16px',
            background: 'transparent',
            border: '1.5px solid #262626',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '15px',
            outline: 'none',
            marginBottom: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = '#e91e8c'}
          onBlur={e => e.target.style.borderColor = '#262626'}
        />

        <button
          onClick={handleSendMagicLink}
          disabled={!isEmailValid || emailLoading}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isEmailValid && !emailLoading ? 'pointer' : 'not-allowed',
            background: isEmailValid ? '#e91e8c' : '#1c1c1c',
            color: isEmailValid ? '#fff' : '#555',
            transition: 'all 0.2s',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {emailLoading ? 'Sending...' : 'Continue with Email'}
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(28,28,28,0.95)',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          padding: '12px 20px',
          color: '#ef4444',
          fontSize: '13px',
          zIndex: 100,
          maxWidth: '340px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Turnstile invisible widget */}
      <div id="turnstile-container" style={{ display: 'none' }} />

      {/* Country picker overlay */}
      {showCountryPicker && (
        <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 199 }} />
        <div style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '420px',
          background: '#000',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #1a1a1a',
          }}>
            <button
              onClick={() => { setShowCountryPicker(false); setCountrySearch('') }}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <input
              ref={countrySearchRef}
              type="text"
              placeholder="Search country..."
              value={countrySearch}
              onChange={e => setCountrySearch(e.target.value)}
              style={{
                flex: 1,
                height: '40px',
                padding: '0 12px',
                background: '#1c1c1c',
                border: '1px solid #262626',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>

          {/* Country list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filteredCountries ? (
              // Search results
              filteredCountries.map(country => (
                <CountryRow
                  key={country.id}
                  country={country}
                  selected={selectedCountry.id === country.id}
                  onSelect={() => {
                    setSelectedCountry(country)
                    setPhone('')
                    setShowCountryPicker(false)
                    setCountrySearch('')
                    setTimeout(() => phoneInputRef.current?.focus(), 100)
                  }}
                />
              ))
            ) : (
              <>
                {/* Popular */}
                <div style={{
                  padding: '8px 24px 4px',
                  fontSize: '9px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#666',
                }}>
                  Popular
                </div>
                {popularCountries.map(country => (
                  <CountryRow
                    key={country.id}
                    country={country}
                    selected={selectedCountry.id === country.id}
                    onSelect={() => {
                      setSelectedCountry(country)
                      setPhone('')
                      setShowCountryPicker(false)
                      setTimeout(() => phoneInputRef.current?.focus(), 100)
                    }}
                  />
                ))}

                {/* All countries */}
                <div style={{
                  padding: '16px 24px 4px',
                  fontSize: '9px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#666',
                }}>
                  All countries
                </div>
                {allCountries.map(country => (
                  <CountryRow
                    key={country.id}
                    country={country}
                    selected={selectedCountry.id === country.id}
                    onSelect={() => {
                      setSelectedCountry(country)
                      setPhone('')
                      setShowCountryPicker(false)
                      setTimeout(() => phoneInputRef.current?.focus(), 100)
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}

function CountryRow({
  country,
  selected,
  onSelect,
}: {
  country: CountryCode
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 24px',
        background: selected ? '#1c1c1c' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span style={{ fontSize: '20px' }}>{country.flag}</span>
      <span style={{ flex: 1, color: '#fff', fontSize: '14px' }}>{country.country}</span>
      <span style={{ color: '#666', fontSize: '13px' }}>{country.code}</span>
      {selected && <span style={{ color: '#e91e8c', fontSize: '14px' }}>&#10003;</span>}
    </button>
  )
}

// Extend Window for Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (selector: string, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}
