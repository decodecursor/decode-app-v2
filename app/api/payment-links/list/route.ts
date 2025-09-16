import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // First get user info to determine if admin
    const { data: currentUser, error: userError } = await supabase
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

    // Fetch payment links based on role
    let query = supabase
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
        users!payment_links_creator_id_fkey (
          user_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    // Admins see all company links, users see only their own
    if (isAdmin && companyName) {
      // Get all users from the company
      const { data: companyUsers } = await supabase
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
      console.error('Error fetching payment links:', linksError)
      return NextResponse.json(
        { error: 'Failed to fetch payment links' },
        { status: 500 }
      )
    }

    // Format the response to match what the frontend expects
    const formattedLinks = paymentLinks?.map(link => ({
      ...link,
      creator: link.users || { user_name: null, email: '' }
    })) || []

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