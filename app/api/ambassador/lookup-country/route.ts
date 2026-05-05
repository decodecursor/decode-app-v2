import { NextRequest, NextResponse } from 'next/server'
import { lookupCountryByCity } from '@/lib/cities/lookup'
import { lookupCountryLimiter } from '@/lib/ambassador/rate-limit'

/**
 * GET /api/ambassador/lookup-country?city=Dubai
 *
 * Resolves a city name to its country DISPLAY NAME (e.g. "United Arab
 * Emirates"). Used by the Add Listing form to auto-fill the Country
 * field on City blur. Open endpoint (matches /check-slug pattern — no
 * auth required during onboarding).
 *
 * Returns:
 *   200 { country: "United Arab Emirates" }   — match
 *   200 { country: null }                      — no match (typo / unknown city). Not an error.
 *   400 { country: null, error: "..." }        — missing param
 *   429 { country: null, error: "..." }        — rate limit
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await lookupCountryLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { country: null, error: 'Too many requests. Please slow down.' },
      { status: 429 },
    )
  }

  const city = request.nextUrl.searchParams.get('city')?.trim()
  if (!city) {
    return NextResponse.json({ country: null, error: 'City is required' }, { status: 400 })
  }

  const country = lookupCountryByCity(city)
  return NextResponse.json({ country })
}
