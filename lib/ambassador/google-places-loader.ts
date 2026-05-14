/**
 * Google Maps JS SDK lazy-loader (libraries=places)
 *
 * Injects the Maps JS SDK <script> tag once per browser session and resolves
 * a Promise when `google.maps.places` is ready. Idempotent — every caller
 * shares the same in-flight (or already-resolved) load; the script is never
 * injected twice.
 *
 * Used by components/ambassador/PlacesAutocompleteInput.tsx for the
 * dual-behavior Place ID input on the add-listing / edit-listing form.
 *
 * Env dependency: reads NEXT_PUBLIC_GOOGLE_PLACES_API_KEY. Registered
 * OPTIONAL in lib/env-validation.ts — this module is importable without the
 * key and rejects only when load() is actually called. PARTNER ACTION:
 * the value must be added to Vercel (production + preview + development)
 * before client-side autocomplete will function.
 *
 * No SDK wrapper package (@googlemaps/js-api-loader etc.) — raw script-tag
 * injection only.
 *
 * Type note: the SDK is typed here with a hand-rolled minimal interface
 * (GoogleMapsApi) covering only the `places` surface this feature uses,
 * rather than pulling in the @types/google.maps dependency.
 */

// --- Minimal SDK type surface (only what Trust Stack consumes) ---

export interface PlacesAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

export interface AutocompletePlaceResult {
  place_id?: string
  name?: string
  formatted_address?: string
  address_components?: PlacesAddressComponent[]
}

export interface AutocompleteWidget {
  addListener(eventName: string, handler: () => void): void
  getPlace(): AutocompletePlaceResult
}

export interface SearchByTextPlace {
  id?: string
  displayName?: string
  formattedAddress?: string
}

export interface GoogleMapsApi {
  maps: {
    places: {
      Autocomplete: new (
        input: HTMLInputElement,
        opts?: { fields?: string[]; types?: string[] },
      ) => AutocompleteWidget
      Place: {
        searchByText: (request: {
          textQuery: string
          fields: string[]
          maxResultCount?: number
        }) => Promise<{ places: SearchByTextPlace[] }>
      }
    }
    event: {
      clearInstanceListeners(instance: object): void
    }
  }
}

type WindowWithGoogle = Window & { google?: GoogleMapsApi }

const CALLBACK_NAME = '__decodeGooglePlacesReady'

// Module-level singleton — shared across every caller for the page lifetime.
let loadPromise: Promise<GoogleMapsApi> | null = null

export function loadGooglePlaces(): Promise<GoogleMapsApi> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('google-places-loader can only run in the browser'))
      return
    }

    const win = window as WindowWithGoogle

    // Already present (e.g. a prior load this session) — resolve immediately.
    if (win.google?.maps?.places) {
      resolve(win.google)
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      reject(new Error('NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is not set'))
      return
    }

    ;(win as unknown as Record<string, unknown>)[CALLBACK_NAME] = () => {
      delete (win as unknown as Record<string, unknown>)[CALLBACK_NAME]
      if (win.google?.maps?.places) {
        resolve(win.google)
      } else {
        reject(new Error('Google Maps SDK loaded but the places library is missing'))
      }
    }

    const script = document.createElement('script')
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(apiKey)}` +
      '&libraries=places' +
      '&loading=async' +
      `&callback=${CALLBACK_NAME}`
    script.async = true
    script.onerror = () => {
      // Allow a later mount to retry — clear the cached rejected promise.
      loadPromise = null
      delete (win as unknown as Record<string, unknown>)[CALLBACK_NAME]
      reject(new Error('Failed to load the Google Maps SDK script'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
