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
      .select('role, professional_center_name, user_name, company_name, approval_status, branch_name, preferred_payout_method, profile_photo_url')
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

    // Run parallel queries for better performance
    const queries = []

    // Get pending users count if admin
    let pendingUsersCount = 0
    if (userData.role === USER_ROLES.ADMIN && userData.company_name) {
      queries.push(
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('company_name', userData.company_name)
          .eq('approval_status', 'pending')
          .then(result => ({ type: 'pending', count: result.count || 0 }))
      )
    }

    // Get branch count for the company
    let branchCount = 1
    if (userData.company_name) {
      queries.push(
        supabase
          .from('branches')
          .select('*', { count: 'exact', head: true })
          .eq('company_name', userData.company_name)
          .then(result => ({ type: 'branches', count: result.count || 1 }))
      )
    }

    // Execute all queries in parallel
    if (queries.length > 0) {
      try {
        const results = await Promise.all(queries)
        results.forEach(result => {
          if (result.type === 'pending') pendingUsersCount = result.count
          if (result.type === 'branches') branchCount = result.count
        })
      } catch (error) {
        console.error('❌ [PROXY-PROFILE] Error executing parallel queries:', error)
      }
    }

    // Auto-assign Main Branch if user has no branch and company has only 1 branch
    if (!userData.branch_name && branchCount === 1 && userData.company_name) {
      console.log('🔄 [PROXY-PROFILE] Auto-assigning user to Main Branch for single-branch company')
      try {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ branch_name: 'Main Branch' })
          .eq('id', user.id)
          .select('branch_name')
          .single()

        if (updateError) {
          console.error('❌ [PROXY-PROFILE] Failed to auto-assign branch:', updateError)
        } else {
          console.log('✅ [PROXY-PROFILE] Successfully auto-assigned user to Main Branch')
          userData.branch_name = 'Main Branch'
        }
      } catch (error) {
        console.error('❌ [PROXY-PROFILE] Error auto-assigning branch:', error)
      }
    }

    console.log('✅ [PROXY-PROFILE] Successfully fetched user profile with role:', userData.role)

    return NextResponse.json({
      success: true,
      userData: {
        ...userData,
        companyProfileImage,
        pendingUsersCount,
        branchCount
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
    const { preferred_payout_method, branch_name, instagram_handle, user_name, city } = body

    console.log('📝 [PROFILE-PATCH] Update request:', {
      userId: user.id,
      preferred_payout_method,
      branch_name,
      instagram_handle,
      user_name,
      city
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

    // Validate instagram_handle if provided
    if (instagram_handle !== undefined && instagram_handle !== null) {
      const cleaned = instagram_handle.trim()
      if (cleaned && !/^[a-zA-Z0-9._]+$/.test(cleaned)) {
        return NextResponse.json(
          { error: 'Invalid Instagram username. Only letters, numbers, periods, and underscores allowed.' },
          { status: 400 }
        )
      }
    }

    // Validate user_name if provided
    if (user_name !== undefined && user_name !== null) {
      const cleaned = user_name.trim()
      if (cleaned && cleaned.length < 2) {
        return NextResponse.json(
          { error: 'Display name must be at least 2 characters' },
          { status: 400 }
        )
      }
      if (cleaned && cleaned.length > 100) {
        return NextResponse.json(
          { error: 'Display name must be less than 100 characters' },
          { status: 400 }
        )
      }
    }

    // Update user profile
    const updateData: any = {}
    if (preferred_payout_method !== undefined) {
      updateData.preferred_payout_method = preferred_payout_method
    }
    if (branch_name !== undefined) {
      updateData.branch_name = branch_name
    }
    if (instagram_handle !== undefined) {
      updateData.instagram_handle = instagram_handle
    }
    if (user_name !== undefined) {
      updateData.user_name = user_name.trim()
    }
    if (city !== undefined) {
      updateData.city = city === null ? null : city.trim()
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