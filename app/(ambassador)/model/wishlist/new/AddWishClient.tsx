'use client'

/**
 * Add Wish form (Slice 5A-2). Single-page form per spec — no progress
 * tracker, simpler than Add Listing's 4-step flow.
 *
 * Spec: add_wish_final_UI_Spec.md.
 * Mockup: add_wish_final.html (authoritative visual truth).
 *
 * Schema vs. spec: spec mentions Instagram + avatar fields for the
 * professional, but neither column exists on model_wishes (only
 * gifter_instagram exists, populated by the gifter checkout flow).
 * Building to schema + mockup per Slice 5A locked decision A.
 *
 * Persisted shape per schema:
 *   service_name (text, free-form — no FK)
 *   professional_name (text)
 *   professional_city (text)
 *   professional_country (text)
 *   price (numeric, > 0)
 *   currency (text, snapshot from model_profiles.currency)
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  capFirst,
  currencySymbol,
  priceFloorForCurrency,
} from '@/lib/ambassador/add-listing-helpers'

type Category = { id: string; label: string; slug: string }
type ServiceSelection = { type: 'category'; label: string } | { type: 'custom'; text: string } | null

interface Props {
  categories: Category[]
  currency: string
}

export default function AddWishClient({ categories, currency }: Props) {
  const router = useRouter()

  const [service, setService] = useState<ServiceSelection>(null)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const [proName, setProName] = useState('')
  const [proCity, setProCity] = useState('')
  const [proCountry, setProCountry] = useState('')
  const [price, setPrice] = useState<string>('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'creating' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!serviceOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServiceOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [serviceOpen])

  const symbol = currencySymbol(currency)
  const floor = priceFloorForCurrency(currency)

  const priceNum = price === '' ? null : Number(price)
  const priceValid = priceNum !== null && Number.isFinite(priceNum) && priceNum >= floor
  // Price error wording matches mockup: distinguish exactly-zero from
  // below-floor cases (mockup updatePriceUI lines 282-297).
  const priceError =
    priceTouched && price === '0'
      ? 'Price must be greater than 0'
      : priceTouched && price !== '' && !priceValid
        ? `Minimum ${symbol}${floor}`
        : null

  // Service is valid if: a category is selected OR custom text has
  // ≥ 2 chars (matches mockup live-validation at line 251 + the
  // CTA-validity check at line 305-307).
  const customLive = customText.trim()
  const customLiveValid = customLive.length >= 2
  const serviceValid =
    (service?.type === 'category' && !!service.label) ||
    (service?.type === 'custom' && customLiveValid)

  const formValid =
    serviceValid &&
    proName.trim().length > 0 &&
    proCity.trim().length > 0 &&
    proCountry.trim().length > 0 &&
    priceValid

  const handleSelectCategory = (label: string) => {
    setService({ type: 'category', label })
    setServiceOpen(false)
    setCustomText('')
  }

  const handleSelectCustomize = () => {
    setService({ type: 'custom', text: '' })
    setServiceOpen(false)
  }

  const onSubmit = async () => {
    if (!formValid || submitting) return
    const serviceName =
      service?.type === 'category' ? service.label
      : service?.type === 'custom' ? customText.trim()
      : ''

    setSubmitting(true)
    setSubmitState('creating')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/ambassador/model/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: serviceName,
          professional_name: proName.trim(),
          professional_city: proCity.trim(),
          professional_country: proCountry.trim(),
          price: priceNum,
        }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSubmitState('error')
        setErrorMsg(body?.error ?? `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }

      setSubmitState('success')
      // Brief success flash then redirect (mirrors Add Listing pattern).
      setTimeout(() => {
        router.push(`/model/wishlist?created=${body?.wish?.id ?? ''}`)
      }, 600)
    } catch (err) {
      setSubmitState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Network error')
      setSubmitting(false)
    }
  }

  // CTA visual states match mockup #cw_createBtn (lines 14-19):
  //   default → grey-on-dark, no border-color shift, cursor:default
  //   ready   → pink, white, cursor:pointer, hover:brightness, active:scale
  //   working → pink, white, cursor:default, "Creating…"
  //   success → pink (NOT green), white, cursor:default, "Wish created!"
  const ctaState: 'default' | 'ready' | 'working' | 'success' =
    submitState === 'success' ? 'success'
    : submitState === 'creating' ? 'working'
    : formValid && !submitting ? 'ready'
    : 'default'
  const ctaLabel =
    ctaState === 'working' ? 'Creating…'
    : ctaState === 'success' ? 'Wish created!'
    : 'Create wish'

  // Service label color logic matches mockup cwSelectTreat + cwCustomCheck:
  //   "Select" placeholder → grey
  //   "Customize" picked but text not yet ≥ 2 chars → pink (live transition cue)
  //   Custom text ≥ 2 chars OR category picked → white (committed)
  const serviceLabel =
    service?.type === 'category' ? service.label
    : service?.type === 'custom' && customLiveValid ? customLive
    : service?.type === 'custom' ? 'Customize'
    : 'Select'
  const serviceLabelColor =
    serviceLabel === 'Select' ? '#666'
    : service?.type === 'custom' && !customLiveValid ? '#e91e8c'
    : '#fff'

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      {/* Inline page-scoped CSS for :focus-within (price box) and the
          ready-state hover/active polish on the CTA — inline-style React
          can't express these. Pattern matches the mockup's <style> block
          at lines 8-19. */}
      <style>{`
        #cw_priceBox.cw-focusable:focus-within { border-color: #e91e8c !important; transition: border-color 0.15s }
        #cw_createBtn.cw-ready:hover { filter: brightness(1.08) }
        #cw_createBtn.cw-ready:active { transform: scale(0.99) }
        #cw_createBtn { transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.05s }
      `}</style>

      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', minHeight: '100vh' }}>
        {/* Header — back arrow */}
        <div style={{ padding: '14px 20px 0' }}>
          <div
            onClick={() => router.back()}
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
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 6 }}>Add wish</div>
          <div style={{ fontSize: 11, color: '#888' }}>Service you want as a gift</div>
        </div>

        {/* Form */}
        <div style={{ padding: '0 20px 10px' }}>
          {/* Service dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: 10 }}>
            <div
              onClick={() => setServiceOpen((v) => !v)}
              style={{
                background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                padding: '14px 16px', fontSize: 14, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
              }}
            >
              <span style={{ color: serviceLabelColor }}>{serviceLabel}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: serviceOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s ease' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {serviceOpen && (
              <div style={{
                position: 'absolute', top: 54, left: 0, right: 0,
                background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                zIndex: 10, maxHeight: 220, overflowY: 'auto',
              }}>
                {categories.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCategory(c.label)}
                    style={{ padding: '12px 16px', fontSize: 13, color: '#fff', cursor: 'pointer', borderBottom: '1px solid #262626' }}
                  >
                    {c.label}
                  </div>
                ))}
                {/* Customize entry: pink, top-bordered separator (matches
                    mockup line 129 — border-top instead of -bottom). */}
                <div
                  onClick={handleSelectCustomize}
                  style={{ padding: '12px 16px', fontSize: 13, color: '#e91e8c', cursor: 'pointer', borderTop: '1px solid #262626' }}
                >
                  Customize
                </div>
              </div>
            )}
          </div>

          {/* Custom service input — revealed when Customize selected.
              Green check appears live at ≥ 2 chars (matches mockup
              cwCustomCheck line 251). No explicit commit gesture needed. */}
          {service?.type === 'custom' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                display: 'flex', alignItems: 'center',
              }}>
                <input
                  value={customText}
                  onChange={(e) => setCustomText(capFirst(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
                  type="text"
                  placeholder="Type your service and press Enter"
                  style={{
                    flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                    padding: '14px 16px', fontSize: 14, color: '#fff', outline: 'none',
                  }}
                />
                {customLiveValid && (
                  <span style={{ paddingRight: 14, flexShrink: 0, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Professional name */}
          <input
            value={proName}
            onChange={(e) => setProName(capFirst(e.target.value))}
            type="text"
            placeholder="Salon, clinic or professional"
            style={{
              width: '100%', background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
              padding: '14px 16px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box',
              marginBottom: 10,
            }}
          />

          {/* City + Country side-by-side */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={proCity}
              onChange={(e) => setProCity(capFirst(e.target.value))}
              type="text"
              placeholder="City"
              style={{
                flex: 1, minWidth: 0, background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                padding: '14px 16px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <input
              value={proCountry}
              onChange={(e) => setProCountry(capFirst(e.target.value))}
              type="text"
              placeholder="Country"
              style={{
                flex: 1, minWidth: 0, background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                padding: '14px 16px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Price box. id + class enable the inline-CSS :focus-within
              pink border ring (matches mockup line 11). Error state
              still wins via inline border-color override below. */}
          <div
            id="cw_priceBox"
            className="cw-focusable"
            onClick={() => document.getElementById('cw_price')?.focus()}
            style={{
              background: '#1c1c1c', border: `1.5px solid ${priceError ? '#e91e8c' : '#262626'}`, borderRadius: 12,
              padding: 12, textAlign: 'center', cursor: 'text',
            }}
          >
            <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Price</div>
            <input
              id="cw_price"
              value={price ? `${symbol}${price}` : ''}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => setPriceTouched(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              inputMode="numeric"
              placeholder={symbol}
              style={{
                width: '100%', background: 'transparent', border: 'none',
                fontSize: 18, fontWeight: 700, color: '#fff', textAlign: 'center', outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 4, minHeight: 13 }}>
              {currency.toUpperCase()} ({symbol})
            </div>
          </div>
          {priceError && (
            <div style={{ fontSize: 11, color: '#e91e8c', marginTop: 12, textAlign: 'center' }}>
              {priceError}
            </div>
          )}
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div style={{ padding: '0 20px 10px' }}>
            <div style={{
              background: 'rgba(233,30,140,0.08)', border: '1px solid rgba(233,30,140,0.25)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#e91e8c', textAlign: 'center',
            }}>
              {errorMsg}
            </div>
          </div>
        )}

        {/* CTA — class drives the inline-CSS :hover/:active polish; */}
        {/* inline style sets the per-state colors. Success stays pink */}
        {/* per mockup (NOT green — earlier draft used #4ade80; corrected). */}
        <div style={{ padding: '10px 20px 22px' }}>
          <button
            id="cw_createBtn"
            className={ctaState === 'ready' ? 'cw-ready' : ''}
            onClick={onSubmit}
            disabled={ctaState !== 'ready'}
            style={{
              width: '100%',
              background: ctaState === 'default' ? '#1c1c1c' : '#e91e8c',
              border: ctaState === 'default' ? '1px solid #262626' : '1px solid #e91e8c',
              borderRadius: 12, padding: 16, textAlign: 'center', fontSize: 15, fontWeight: 700,
              color: ctaState === 'default' ? '#555' : '#fff',
              letterSpacing: '0.2px',
              cursor: ctaState === 'ready' ? 'pointer' : 'default',
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
