'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { COUNTRY_CODES } from '@/lib/country-codes'
import { countryToCurrency } from '@/lib/ambassador/constants'

// Currency data for picker
const POPULAR_CURRENCIES = [
  { code: 'usd', label: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'eur', label: 'Euro', symbol: '\u20AC', flag: '🇪🇺' },
  { code: 'aed', label: 'UAE Dirham', symbol: 'AED', flag: '🇦🇪' },
  { code: 'gbp', label: 'British Pound', symbol: '\u00A3', flag: '🇬🇧' },
  { code: 'sar', label: 'Saudi Riyal', symbol: 'SAR', flag: '🇸🇦' },
  { code: 'inr', label: 'Indian Rupee', symbol: '\u20B9', flag: '🇮🇳' },
]

const ALL_CURRENCIES = [
  { code: 'aud', label: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'brl', label: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'cad', label: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'chf', label: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'cny', label: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'czk', label: 'Czech Koruna', flag: '🇨🇿' },
  { code: 'dkk', label: 'Danish Krone', flag: '🇩🇰' },
  { code: 'egp', label: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'hkd', label: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'huf', label: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'idr', label: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'ils', label: 'Israeli Shekel', flag: '🇮🇱' },
  { code: 'jpy', label: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'krw', label: 'South Korean Won', flag: '🇰🇷' },
  { code: 'kwd', label: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'mxn', label: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'myr', label: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'ngn', label: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'nok', label: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'nzd', label: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'php', label: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'pkr', label: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'pln', label: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'qar', label: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'ron', label: 'Romanian Leu', flag: '🇷🇴' },
  { code: 'sek', label: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'sgd', label: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'thb', label: 'Thai Baht', flag: '🇹🇭' },
  { code: 'try', label: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'twd', label: 'Taiwan Dollar', flag: '🇹🇼' },
  { code: 'zar', label: 'South African Rand', flag: '🇿🇦' },
].sort((a, b) => a.label.localeCompare(b.label))

export default function SetupPage() {
  const router = useRouter()

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [slug, setSlug] = useState('')
  const [instagram, setInstagram] = useState('')
  const [currency, setCurrency] = useState('aed')
  const [coverPhotoPositionY, setCoverPhotoPositionY] = useState(50)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Slug check state
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [slugError, setSlugError] = useState('')
  const [slugSuggestion, setSlugSuggestion] = useState('')
  const slugTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Currency picker
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState('')

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)

  // Cover photo drag state
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartPos = useRef(50)

  // Auto-detect currency from geo
  useEffect(() => {
    // Vercel provides x-vercel-ip-country in server context
    // On client, we fetch a lightweight endpoint or use a default
    // For now, default to AED (can be overridden by user)
  }, [])

  // Debounced slug check
  const checkSlug = useCallback((value: string) => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current)

    if (value.length < 3) {
      setSlugStatus('idle')
      setSlugError('')
      return
    }

    setSlugStatus('checking')
    slugTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ambassador/model/check-slug?slug=${encodeURIComponent(value)}`)
        const data = await res.json()
        if (data.available) {
          setSlugStatus('available')
          setSlugError('')
          setSlugSuggestion('')
        } else {
          setSlugStatus('taken')
          setSlugError(data.error || 'Not available')
          setSlugSuggestion(data.suggestion || '')
        }
      } catch {
        setSlugStatus('idle')
      }
    }, 450)
  }, [])

  // Handle cover photo
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setCoverPhotoPositionY(50)
  }

  // Cover photo drag-to-reposition
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!coverPreview) return
    setDragging(true)
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    dragStartPos.current = coverPhotoPositionY
  }

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = clientY - dragStartY.current
    const newPos = Math.max(0, Math.min(100, dragStartPos.current + delta * 0.5))
    setCoverPhotoPositionY(Math.round(newPos))
  }, [dragging])

  const handleDragEnd = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove)
      window.addEventListener('touchend', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [dragging, handleDragMove, handleDragEnd])

  // Capitalize first letter of each word
  const capFirst = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())

  // Form validation
  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    slug.length >= 3 &&
    slugStatus === 'available' &&
    instagram.trim().length > 0 &&
    currency.length > 0

  // Submit
  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    setSubmitError('')

    const formData = new FormData()
    formData.append('firstName', firstName.trim())
    formData.append('lastName', lastName.trim())
    formData.append('slug', slug)
    formData.append('instagram', instagram.trim())
    formData.append('currency', currency)
    formData.append('coverPhotoPositionY', String(coverPhotoPositionY))
    if (coverFile) {
      formData.append('coverPhoto', coverFile)
    }

    try {
      const res = await fetch('/api/ambassador/model/setup', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.redirect) {
          router.replace(data.redirect)
          return
        }
        setSubmitError(data.error || 'Failed to create profile')
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.replace('/model'), 600)
    } catch {
      setSubmitError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  // Find currency display info
  const activeCurrency = [...POPULAR_CURRENCIES, ...ALL_CURRENCIES].find(c => c.code === currency)

  // Filter currencies in picker
  const filteredCurrencies = currencySearch
    ? [...POPULAR_CURRENCIES, ...ALL_CURRENCIES].filter(c =>
        c.label.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.code.includes(currencySearch.toLowerCase())
      )
    : null

  const coverInputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ padding: '0 24px', paddingTop: '24px', paddingBottom: '40px' }}>
      {/* Progress tracker */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
      }}>
        {['Verify', 'Set up', 'Live'].map((label, i) => {
          const isDone = i === 0
          const isActive = i === 1
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDone ? '#e91e8c' : 'transparent',
                border: `2px solid ${isDone || isActive ? '#e91e8c' : '#3a3a3a'}`,
                fontSize: '10px',
                color: isDone ? '#fff' : isActive ? '#e91e8c' : '#3a3a3a',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {isDone ? '✓' : isActive ? (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e91e8c' }} />
                ) : ''}
              </div>
              <span style={{
                fontSize: '9px',
                color: isDone || isActive ? '#e91e8c' : '#555',
                marginLeft: '4px',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
              {i < 2 && (
                <div style={{
                  width: '40px',
                  height: '2px',
                  margin: '0 6px',
                  background: isDone ? '#e91e8c' : '#3a3a3a',
                  borderRadius: '1px',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Cover photo */}
      <div
        style={{
          height: '110px',
          borderRadius: '14px',
          border: coverPreview ? '1.5px solid #333' : '1.5px dashed #333',
          background: coverPreview
            ? `url(${coverPreview}) center ${coverPhotoPositionY}% / cover no-repeat`
            : 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
          position: 'relative',
          overflow: 'hidden',
          cursor: coverPreview ? (dragging ? 'grabbing' : 'grab') : 'pointer',
          marginBottom: '24px',
        }}
        onClick={() => { if (!coverPreview) coverInputRef.current?.click() }}
        onMouseDown={coverPreview ? handleDragStart : undefined}
        onTouchStart={coverPreview ? handleDragStart : undefined}
      >
        {/* Camera icon */}
        <button
          onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click() }}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid #333',
            color: '#fff',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          &#128247;
        </button>
        {dragging && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '10px',
            color: '#888',
          }}>
            Drag to reposition
          </div>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Name fields — two columns */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>First name</label>
          <input
            type="text"
            placeholder="Sara"
            value={firstName}
            onChange={e => setFirstName(capFirst(e.target.value))}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#e91e8c'}
            onBlur={e => e.target.style.borderColor = '#262626'}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Last name</label>
          <input
            type="text"
            placeholder="Johnson"
            value={lastName}
            onChange={e => setLastName(capFirst(e.target.value))}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#e91e8c'}
            onBlur={e => e.target.style.borderColor = '#262626'}
          />
        </div>
      </div>

      {/* Page URL */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Page URL</label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: '52px',
          border: '1.5px solid #262626',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <span style={{
            padding: '0 0 0 14px',
            color: '#666',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            welovedecode.com/
          </span>
          <input
            type="text"
            placeholder="your_name"
            value={slug}
            onChange={e => {
              const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
              setSlug(v)
              checkSlug(v)
            }}
            style={{
              flex: 1,
              height: '100%',
              padding: '0 8px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              outline: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
          {/* Status indicator */}
          <div style={{ paddingRight: '14px', flexShrink: 0 }}>
            {slugStatus === 'checking' && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #555',
                borderTopColor: '#e91e8c',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            )}
            {slugStatus === 'available' && (
              <span style={{ color: '#4ade80', fontSize: '16px' }}>&#10003;</span>
            )}
            {slugStatus === 'taken' && (
              <span style={{ color: '#ef4444', fontSize: '16px' }}>&#10005;</span>
            )}
          </div>
        </div>
        {slugError && (
          <p style={{ fontSize: '9px', color: '#ef4444', marginTop: '4px' }}>
            {slugError}
            {slugSuggestion && (
              <button
                onClick={() => { setSlug(slugSuggestion); checkSlug(slugSuggestion) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e91e8c',
                  fontSize: '9px',
                  cursor: 'pointer',
                  marginLeft: '4px',
                  textDecoration: 'underline',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                Try {slugSuggestion}
              </button>
            )}
          </p>
        )}
        <p style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
          3-30 characters, lowercase letters, numbers, underscores
        </p>
      </div>

      {/* Instagram */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Instagram</label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: '52px',
          border: '1.5px solid #262626',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <span style={{
            padding: '0 0 0 14px',
            color: '#e91e8c',
            fontSize: '16px',
            flexShrink: 0,
          }}>
            @
          </span>
          <input
            type="text"
            placeholder="your username"
            value={instagram}
            onChange={e => setInstagram(e.target.value.replace(/^@/, '').replace(/[^a-z0-9_.]/gi, '').toLowerCase())}
            style={{
              flex: 1,
              height: '100%',
              padding: '0 14px 0 4px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              outline: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
        </div>
      </div>

      {/* Currency */}
      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle}>Currency</label>
        <button
          onClick={() => setShowCurrencyPicker(true)}
          style={{
            width: '100%',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 14px',
            background: 'transparent',
            border: '1.5px solid #262626',
            borderRadius: '12px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <span style={{ fontSize: '18px' }}>{activeCurrency?.flag || '🌍'}</span>
          <span style={{ flex: 1, color: '#fff', fontSize: '14px' }}>
            {currency.toUpperCase()}
            {activeCurrency ? ` — ${activeCurrency.label}` : ''}
          </span>
          <span style={{ color: '#555', fontSize: '10px' }}>&#9662;</span>
        </button>
      </div>

      {/* Go live button */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        style={{
          width: '100%',
          height: '52px',
          borderRadius: '12px',
          border: 'none',
          fontSize: '14px',
          fontWeight: 600,
          cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
          background: success ? '#34d399' : isValid ? '#e91e8c' : '#1c1c1c',
          color: isValid || success ? '#fff' : '#555',
          transition: 'all 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {success ? "You're live!" : submitting ? 'Creating...' : 'Go live'}
      </button>

      {submitError && (
        <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>
          {submitError}
        </p>
      )}

      {/* Currency picker overlay */}
      {showCurrencyPicker && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #1a1a1a',
          }}>
            <button
              onClick={() => { setShowCurrencyPicker(false); setCurrencySearch('') }}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              &#x2715;
            </button>
            <input
              type="text"
              placeholder="Search currency..."
              value={currencySearch}
              onChange={e => setCurrencySearch(e.target.value)}
              autoFocus
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

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filteredCurrencies ? (
              filteredCurrencies.map(c => (
                <CurrencyRow
                  key={c.code}
                  code={c.code}
                  label={c.label}
                  flag={c.flag}
                  selected={currency === c.code}
                  onSelect={() => {
                    setCurrency(c.code)
                    setShowCurrencyPicker(false)
                    setCurrencySearch('')
                  }}
                />
              ))
            ) : (
              <>
                <div style={{
                  padding: '8px 24px 4px',
                  fontSize: '9px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#666',
                }}>
                  Popular
                </div>
                {POPULAR_CURRENCIES.map(c => (
                  <CurrencyRow
                    key={c.code}
                    code={c.code}
                    label={c.label}
                    flag={c.flag}
                    selected={currency === c.code}
                    onSelect={() => {
                      setCurrency(c.code)
                      setShowCurrencyPicker(false)
                    }}
                  />
                ))}
                <div style={{
                  padding: '16px 24px 4px',
                  fontSize: '9px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#666',
                }}>
                  All currencies
                </div>
                {ALL_CURRENCIES.map(c => (
                  <CurrencyRow
                    key={c.code}
                    code={c.code}
                    label={c.label}
                    flag={c.flag}
                    selected={currency === c.code}
                    onSelect={() => {
                      setCurrency(c.code)
                      setShowCurrencyPicker(false)
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '9px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: '#666',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '52px',
  padding: '0 14px',
  background: 'transparent',
  border: '1.5px solid #262626',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '15px',
  outline: 'none',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function CurrencyRow({
  code,
  label,
  flag,
  selected,
  onSelect,
}: {
  code: string
  label: string
  flag: string
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
      <span style={{ fontSize: '20px' }}>{flag}</span>
      <span style={{ flex: 1, color: '#fff', fontSize: '14px' }}>{label}</span>
      <span style={{ color: '#666', fontSize: '12px' }}>{code.toUpperCase()}</span>
      {selected && <span style={{ color: '#e91e8c', fontSize: '14px' }}>&#10003;</span>}
    </button>
  )
}
