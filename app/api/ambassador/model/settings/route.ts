import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * PATCH /api/ambassador/model/settings
 *
 * Updates model_profiles and model_professionals fields.
 * Currency is NOT updateable (locked at signup).
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adminClient = createServiceRoleClient()

    // Fetch existing profile
    const { data: profile, error: profileError } = await adminClient
      .from('model_profiles')
      .select('id, professional_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if this is a FormData request (has cover photo) or JSON
    const contentType = request.headers.get('content-type') || ''
    let updates: Record<string, unknown> = {}
    let coverFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      coverFile = formData.get('coverPhoto') as File | null

      const fields = ['firstName', 'lastName', 'tagline', 'instagram', 'isPublished', 'giftsEnabled', 'coverPhotoPositionY']
      for (const field of fields) {
        const val = formData.get(field) as string | null
        if (val !== null) {
          updates[field] = val
        }
      }
    } else {
      const body = await request.json()
      updates = body
    }

    // Build profile update
    const profileUpdate: Record<string, unknown> = {}

    if (updates.firstName !== undefined) {
      const v = String(updates.firstName).trim()
      if (!v || v.length > 50) {
        return NextResponse.json({ error: 'Invalid first name' }, { status: 400 })
      }
      profileUpdate.first_name = v
    }
    if (updates.lastName !== undefined) {
      const v = String(updates.lastName).trim()
      if (!v || v.length > 50) {
        return NextResponse.json({ error: 'Invalid last name' }, { status: 400 })
      }
      profileUpdate.last_name = v
    }
    if (updates.tagline !== undefined) {
      const v = String(updates.tagline).trim()
      if (v.length > 160) {
        return NextResponse.json({ error: 'Tagline too long (max 160)' }, { status: 400 })
      }
      profileUpdate.tagline = v || null
    }
    if (updates.instagram !== undefined) {
      const v = String(updates.instagram).replace(/^@/, '').toLowerCase().trim()
      if (!v) {
        return NextResponse.json({ error: 'Instagram is required' }, { status: 400 })
      }
      profileUpdate.instagram_handle = v

      // Also update model_professionals
      if (profile.professional_id) {
        await adminClient
          .from('model_professionals')
          .update({ instagram_handle: v })
          .eq('id', profile.professional_id)
      }
    }
    if (updates.isPublished !== undefined) {
      profileUpdate.is_published = updates.isPublished === true || updates.isPublished === 'true'
    }
    if (updates.giftsEnabled !== undefined) {
      profileUpdate.gifts_enabled = updates.giftsEnabled === true || updates.giftsEnabled === 'true'
    }
    if (updates.coverPhotoPositionY !== undefined) {
      profileUpdate.cover_photo_position_y = Math.max(0, Math.min(100, parseInt(String(updates.coverPhotoPositionY)) || 50))
    }

    // Handle cover photo upload
    if (coverFile && coverFile.size > 0) {
      const ext = coverFile.type === 'image/png' ? 'png' : coverFile.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${user.id}/cover.${ext}`
      const buffer = Buffer.from(await coverFile.arrayBuffer())

      const { error: uploadError } = await adminClient.storage
        .from('model-media')
        .upload(path, buffer, { contentType: coverFile.type, upsert: true })

      if (!uploadError) {
        const { data: urlData } = adminClient.storage
          .from('model-media')
          .getPublicUrl(path)
        profileUpdate.cover_photo_url = urlData.publicUrl
      }
    }

    // Apply update if anything changed
    if (Object.keys(profileUpdate).length > 0) {
      const { error: updateError } = await adminClient
        .from('model_profiles')
        .update(profileUpdate)
        .eq('id', profile.id)

      if (updateError) {
        console.error('[Ambassador Settings] Update failed:', updateError)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
      }
    }

    // Fetch updated profile
    const { data: updated } = await adminClient
      .from('model_profiles')
      .select('*')
      .eq('id', profile.id)
      .single()

    return NextResponse.json({ success: true, profile: updated })
  } catch (error) {
    console.error('[Ambassador Settings] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

/**
 * DELETE /api/ambassador/model/settings
 *
 * Deletes the ambassador profile and associated data.
 * Blocked if any payment records exist.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adminClient = createServiceRoleClient()

    // Check for payment history (blocks deletion)
    const { count: listingPayments } = await adminClient
      .from('model_listing_payments')
      .select('id', { count: 'exact', head: true })
      .eq('model_profile_id', user.id)

    const { count: wishPayments } = await adminClient
      .from('model_wish_payments')
      .select('id', { count: 'exact', head: true })
      .eq('model_profile_id', user.id)

    if ((listingPayments || 0) + (wishPayments || 0) > 0) {
      return NextResponse.json({
        error: 'Cannot delete account — you have payment history. Please contact support at hello@welovedecode.com',
      }, { status: 409 })
    }

    // Delete in order: analytics → wishes → listings → payouts → profile → professional
    const { data: profile } = await adminClient
      .from('model_profiles')
      .select('id, professional_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Delete analytics events
    await adminClient
      .from('model_analytics_events')
      .delete()
      .eq('model_profile_id', profile.id)

    // Delete wishes
    await adminClient
      .from('model_wishes')
      .delete()
      .eq('model_profile_id', profile.id)

    // Delete listings
    await adminClient
      .from('model_listings')
      .delete()
      .eq('model_profile_id', profile.id)

    // Delete payouts
    await adminClient
      .from('model_payouts')
      .delete()
      .eq('model_profile_id', profile.id)

    // Delete profile
    await adminClient
      .from('model_profiles')
      .delete()
      .eq('id', profile.id)

    // Delete professional if exists
    if (profile.professional_id) {
      await adminClient
        .from('model_professionals')
        .delete()
        .eq('id', profile.professional_id)
    }

    // Delete storage files
    const { data: files } = await adminClient.storage
      .from('model-media')
      .list(user.id)

    if (files?.length) {
      await adminClient.storage
        .from('model-media')
        .remove(files.map(f => `${user.id}/${f.name}`))
    }

    // Sign out
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Ambassador Settings] Delete error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
