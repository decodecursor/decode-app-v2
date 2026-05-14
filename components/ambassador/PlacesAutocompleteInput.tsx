'use client'

/**
 * PlacesAutocompleteInput — dual-behavior Google Place ID picker.
 *
 *   - Type a salon name  → Google Places Autocomplete dropdown; selecting a
 *                          prediction resolves place_id + a display label.
 *   - Paste a Maps URL   → resolved via Places Text Search (searchByText);
 *                          the first result is taken.
 *
 * Used on the add-listing / edit-listing form (components/ambassador/
 * AddListingClient.tsx) to populate model_professionals.google_place_id.
 *
 * SDK: loaded lazily via lib/ambassador/google-places-loader.ts (raw
 * script-tag injection, no wrapper package).
 *
 * Billing-session note (spec §5.1 / Chunk 3 C4): the classic
 * `google.maps.places.Autocomplete` widget manages its own billing session
 * internally — it bundles the autocomplete keystrokes plus the resulting
 * Place Details fetch into a single billable session automatically. There is
 * no `sessionToken` option to thread into the widget (that pattern belongs to
 * the lower-level AutocompleteService + PlacesService APIs). The URL-paste
 * path uses Text Search, which is billed per-call and is not session-scoped.
 * So the session-token billing intent is satisfied by the widget itself; no
 * UUID is threaded manually.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadGooglePlaces,
  type GoogleMapsApi,
  type AutocompleteWidget,
} from '@/lib/ambassador/google-places-loader'

// Mirrors the canonical INPUT_BASE in AddListingClient.tsx. Duplicated
// (not imported) so this component stays standalone — AddListingClient is
// not decomposed in this chunk.
const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  background: '#1c1c1c',
  border: '1.5px solid #262626',
  borderRadius: 12,
  padding: '14px 16px',
  fontSize: 16,
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

// A Google Maps URL — short links (maps.app.goo.gl, goo.gl/maps) or a
// full google.<tld>/maps link.
const MAPS_URL_RE = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|.*\.google\.[^/]+\/maps)/i

const URL_ERROR_LIFETIME_MS = 4000
const FLASH_DURATION_MS = 1200

type SdkState = 'loading' | 'ready' | 'error'

interface Props {
  value: string | null
  displayLabel: string | null
  onChange: (placeId: string | null, displayLabel: string | null) => void
  disabled?: boolean
  className?: string
}

export default function PlacesAutocompleteInput({
  value,
  displayLabel,
  onChange,
  disabled = false,
  className,
}: Props) {
  // 'display' shows the currently-selected place + a "× change" affordance;
  // 'editing' shows the live autocomplete input. Start in display mode when
  // a value is already stored.
  const [mode, setMode] = useState<'display' | 'editing'>(value ? 'display' : 'editing')
  const [sdkState, setSdkState] = useState<SdkState>('loading')
  const [inputText, setInputText] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [resolvingUrl, setResolvingUrl] = useState(false)
  const [flashing, setFlashing] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const googleRef = useRef<GoogleMapsApi | null>(null)
  const autocompleteRef = useRef<AutocompleteWidget | null>(null)
  const urlErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest onChange — kept in a ref so the autocomplete-binding effect does
  // not re-run (and re-create the widget) every render when the parent
  // passes a fresh inline arrow.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // --- Lazy SDK load on mount ---
  useEffect(() => {
    let cancelled = false
    loadGooglePlaces()
      .then((g) => {
        if (cancelled) return
        googleRef.current = g
        setSdkState('ready')
      })
      .catch(() => {
        if (cancelled) return
        setSdkState('error')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    if (urlErrorTimer.current) clearTimeout(urlErrorTimer.current)
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  const triggerFlash = useCallback(() => {
    setFlashing(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashing(false), FLASH_DURATION_MS)
  }, [])

  // Commit a resolved place — shared by the autocomplete + URL-paste paths.
  const handleSelection = useCallback((placeId: string, label: string) => {
    onChangeRef.current(placeId, label)
    setInputText('')
    setUrlError(null)
    setResolvingUrl(false)
    setMode('display')
    triggerFlash()
  }, [triggerFlash])

  const showUrlError = useCallback(() => {
    setResolvingUrl(false)
    setUrlError("Couldn't read that URL — try searching by name")
    if (urlErrorTimer.current) clearTimeout(urlErrorTimer.current)
    urlErrorTimer.current = setTimeout(() => setUrlError(null), URL_ERROR_LIFETIME_MS)
  }, [])

  // Resolve a pasted Maps URL via Places Text Search.
  const resolveFromUrl = useCallback(async (url: string) => {
    const g = googleRef.current
    if (!g) { showUrlError(); return }
    setResolvingUrl(true)
    setUrlError(null)
    try {
      const { places } = await g.maps.places.Place.searchByText({
        textQuery: url,
        fields: ['id', 'displayName', 'formattedAddress'],
        maxResultCount: 1,
      })
      const first = places?.[0]
      if (!first?.id) { showUrlError(); return }
      const label = first.displayName ?? first.formattedAddress ?? 'Selected place'
      handleSelection(first.id, label)
    } catch {
      showUrlError()
    }
  }, [handleSelection, showUrlError])

  // --- Bind the autocomplete widget while editing ---
  useEffect(() => {
    if (sdkState !== 'ready' || mode !== 'editing' || disabled) return
    const g = googleRef.current
    const inputEl = inputRef.current
    if (!g || !inputEl) return

    const widget = new g.maps.places.Autocomplete(inputEl, {
      fields: ['place_id', 'name', 'address_components', 'formatted_address'],
      types: ['establishment'],
    })
    autocompleteRef.current = widget

    widget.addListener('place_changed', () => {
      const place = widget.getPlace()
      if (!place.place_id) return
      const locality = place.address_components?.find((c) =>
        c.types.includes('locality'),
      )?.long_name
      const name = place.name ?? place.formatted_address ?? 'Selected place'
      const label = locality ? `${name}, ${locality}` : name
      handleSelection(place.place_id, label)
    })

    return () => {
      if (googleRef.current && autocompleteRef.current) {
        googleRef.current.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      autocompleteRef.current = null
    }
  }, [sdkState, mode, disabled, handleSelection])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setInputText(next)
    if (MAPS_URL_RE.test(next.trim())) {
      // Pasted a Maps URL — suppress the (irrelevant) autocomplete results
      // for this value and resolve via Text Search instead.
      void resolveFromUrl(next.trim())
    }
  }

  const clearSelection = () => {
    onChangeRef.current(null, null)
    setInputText('')
    setUrlError(null)
    setMode('editing')
  }

  // --- Render: external disabled (caller-locked) ---
  // The caller renders a LockedTextField for non-creators, so this branch is
  // a defensive fallback only.
  if (disabled) {
    return (
      <input
        type="text"
        readOnly
        disabled
        value={displayLabel ?? (value ? 'Place selected' : '')}
        placeholder="Search by name or paste Maps URL"
        className={className}
        style={{ ...INPUT_BASE, color: '#666', cursor: 'not-allowed' }}
      />
    )
  }

  // --- Render: display mode (a place is selected) ---
  if (mode === 'display') {
    return (
      <div
        className={className}
        style={{
          ...INPUT_BASE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          animation: flashing ? 'row-saved-flash 1.2s ease' : undefined,
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel ?? 'Selected (cache pending)'}
        </span>
        <button
          type="button"
          onClick={clearSelection}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          × change
        </button>
      </div>
    )
  }

  // --- Render: editing mode ---
  const placeholder =
    sdkState === 'loading'
      ? 'Loading…'
      : sdkState === 'error'
        ? 'Autocomplete unavailable'
        : 'Search by name or paste Maps URL'

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={onInputChange}
        disabled={sdkState !== 'ready'}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          ...INPUT_BASE,
          color: sdkState === 'ready' ? '#fff' : '#666',
          cursor: sdkState === 'ready' ? 'text' : 'not-allowed',
          animation: flashing ? 'row-saved-flash 1.2s ease' : undefined,
        }}
      />
      {resolvingUrl && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 6, paddingLeft: 4 }}>
          Reading URL…
        </div>
      )}
      {urlError && (
        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, paddingLeft: 4 }}>
          {urlError}
        </div>
      )}
      {sdkState === 'error' && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 6, paddingLeft: 4 }}>
          Place lookup needs NEXT_PUBLIC_GOOGLE_PLACES_API_KEY configured in the
          deployment environment.
        </div>
      )}
    </div>
  )
}
