import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  detectImageType,
  extForType,
  mimeForType,
  MAX_COVER_PHOTO_BYTES,
} from '@/lib/ambassador/image-validation'
import {
  COVER_BUCKET,
  buildCoverObjectPath,
  extractCoverObjectPath,
} from '@/lib/ambassador/storage'
import { isValidInstagramHandle } from '@/lib/ambassador/validators'

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

    // Fetch existing profile (need cover_photo_url so we can delete the old object after replacement)
    const { data: profile } = await adminClient
      .from('model_profiles')
      .select('id, cover_photo_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile) {
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
    let pendingInstagram: string | null = null

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
    // Instagram lives on users, not model_profiles — validate now, write AFTER profile update
    if (updates.instagram !== undefined) {
      const v = String(updates.instagram).replace(/^@/, '').toLowerCase().trim()
      if (!isValidInstagramHandle(v)) {
        return NextResponse.json({ error: 'Invalid Instagram handle' }, { status: 400 })
      }
      pendingInstagram = v
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

    // Handle cover photo upload — magic-byte sniff + size cap, hard-fail on errors.
    // Uploads to a unique path so the public URL changes, defeating browser cache.
    // The previous object is deleted after the DB update succeeds (best-effort).
    let oldCoverPathToDelete: string | null = null
    if (coverFile && coverFile.size > 0) {
      if (coverFile.size > MAX_COVER_PHOTO_BYTES) {
        return NextResponse.json({ error: 'Cover photo too large (max 5 MB)' }, { status: 400 })
      }
      const buffer = Buffer.from(await coverFile.arrayBuffer())
      const sniffed = detectImageType(buffer)
      if (!sniffed) {
        return NextResponse.json({ error: 'Cover photo must be JPEG, PNG, or WebP' }, { status: 400 })
      }
      const path = buildCoverObjectPath(user.id, extForType(sniffed))

      const { error: uploadError } = await adminClient.storage
        .from(COVER_BUCKET)
        .upload(path, buffer, { contentType: mimeForType(sniffed) })

      if (uploadError) {
        console.error('[Ambassador Settings] Cover upload failed:', uploadError)
        return NextResponse.json({ error: 'Cover photo upload failed' }, { status: 400 })
      }
      const { data: urlData } = adminClient.storage
        .from(COVER_BUCKET)
        .getPublicUrl(path)
      profileUpdate.cover_photo_url = urlData.publicUrl
      oldCoverPathToDelete = extractCoverObjectPath(profile.cover_photo_url)
    }

    // Handle cover photo remove (JSON-path only — multipart uploads can't also signal remove)
    if (updates.removeCoverPhoto === true && profile.cover_photo_url) {
      profileUpdate.cover_photo_url = null
      profileUpdate.cover_photo_position_y = 50
      oldCoverPathToDelete = extractCoverObjectPath(profile.cover_photo_url)
    }

    // Apply profile update first
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

    // Best-effort cleanup of the previous cover object — new cover is already live in the DB.
    if (oldCoverPathToDelete) {
      try {
        const { error: removeError } = await adminClient.storage
          .from(COVER_BUCKET)
          .remove([oldCoverPathToDelete])
        if (removeError) {
          console.warn('[Ambassador Settings] Old cover delete failed (non-fatal):', removeError)
        }
      } catch (err) {
        console.warn('[Ambassador Settings] Old cover delete threw (non-fatal):', err)
      }
    }

    // Instagram update fires AFTER profile update — if profile failed above, IG is untouched
    if (pendingInstagram !== null) {
      const { error: igError } = await adminClient
        .from('users')
        .update({ instagram_handle: pendingInstagram })
        .eq('id', user.id)
      if (igError) {
        console.error('[Ambassador Settings] Instagram update failed:', igError)
        return NextResponse.json({ error: 'Failed to update Instagram' }, { status: 500 })
      }
    }

    // Fetch updated profile + merge users.instagram_handle for client display
    const { data: updated } = await adminClient
      .from('model_profiles')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle()

    const { data: userRow } = await adminClient
      .from('users')
      .select('instagram_handle')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      profile: { ...updated, instagram_handle: userRow?.instagram_handle ?? null },
    })
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

    // Fetch profile first so we can key child-table queries on profile.id
    const { data: profile } = await adminClient
      .from('model_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check for payment history (blocks deletion)
    const { count: listingPayments } = await adminClient
      .from('model_listing_payments')
      .select('id', { count: 'exact', head: true })
      .eq('model_id', profile.id)

    const { count: wishPayments } = await adminClient
      .from('model_wish_payments')
      .select('id', { count: 'exact', head: true })
      .eq('model_id', profile.id)

    if ((listingPayments || 0) + (wishPayments || 0) > 0) {
      return NextResponse.json({
        error: 'Cannot delete account — you have payment history. Please contact support at hello@welovedecode.com',
      }, { status: 409 })
    }

    // Atomic cascade-delete via SECURITY DEFINER function
    const { error: cascadeError } = await adminClient.rpc('delete_model_profile_cascade', {
      p_user_id: user.id,
    })

    if (cascadeError) {
      console.error('[Ambassador Settings] Cascade delete failed:', cascadeError)
      return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
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
