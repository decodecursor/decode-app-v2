import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log('🚀 [PAYMENT-LINKS-LIST] === REQUEST START ===', timestamp)

  try {
    console.log('🔐 [PAYMENT-LINKS-LIST] Checking authentication...')

    // Use the same working authentication as /api/user/profile
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('❌ [PAYMENT-LINKS-LIST] Authentication failed:', {
        error: authError?.message,
        hasUser: !!user,
        timestamp
      })
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    console.log('✅ [PAYMENT-LINKS-LIST] User authenticated:', user.id)

    const userId = user.id

    console.log('🔧 [PAYMENT-LINKS-LIST] Creating service role client...')
    // Use service role to query data
    const supabaseService = createServiceRoleClient()

    console.log('👤 [PAYMENT-LINKS-LIST] Fetching user profile for role check...')
    // First get user info to determine if admin
    const { data: currentUser, error: userError } = await supabaseService
      .from('users')
      .select('role, company_name')
      .eq('id', userId)
      .single()

    if (userError || !currentUser) {
      console.error('❌ [PAYMENT-LINKS-LIST] Failed to get user profile:', {
        error: userError?.message,
        code: userError?.code,
        details: userError?.details,
        hasCurrentUser: !!currentUser,
        userId,
        timestamp
      })
      return NextResponse.json(
        { error: 'Failed to get user information', details: userError?.message },
        { status: 500 }
      )
    }

    console.log('✅ [PAYMENT-LINKS-LIST] User profile retrieved:', {
      userId,
      role: currentUser.role,
      company: currentUser.company_name
    })

    const isAdmin = currentUser.role === 'Admin'
    const companyName = currentUser.company_name

    console.log('📡 [PAYMENT-LINKS-LIST] Fetching payment links for user:', userId, 'isAdmin:', isAdmin)

    // Fetch payment links WITHOUT the problematic users JOIN
    // Using creator_name field directly from payment_links table
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
        updated_at
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

    console.log('🔍 [PAYMENT-LINKS-LIST] Executing database query...')
    const queryStart = Date.now()
    const { data: paymentLinks, error: linksError } = await query
    const queryTime = Date.now() - queryStart

    console.log('⏱️ [PAYMENT-LINKS-LIST] Query completed in', queryTime, 'ms')

    if (linksError) {
      console.error('❌ [PAYMENT-LINKS-LIST] DATABASE QUERY FAILED:', {
        message: linksError.message,
        details: linksError.details,
        hint: linksError.hint,
        code: linksError.code,
        queryTime,
        isAdmin,
        companyName,
        userId,
        timestamp
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
    // Using creator_name directly from payment_links table (no JOIN needed)
    const formattedLinks = paymentLinks?.map(link => {
      return {
        ...link,
        // Provide creator info using the creator_name field directly
        creator: {
          user_name: link.creator_name || 'Unknown User',
          email: 'user@decode.com' // Placeholder since we don't fetch email anymore
        }
      }
    }) || []

    console.log('✅ [PAYMENT-LINKS-LIST] Formatted', formattedLinks.length, 'payment links')

    const response = {
      success: true,
      paymentLinks: formattedLinks,
      isAdmin,
      companyName
    }

    console.log('🎉 [PAYMENT-LINKS-LIST] === REQUEST SUCCESS ===', {
      linksCount: formattedLinks.length,
      totalTime: Date.now() - new Date(timestamp).getTime(),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('💥 [PAYMENT-LINKS-LIST] === UNHANDLED ERROR ===', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}