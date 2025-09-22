import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { USER_ROLES } from '@/types/user'

export async function GET(request: NextRequest) {
  try {
    // Use the same authentication pattern as other endpoints
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

    // First, get the current user's profile to check role and company
    const { data: userProfile, error: profileError } = await supabaseService
      .from('user_profiles')
      .select('role, company_name, professional_center_name')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    // Check if user is ADMIN
    if (userProfile.role !== USER_ROLES.ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admin users can access company-wide analytics' },
        { status: 403 }
      )
    }

    // Get company name (prioritize company_name over professional_center_name)
    const companyName = userProfile.company_name || userProfile.professional_center_name

    if (!companyName) {
      return NextResponse.json(
        { error: 'No company name found for user' },
        { status: 400 }
      )
    }

    // Get all users in the same company
    const { data: companyUsers, error: usersError } = await supabaseService
      .from('user_profiles')
      .select('id')
      .or(`company_name.eq.${companyName},professional_center_name.eq.${companyName}`)

    if (usersError) {
      console.error('Error fetching company users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch company users' },
        { status: 500 }
      )
    }

    const companyUserIds = (companyUsers || []).map(u => u.id)

    if (companyUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        paymentLinks: [],
        transactions: [],
        stats: {
          totalRevenue: 0,
          activeLinks: 0,
          totalTransactions: 0,
          successfulPayments: 0,
          averagePayment: 0,
          thisMonth: {
            revenue: 0,
            transactions: 0
          }
        }
      })
    }

    // Fetch all payment links for company users (including both paid and unpaid)
    const { data: linksData, error: linksError } = await supabaseService
      .from('payment_links')
      .select(`
        id,
        title,
        description,
        amount_aed,
        service_amount_aed,
        client_name,
        creator_id,
        expiration_date,
        is_active,
        created_at,
        paid_at,
        company_name,
        branch_name,
        creator_name,
        payment_status,
        creator:creator_id (
          user_name,
          email
        ),
        transactions (
          id,
          amount_aed,
          status,
          created_at,
          completed_at
        )
      `)
      .in('creator_id', companyUserIds)
      .order('created_at', { ascending: false })

    if (linksError) {
      console.error('Payment links query failed:', linksError)
      return NextResponse.json(
        { error: 'Failed to fetch payment links' },
        { status: 500 }
      )
    }

    // Process payment links
    const allProcessedLinks = (linksData || []).map((link: any) => {
      const transactions = link.transactions || []
      const completedTransactions = transactions.filter((t: any) => t.status === 'completed')

      return {
        ...link,
        creator: Array.isArray(link.creator) ? (link.creator[0] || { user_name: null, email: '' }) : (link.creator || { user_name: null, email: '' }),
        transaction_count: completedTransactions.length,
        total_revenue: completedTransactions.reduce((sum: number, t: any) => sum + (t.amount_aed || 0), 0)
      }
    })

    // Filter for paid payment links for the "Paid PayLinks" section
    const paidLinksOnly = allProcessedLinks.filter(link => link.paid_at && link.payment_status === 'paid')

    // Fetch transactions for these payment links
    let transactionsData: any[] = []
    if (allProcessedLinks.length > 0) {
      const { data } = await supabaseService
        .from('transactions')
        .select(`
          id,
          amount_aed,
          status,
          created_at,
          completed_at,
          payment_link:payment_link_id (
            title,
            amount_aed,
            client_name
          )
        `)
        .in('payment_link_id', allProcessedLinks.map((link: any) => link.id))
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      transactionsData = data || []
    }

    const processedTransactions = (transactionsData || [])
      .filter(t => t.payment_link)
      .map(t => ({
        ...t,
        payment_link: Array.isArray(t.payment_link) ? (t.payment_link[0] || { title: '', amount_aed: 0 }) : (t.payment_link || { title: '', amount_aed: 0 })
      }))

    // Calculate company-wide stats
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonthTransactions = processedTransactions.filter(t =>
      new Date(t.completed_at || t.created_at) >= thisMonthStart
    )

    // Calculate stats based on service amounts (staff portion) for revenue
    const totalRevenue = paidLinksOnly.reduce((sum, link) => {
      const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91) // Use service amount or calculate 91% of total
      return sum + serviceAmount
    }, 0)

    const stats = {
      totalRevenue,
      activeLinks: allProcessedLinks.filter((link: any) => link.is_active).length,
      totalTransactions: processedTransactions.length,
      successfulPayments: processedTransactions.filter(t => t.status === 'completed').length,
      averagePayment: processedTransactions.length > 0
        ? processedTransactions.reduce((sum, t) => sum + (t.amount_aed || 0), 0) / processedTransactions.length
        : 0,
      thisMonth: {
        revenue: thisMonthTransactions.reduce((sum, t) => sum + (t.amount_aed || 0), 0),
        transactions: thisMonthTransactions.length
      }
    }

    return NextResponse.json({
      success: true,
      paymentLinks: paidLinksOnly, // Only return paid links for the display
      transactions: processedTransactions,
      stats,
      companyName,
      companyUserCount: companyUserIds.length
    })

  } catch (error: any) {
    console.error('Server error in company-wide analytics:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}