import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    // Use the same working authentication as /api/user/profile
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Use service role to query data
    const supabaseService = createServiceRoleClient()

    // First get user info to determine if admin
    const { data: currentUser, error: userError } = await supabaseService
      .from('users')
      .select('role, company_name')
      .eq('id', userId)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 500 }
      )
    }

    const isAdmin = currentUser.role === 'Admin'
    const companyName = currentUser.company_name

    console.log('📡 [PAYMENT-LINKS-LIST] Fetching payment links for user:', userId, 'isAdmin:', isAdmin)

    // Fetch payment links based on role
    // Use LEFT JOIN to handle missing user references gracefully
    let query = supabaseService
      .from('payment_links')
      .select(`
        id,
        title,
        description,
        amount_aed,
        service_amount_aed,
        decode_amount_aed,
        total_amount_aed,
        client_name,
        creator_id,
        expiration_date,
        is_active,
        payment_status,
        paid_at,
        is_paid,
        branch_name,
        creator_name,
        created_at,
        updated_at,
        users (
          user_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    // Admins see all company links, users see only their own
    if (isAdmin && companyName) {
      console.log('📡 [PAYMENT-LINKS-LIST] Admin user, fetching company links for:', companyName)
      // Get all users from the company
      const { data: companyUsers } = await supabaseService
        .from('users')
        .select('id')
        .eq('company_name', companyName)

      const companyUserIds = companyUsers?.map(u => u.id) || []
      console.log('📡 [PAYMENT-LINKS-LIST] Found company user IDs:', companyUserIds.length)
      if (companyUserIds.length > 0) {
        query = query.in('creator_id', companyUserIds)
      }
    } else {
      console.log('📡 [PAYMENT-LINKS-LIST] Regular user, fetching own links only')
      query = query.eq('creator_id', userId)
    }

    const { data: paymentLinks, error: linksError } = await query

    if (linksError) {
      console.error('❌ [PAYMENT-LINKS-LIST] Database query error:', linksError)
      console.error('❌ [PAYMENT-LINKS-LIST] Error details:', {
        message: linksError.message,
        details: linksError.details,
        hint: linksError.hint,
        code: linksError.code
      })

      // Try to provide more specific error information
      if (linksError.message?.includes('foreign key') || linksError.code === 'PGRST116') {
        console.error('❌ [PAYMENT-LINKS-LIST] Foreign key constraint issue detected')
        return NextResponse.json(
          { error: 'Database integrity issue with user references. Please contact support.' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch payment links', details: linksError.message },
        { status: 500 }
      )
    }

    console.log('✅ [PAYMENT-LINKS-LIST] Successfully fetched', paymentLinks?.length || 0, 'payment links')

    // Format the response to match what the frontend expects
    // Handle cases where creator might be deleted (users field is null)
    const formattedLinks = paymentLinks?.map(link => {
      // Handle both array and single object returns from Supabase users relationship
      // TypeScript sees this as potentially an array, so we need safe access
      const userRecord = Array.isArray(link.users) ? link.users[0] : link.users
      const hasValidUser = userRecord && userRecord.user_name

      if (!hasValidUser) {
        console.log('⚠️ [PAYMENT-LINKS-LIST] Missing user reference for payment link:', link.id, 'creator_id:', link.creator_id)
      }

      return {
        ...link,
        creator: userRecord || {
          user_name: link.creator_name || 'Deleted User',
          email: 'deleted@user.com'
        }
      }
    }) || []

    console.log('✅ [PAYMENT-LINKS-LIST] Formatted', formattedLinks.length, 'payment links')

    return NextResponse.json({
      success: true,
      paymentLinks: formattedLinks,
      isAdmin,
      companyName
    })

  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}