import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isValidSlug } from '@/lib/ambassador/utils'
import { RESERVED_SLUGS } from '@/lib/ambassador/constants'

/**
 * POST /api/ambassador/model/setup
 *
 * Creates the model_profiles row during onboarding.
 * model_professionals is NOT created here — that's for listing creation (Slice 2).
 * Requires authenticated session.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Parse form data (supports cover photo upload)
    const formData = await request.formData()
    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const slug = (formData.get('slug') as string)?.toLowerCase().trim()
    const instagram = (formData.get('instagram') as string)?.replace(/^@/, '').toLowerCase().trim()
    const currency = (formData.get('currency') as string)?.toLowerCase().trim()
    const coverPhotoPositionY = parseInt(formData.get('coverPhotoPositionY') as string) || 50
    const coverPhoto = formData.get('coverPhoto') as File | null

    // Validate required fields
    if (!firstName || !lastName || !slug || !instagram || !currency) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (firstName.length > 50 || lastName.length > 50) {
      return NextResponse.json({ error: 'Name too long (max 50 characters)' }, { status: 400 })
    }
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }
    if (RESERVED_SLUGS.includes(slug as any)) {
      return NextResponse.json({ error: 'This URL is reserved' }, { status: 400 })
    }

    const adminClient = createServiceRoleClient()

    // Check slug uniqueness
    const { data: existingSlug } = await adminClient
      .from('model_profiles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingSlug) {
      return NextResponse.json({ error: 'This URL is already taken' }, { status: 409 })
    }

    // Check if profile already exists (prevent double-submit)
    const { data: existingProfile } = await adminClient
      .from('model_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'Profile already exists', redirect: '/model' }, { status: 409 })
    }

    // Handle cover photo upload
    let coverPhotoUrl: string | null = null
    if (coverPhoto && coverPhoto.size > 0) {
      const ext = coverPhoto.type === 'image/png' ? 'png' : coverPhoto.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${user.id}/cover.${ext}`
      const buffer = Buffer.from(await coverPhoto.arrayBuffer())

      const { error: uploadError } = await adminClient.storage
        .from('model-media')
        .upload(path, buffer, {
          contentType: coverPhoto.type,
          upsert: true,
        })

      if (uploadError) {
        console.error('[Ambassador Setup] Cover upload failed:', uploadError)
        // Non-blocking: continue without cover photo
      } else {
        const { data: urlData } = adminClient.storage
          .from('model-media')
          .getPublicUrl(path)
        coverPhotoUrl = urlData.publicUrl
      }
    }

    // Create model_profiles row
    const { data: profile, error: profileError } = await adminClient
      .from('model_profiles')
      .insert({
        user_id: user.id,
        slug,
        first_name: firstName,
        last_name: lastName,
        currency,
        cover_photo_url: coverPhotoUrl,
        cover_photo_position_y: coverPhotoPositionY,
        is_published: true,
        gifts_enabled: false,
        is_suspended: false,
      })
      .select('id, slug')
      .single()

    if (profileError) {
      console.error('[Ambassador Setup] Profile create failed:', profileError)
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    console.log('[Ambassador Setup] Profile created:', profile.slug)

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('[Ambassador Setup] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
