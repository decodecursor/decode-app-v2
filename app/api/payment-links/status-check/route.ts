import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    // Use the same working authentication as other proxy endpoints
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

    // Fetch only payment status fields for efficiency
    let query = supabaseService
      .from('payment_links')
      .select('id, payment_status, is_paid, paid_at, is_active')
      .order('updated_at', { ascending: false })

    // Admins see all company links, users see only their own
    if (isAdmin && companyName) {
      // Get all users from the company
      const { data: companyUsers } = await supabaseService
        .from('users')
        .select('id')
        .eq('company_name', companyName)

      const companyUserIds = companyUsers?.map(u => u.id) || []
      if (companyUserIds.length > 0) {
        query = query.in('creator_id', companyUserIds)
      }
    } else {
      query = query.eq('creator_id', userId)
    }

    const { data: paymentLinks, error: linksError } = await query

    if (linksError) {
      console.error('Error fetching payment status:', linksError)
      return NextResponse.json(
        { error: 'Failed to fetch payment status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentStatus: paymentLinks || [],
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Server error in status-check:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}