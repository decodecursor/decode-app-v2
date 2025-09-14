import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET user profile data using server-side authentication
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [PROXY-PROFILE] Request received')

    // Get user ID from cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    let userId: string | null = null

    // Look for Supabase session cookies and extract user ID
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`

    // Check if it's a single cookie or chunked
    const singleCookie = allCookies.find(c => c.name === cookieName)
    let sessionData: any = null

    if (singleCookie) {
      try {
        sessionData = JSON.parse(singleCookie.value)
      } catch (e) {
        console.log('Failed to parse single cookie')
      }
    } else {
      // Look for chunked cookies
      const chunks: string[] = []
      let chunkIndex = 0

      while (true) {
        const chunkCookie = allCookies.find(c => c.name === `${cookieName}.${chunkIndex}`)
        if (!chunkCookie) break
        chunks.push(chunkCookie.value)
        chunkIndex++
      }

      if (chunks.length > 0) {
        try {
          const fullSession = chunks.join('')
          sessionData = JSON.parse(fullSession)
        } catch (e) {
          console.log('Failed to parse chunked cookies')
        }
      }
    }

    if (!sessionData || !sessionData.user) {
      console.log('❌ [PROXY-PROFILE] No authenticated user found')
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    userId = sessionData.user.id
    console.log('✅ [PROXY-PROFILE] Found user:', userId)

    // Use service role to query user data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [PROXY-PROFILE] Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Fetch user profile data
    const { data: userData, error } = await supabase
      .from('users')
      .select('role, professional_center_name, user_name, company_name, approval_status, branch_name')
      .eq('id', userId)
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
    if (userData.role === 'Admin' && userData.company_name) {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('company_name', userData.company_name)
        .eq('approval_status', 'pending')

      pendingUsersCount = count || 0
    }

    console.log('✅ [PROXY-PROFILE] Successfully fetched user profile')

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