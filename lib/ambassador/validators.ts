// Instagram handle: 1-30 chars, lowercase letters, digits, underscore, dot.
// Caller is expected to have stripped any leading "@" and lowercased.
export function isValidInstagramHandle(handle: string): boolean {
  return handle.length > 0 && handle.length <= 30 && /^[a-z0-9_.]+$/.test(handle)
}

// E.164 phone number: leading "+", a non-zero first digit, 7-15 digits total.
// Used for the Trust Stack WhatsApp number field (client + API in lockstep).
export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value)
}

// Google Place ID: opaque alphanumeric token (letters, digits, "_" and "-"),
// minimum 10 chars. Shape check only — actual existence is verified by the
// Places API call downstream.
export function isValidGooglePlaceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,}$/.test(value)
}
