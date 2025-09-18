import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { normalizeRole, USER_ROLES, isValidRole } from '@/types/user'

// GET user profile data using server-side authentication
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-PROFILE] Request received')

    // Use standard server client for authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ [PROXY-PROFILE] No authenticated user found')
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    console.log('✅ [PROXY-PROFILE] Found user:', user.id)

    // Fetch user profile data
    const { data: userData, error } = await supabase
      .from('users')
      .select('role, professional_center_name, user_name, company_name, approval_status, branch_name, preferred_payout_method')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('❌ [PROXY-PROFILE] Database query failed:', error)

      // Special handling for no profile found
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'NO_PROFILE', message: 'User profile not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Normalize and validate role
    const normalizedRole = normalizeRole(userData.role)
    if (!normalizedRole) {
      console.error('❌ [PROXY-PROFILE] Invalid user role:', userData.role, 'for user:', user.id)
      // Set default role as Staff if role is invalid
      userData.role = USER_ROLES.STAFF
      console.log('✅ [PROXY-PROFILE] Set default role as Staff for:', user.id)
    } else {
      userData.role = normalizedRole
      console.log('✅ [PROXY-PROFILE] Normalized role:', userData.role, 'for user:', user.id)
    }

    // Fetch company profile image if company exists
    let companyProfileImage = null
    const currentCompanyName = userData.company_name || userData.professional_center_name

    if (currentCompanyName) {
      try {
        const { data: adminWithPhoto } = await supabase
          .from('users')
          .select('profile_photo_url')
          .eq('company_name', currentCompanyName)
          .eq('role', 'Admin')
          .not('profile_photo_url', 'is', null)
          .limit(1)
          .maybeSingle()

        if (adminWithPhoto?.profile_photo_url) {
          companyProfileImage = adminWithPhoto.profile_photo_url
        }
      } catch (error) {
        console.log('Could not fetch company profile image:', error)
      }
    }

    // Get pending users count if admin
    let pendingUsersCount = 0
    if (userData.role === USER_ROLES.ADMIN && userData.company_name) {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('company_name', userData.company_name)
        .eq('approval_status', 'pending')

      pendingUsersCount = count || 0
    }

    console.log('✅ [PROXY-PROFILE] Successfully fetched user profile with role:', userData.role)

    return NextResponse.json({
      success: true,
      userData: {
        ...userData,
        companyProfileImage,
        pendingUsersCount
      }
    })

  } catch (error: any) {
    console.error('💥 [PROXY-PROFILE] Server error:', error)
    return NextResponse.json(
      { error: 'Server error fetching profile', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH - Update user profile data (including preferred payout method)
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔄 [PROFILE-PATCH] Request received')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ [PROFILE-PATCH] No authenticated user found')
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { preferred_payout_method } = body

    console.log('📝 [PROFILE-PATCH] Update request:', {
      userId: user.id,
      preferred_payout_method
    })

    // Validate preferred_payout_method if provided
    if (preferred_payout_method !== undefined &&
        preferred_payout_method !== null &&
        !['bank_account', 'paypal'].includes(preferred_payout_method)) {
      return NextResponse.json(
        { error: 'Invalid preferred_payout_method. Must be "bank_account", "paypal", or null' },
        { status: 400 }
      )
    }

    // Update user profile
    const updateData: any = {}
    if (preferred_payout_method !== undefined) {
      updateData.preferred_payout_method = preferred_payout_method
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ [PROFILE-PATCH] Update failed:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ [PROFILE-PATCH] Profile updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      userData: updatedUser
    })

  } catch (error: any) {
    console.error('💥 [PROFILE-PATCH] Server error:', error)
    return NextResponse.json(
      { error: 'Server error updating profile', details: error.message },
      { status: 500 }
    )
  }
}