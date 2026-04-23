'use client'

/**
 * Add Listing form (client).
 *
 * Slice 3B Phase 5 Commit A — scaffold only:
 *   - All sections render with empty state
 *   - Text inputs, category dropdown, trial toggle, pricing UI are all
 *     state-driven and functional
 *   - Avatar tile + media tile render empty (no click handlers yet)
 *   - Submit button is permanently disabled (no handler wired)
 *
 * Upload flow, dedup POST, listing POST, and redirect all ship in
 * Commit B after the Guardrail 4 design-review pass.
 *
 * UX spec: `_features/ambassador/add_listing_final_UI_Spec.md`
 * Mockup:  `_features/ambassador/add_listing_final.html`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AmbSubmitButton } from '@/components/ambassador/AmbSubmitButton'

type Category = { id: string; label: string; slug: string }

interface Props {
  categories: Category[]
  currency: string   // lowercase ISO from model_profiles.currency
  profileId: string  // unused in Commit A; wired in Commit B
}

type CategorySelection =
  | { type: 'id'; id: string; label: string }
  | { type: 'custom'; text: string }
  | null

const PRICE_FLOORS: Record<string, number> = { usd: 10, eur: 10, gbp: 10, aed: 50 }
const DEFAULT_PRICE_FLOOR = 10

function priceFloorForCurrency(currency: string): number {
  return PRICE_FLOORS[currency.toLowerCase()] ?? DEFAULT_PRICE_FLOOR
}

function capFirst(s: string): string {
  if (!s) return s
  const first = s.charAt(0).toUpperCase()
  return first === s.charAt(0) ? s : first + s.slice(1)
}

function currencySymbol(currency: string): string {
  const code = currency.toUpperCase()
  if (code === 'USD') return '$'
  if (code === 'EUR') return '€'
  if (code === 'GBP') return '£'
  if (code === 'AED') return 'AED'
  return code
}

// --- Styling constants (kept local, match canonical ambassador forms) ---

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  color: '#666',
  fontWeight: 400,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 12,
  paddingLeft: 4,
}

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  background: '#1c1c1c',
  border: '1.5px solid #262626',
  borderRadius: 12,
  padding: '14px 16px',
  fontSize: 14,
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const FOCUS_SCOPE_ID = 'add-listing-page'

export default function AddListingClient({ categories, currency }: Props) {
  const router = useRouter()

  // --- Form state ---
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [instagram, setInstagram] = useState('')
  const [category, setCategory] = useState<CategorySelection>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [customCategoryText, setCustomCategoryText] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const [p30, setP30] = useState('')
  const [p60, setP60] = useState('')
  const [p90, setP90] = useState('')
  const [touched30, setTouched30] = useState(false)
  const [touched60, setTouched60] = useState(false)
  const [touched90, setTouched90] = useState(false)

  const [freeTrial, setFreeTrial] = useState(false)

  // Close category dropdown on outside click
  const catRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!categoryOpen) return
    const onClick = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [categoryOpen])

  const selectCategory = (cat: Category) => {
    setCategory({ type: 'id', id: cat.id, label: cat.label })
    setShowCustomInput(false)
    setCustomCategoryText('')
    setCategoryOpen(false)
  }

  const selectCustom = () => {
    setShowCustomInput(true)
    setCategory({ type: 'custom', text: '' })
    setCategoryOpen(false)
  }

  const onCustomCategoryChange = (v: string) => {
    const capped = capFirst(v)
    setCustomCategoryText(capped)
    setCategory({ type: 'custom', text: capped })
  }

  // --- Pricing derived values ---
  const p30n = parseInt(p30, 10) || 0
  const p60n = parseInt(p60, 10) || 0
  const p90n = parseInt(p90, 10) || 0
  const floor = priceFloorForCurrency(currency)
  const symbol = currencySymbol(currency)

  const perDay30 = p30n > 0 ? (p30n / 30).toFixed(2) : ''
  const perDay60 = p60n > 0 ? (p60n / 60).toFixed(2) : ''
  const perDay90 = p90n > 0 ? (p90n / 90).toFixed(2) : ''

  // OFF badge percentages relative to 30-day per-day rate
  const offPct = (amount: number, days: number) => {
    if (p30n <= 0 || amount <= 0) return null
    const per = amount / days
    const per30 = p30n / 30
    if (per >= per30) return null
    return Math.round((per30 - per) / per30 * 100)
  }
  const off60 = p60n > p30n ? offPct(p60n, 60) : null
  const off90 = p90n > p60n ? offPct(p90n, 90) : null

  // --- Pricing error logic (blur-triggered, same semantics as mockup §6.2) ---
  const min30 = touched30 && p30n > 0 && p30n < floor
  const min60 = touched60 && p60n > 0 && p60n < floor
  const min90 = touched90 && p90n > 0 && p90n < floor
  const err30 = touched30 && p30 === '0'
  const err60 = touched60 && (p60 === '0' || (p60n > 0 && p30n > 0 && p60n <= p30n))
  const err90 = touched90 && (p90 === '0' || (p90n > 0 && p60n > 0 && p90n <= p60n))
  const box30Bad = err30 || min30
  const box60Bad = err60 || min60
  const box90Bad = err90 || min90

  const pricingError = useMemo(() => {
    if (min30 || min60 || min90) return `Minimum ${symbol} ${floor}`
    if (err30) return 'Price must be greater than 0'
    if (err60 && p60 === '0') return 'Price must be greater than 0'
    if (err90 && p90 === '0') return 'Price must be greater than 0'
    if (err60) return '60-day price must be higher than 30-day'
    if (err90) return '90-day price must be higher than 60-day'
    return ''
  }, [min30, min60, min90, err30, err60, err90, p60, p90, symbol, floor])

  // --- Submit is disabled throughout Commit A. Handler wired in Commit B. ---
  const submitDisabled = true
  const noop = useCallback(async () => { /* Commit B wires the real handler */ }, [])

  const onPriceInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
    setter(digitsOnly)
  }

  return (
    <div id={FOCUS_SCOPE_ID} style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Pink focus ring — scoped to this page, matches mockup vocabulary */}
      <style>{`
        #${FOCUS_SCOPE_ID} input[type="text"]:focus,
        #${FOCUS_SCOPE_ID} input[type="tel"]:focus,
        #${FOCUS_SCOPE_ID} input[type="email"]:focus {
          border-color: #e91e8c !important;
          transition: border-color 0.15s;
        }
        #${FOCUS_SCOPE_ID} .al-fw:focus-within {
          border-color: #e91e8c !important;
          transition: border-color 0.15s;
        }
      `}</style>

      {/* Header — back arrow */}
      <div style={{ padding: '14px 20px 0' }}>
        <div
          onClick={() => router.push('/model')}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#1c1c1c', border: '1px solid #262626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '8px 22px 22px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 6 }}>
          Add listing
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          Professional you want to display on your page
        </div>
      </div>

      <div style={{ padding: '0 20px 24px' }}>

        {/* ================== PROFESSIONAL ================== */}
        <div style={{ marginBottom: 22 }}>
          <div style={SECTION_LABEL}>Professional</div>

          <input
            type="text"
            placeholder="Salon, clinic or doctor name"
            value={name}
            onChange={(e) => setName(capFirst(e.target.value))}
            style={{ ...INPUT_BASE, marginBottom: 10 }}
          />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            {/* Avatar tile — empty state, no click handler in Commit A */}
            <div style={{ flexShrink: 0, position: 'relative' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#1c1c1c', border: '1.5px dashed #333',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', textAlign: 'center',
              }}>
                <div style={{ fontSize: 8, color: '#666', lineHeight: 1.2, fontWeight: 500 }}>
                  Profile<br />Image
                </div>
              </div>
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 20, height: 20, borderRadius: '50%',
                background: '#1c1c1c', border: '2px solid #1c1c1c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" fill="#e91e8c" />
                  <path d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" fill="#e91e8c" />
                  <circle cx="18.406" cy="5.594" r="1.44" fill="#e91e8c" />
                </svg>
              </div>
            </div>

            {/* Category dropdown */}
            <div ref={catRef} style={{ flex: 1, position: 'relative' }}>
              <div
                onClick={() => setCategoryOpen((o) => !o)}
                style={{
                  background: '#1c1c1c',
                  border: '1.5px solid #262626',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontSize: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: category
                    ? (category.type === 'custom' && !customCategoryText
                        ? '#e91e8c'
                        : '#fff')
                    : '#666',
                }}
              >
                <span>
                  {category
                    ? (category.type === 'id'
                        ? category.label
                        : (customCategoryText || 'Customize'))
                    : 'Category'}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {categoryOpen && (
                <div style={{
                  position: 'absolute',
                  top: 52, left: 0, right: 0,
                  background: '#1c1c1c',
                  border: '1.5px solid #333',
                  borderRadius: 12,
                  zIndex: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}>
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectCategory(c)}
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        cursor: 'pointer',
                        borderBottom: '1px solid #262626',
                      }}
                    >
                      {c.label}
                    </div>
                  ))}
                  <div
                    onClick={selectCustom}
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#e91e8c',
                      borderTop: '1px solid #333',
                    }}
                  >
                    Customize
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom category input — appears when "Customize" is selected */}
          {showCustomInput && (
            <div style={{ marginBottom: 10 }}>
              <div className="al-fw" style={{
                background: '#1c1c1c',
                border: '1.5px solid #262626',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                transition: 'border-color 0.15s',
              }}>
                <input
                  type="text"
                  placeholder="Type your category and press Enter"
                  value={customCategoryText}
                  onChange={(e) => onCustomCategoryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                  }}
                  style={{
                    flex: 1, minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: '14px 16px',
                    fontSize: 14,
                    color: '#fff',
                    fontFamily: 'inherit',
                  }}
                />
                {customCategoryText.trim().length >= 2 && (
                  <span style={{ paddingRight: 14, flexShrink: 0, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(capFirst(e.target.value))}
              style={{ ...INPUT_BASE, flex: 1, minWidth: 0 }}
            />
            <input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(capFirst(e.target.value))}
              style={{ ...INPUT_BASE, flex: 1, minWidth: 0 }}
            />
          </div>

          {/* Instagram row — IG icon + input, focus-within pink ring */}
          <div className="al-fw" style={{
            background: '#1c1c1c',
            border: '1.5px solid #262626',
            borderRadius: 12,
            padding: '0 16px',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 48,
            transition: 'border-color 0.15s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" fill="#e91e8c" />
              <path d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" fill="#e91e8c" />
              <circle cx="18.406" cy="5.594" r="1.44" fill="#e91e8c" />
            </svg>
            <input
              type="text"
              placeholder="Professional's username"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: '#fff',
                fontFamily: 'inherit',
                padding: 0,
              }}
            />
          </div>
        </div>

        {/* ================== MEDIA ================== */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Media</div>
          </div>

          {/* Empty-state tile — no click handler in Commit A */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1c1c1c',
            border: '1.5px dashed #333',
            borderRadius: 12,
            padding: 24,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <div style={{ fontSize: 11, color: '#666' }}>Upload 1 video OR up to 3 photos</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Vertical works best</div>
          </div>
        </div>

        {/* ================== PRICING (collapses on trial) ================== */}
        <div style={{
          marginBottom: freeTrial ? 0 : 22,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.25s ease, margin-bottom 0.3s ease',
          maxHeight: freeTrial ? 0 : 500,
          opacity: freeTrial ? 0 : 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Pricing</div>
            <div style={{ fontSize: 11, color: '#666' }}>{currency.toUpperCase()} ({symbol})</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <PriceBox
              days={30} value={p30} onInput={onPriceInput(setP30)}
              onFocus={() => setTouched30(false)} onBlur={() => setTouched30(true)}
              perDay={perDay30} symbol={symbol} bad={box30Bad}
            />
            <PriceBox
              days={60} value={p60} onInput={onPriceInput(setP60)}
              onFocus={() => setTouched60(false)} onBlur={() => setTouched60(true)}
              perDay={perDay60} symbol={symbol} bad={box60Bad} offPct={off60}
            />
            <PriceBox
              days={90} value={p90} onInput={onPriceInput(setP90)}
              onFocus={() => setTouched90(false)} onBlur={() => setTouched90(true)}
              perDay={perDay90} symbol={symbol} bad={box90Bad} offPct={off90}
            />
          </div>

          {pricingError && (
            <div style={{ fontSize: 11, color: '#e91e8c', marginTop: 12, textAlign: 'center' }}>
              {pricingError}
            </div>
          )}
        </div>

        {/* ================== FREE TRIAL ================== */}
        <div style={{
          background: '#1c1c1c',
          border: `1.5px solid ${freeTrial ? '#e91e8c' : '#262626'}`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'border-color 0.25s',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Free 30-day trial</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              Listing goes live immediately
            </div>
          </div>
          {/* Toggle — same knob/track math as settings/page.tsx ToggleRow */}
          <div
            onClick={() => setFreeTrial((v) => !v)}
            style={{
              width: 44, height: 24,
              background: freeTrial ? '#e91e8c' : '#262626',
              borderRadius: 12,
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 20, height: 20,
              background: '#fff',
              borderRadius: '50%',
              position: 'absolute',
              top: 2,
              left: freeTrial ? 22 : 2,
              transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* ================== CREATE LISTING ================== */}
        <AmbSubmitButton
          verb="save"
          variant="solid"
          idleLabel="Create listing"
          disabled={submitDisabled}
          onSubmit={noop}
        />
      </div>
    </div>
  )
}

// Pricing box — kept local, rule-of-three hasn't triggered.
function PriceBox({
  days, value, onInput, onFocus, onBlur, perDay, symbol, bad, offPct,
}: {
  days: 30 | 60 | 90
  value: string
  onInput: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: () => void
  perDay: string
  symbol: string
  bad: boolean
  offPct?: number | null
}) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {offPct != null && (
        <div style={{
          display: 'block',
          position: 'absolute',
          top: -10, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          fontSize: 9, fontWeight: 600,
          background: '#e91e8c', color: '#fff',
          padding: '2px 8px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
        }}>
          {offPct}% OFF
        </div>
      )}
      <div style={{
        background: '#1c1c1c',
        border: `1.5px solid ${bad ? '#e91e8c' : '#262626'}`,
        borderRadius: 12,
        padding: 10,
        textAlign: 'center',
        transition: 'border-color 0.15s',
      }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{days} days</div>
        <input
          type="text"
          inputMode="numeric"
          placeholder={symbol}
          value={value}
          onChange={onInput}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 18, fontWeight: 600,
            color: '#fff',
            textAlign: 'center',
            fontFamily: 'inherit',
            padding: 0,
          }}
        />
        <div style={{ fontSize: 11, color: '#666', marginTop: 4, height: 13 }}>
          {perDay ? `${symbol}${perDay}/day` : ''}
        </div>
      </div>
    </div>
  )
}
