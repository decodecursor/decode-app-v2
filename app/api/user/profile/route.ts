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
      .select('role, professional_center_name, user_name, company_name, approval_status, branch_name')
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
      // Set default role as User if role is invalid
      userData.role = USER_ROLES.USER
      console.log('✅ [PROXY-PROFILE] Set default role as User for:', user.id)
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