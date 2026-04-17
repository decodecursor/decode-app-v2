import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isValidSlug } from '@/lib/ambassador/utils'
import { RESERVED_SLUGS } from '@/lib/ambassador/constants'

/**
 * GET /api/ambassador/model/check-slug?slug=sara_beauty
 *
 * Real-time slug availability check for the onboarding form.
 * Returns { available, suggestion? }
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.toLowerCase().trim()

  if (!slug) {
    return NextResponse.json({ available: false, error: 'Slug is required' }, { status: 400 })
  }

  // Format check
  if (!isValidSlug(slug)) {
    return NextResponse.json({
      available: false,
      error: 'Use 3-30 lowercase letters, numbers, or underscores',
    })
  }

  // Reserved check
  if (RESERVED_SLUGS.includes(slug as any)) {
    return NextResponse.json({
      available: false,
      error: 'This URL is reserved',
      suggestion: `${slug}_beauty`,
    })
  }

  // DB uniqueness check
  const supabase = createServiceRoleClient()
  const { data: existing } = await supabase
    .from('model_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    // Suggest alternative
    const rand = Math.floor(10 + Math.random() * 90)
    return NextResponse.json({
      available: false,
      error: 'This URL is taken',
      suggestion: `${slug}${rand}`,
    })
  }

  return NextResponse.json({ available: true })
}
