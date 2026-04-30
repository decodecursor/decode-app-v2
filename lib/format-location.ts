// Country display-name shortener for DECODE's active markets.
// Anything not in the map passes through unchanged.
// Add entries as new ambassador markets are onboarded.
const COUNTRY_SHORT: Record<string, string> = {
  'United Arab Emirates': 'UAE',
  'United Kingdom': 'UK',
  'United States': 'USA',
  'Saudi Arabia': 'KSA',
}

export function shortenCountry(country: string | null | undefined): string {
  if (!country) return ''
  return COUNTRY_SHORT[country] ?? country
}

export function formatLocation(
  city: string | null | undefined,
  country: string | null | undefined,
): string {
  const c = (city ?? '').trim()
  const k = shortenCountry(country).trim()
  if (c && k) return `${c}, ${k}`
  return c || k
}
