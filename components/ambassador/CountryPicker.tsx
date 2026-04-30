'use client'

import { useEffect, useRef, useState } from 'react'
import { COUNTRY_CODES, type CountryCode } from '@/lib/country-codes'
import { POPULAR_IDS } from '@/lib/ambassador/phone-format'
import BackArrow from '@/components/ambassador/BackArrow'

export function CountryPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (c: CountryCode) => void
}) {
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
  }, [open])

  useEffect(() => {
    const trimmed = search.trim()
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
  }, [search])

  if (!open) return null

  const popular = COUNTRY_CODES.filter(c => POPULAR_IDS.includes(c.id))
  const rest = COUNTRY_CODES
    .filter(c => !POPULAR_IDS.includes(c.id))
    .sort((a, b) => a.country.localeCompare(b.country))

  const trimmed = search.trim()
  const isSingleLetter = trimmed.length === 1 && /[a-zA-Z]/.test(trimmed)
  const showFullList = trimmed.length === 0 || isSingleLetter

  const filtered = showFullList
    ? []
    : COUNTRY_CODES
        .filter(c => {
          const q = trimmed.toLowerCase()
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
      <CountryRow key={c.id} country={c} onSelect={() => onSelect(c)} />
    )
  })

  return (
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
        <BackArrow onClick={onClose} />
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
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = '#e91e8c')}
            onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1.5px solid #2a2a2a',
              borderRadius: '12px',
              padding: '0 16px 0 42px',
              fontSize: '16px',
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
              <CountryRow key={c.id} country={c} onSelect={() => onSelect(c)} />
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
            <CountryRow key={c.id} country={c} onSelect={() => onSelect(c)} />
          ))
        )}
      </div>
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
