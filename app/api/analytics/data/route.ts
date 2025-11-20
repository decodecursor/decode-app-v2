import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export interface AnalyticsFilter {
  startDate?: string
  endDate?: string
  creatorId?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('📊 [ANALYTICS API] Request started')

    // Authenticate the user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('❌ [ANALYTICS API] Authentication failed:', authError)
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    const userId = user.id
    console.log('📊 [ANALYTICS API] User authenticated:', userId)

    // Parse the filter from request body
    const filter: AnalyticsFilter = await request.json()
    console.log('📊 [ANALYTICS API] Filter received:', filter)

    // Use service role client for database queries
    const supabaseService = createServiceRoleClient()

    // Get user role and company information
    const { data: currentUser, error: userError } = await supabaseService
      .from('users')
      .select('role, company_name')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('❌ [ANALYTICS API] Failed to fetch user:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user information' },
        { status: 500 }
      )
    }

    const isAdmin = currentUser?.role === 'Admin'
    const companyName = currentUser?.company_name

    console.log('📊 [ANALYTICS API] User role:', {
      isAdmin,
      companyName,
      role: currentUser?.role
    })

    // Generate analytics data based on user role
    const analyticsData = await generateBasicAnalytics(
      supabaseService,
      filter,
      userId,
      isAdmin,
      companyName
    )

    console.log('📊 [ANALYTICS API] Analytics generated successfully')

    return NextResponse.json({
      success: true,
      data: analyticsData
    })

  } catch (error: any) {
    console.error('❌ [ANALYTICS API] Server error:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}

async function generateBasicAnalytics(
  supabaseService: any,
  filter: AnalyticsFilter,
  userId: string,
  isAdmin: boolean,
  companyName: string | null
) {
  try {
    // Determine which user IDs to query for based on role
    let targetUserIds: string[] = [userId]

    if (isAdmin && companyName) {
      console.log('📊 [ANALYTICS] ADMIN - Fetching company-wide data for:', companyName)
      const { data: companyUsers } = await supabaseService
        .from('users')
        .select('id')
        .eq('company_name', companyName)

      targetUserIds = companyUsers?.map((u: any) => u.id) || [userId]
      console.log('📊 [ANALYTICS] Company user IDs:', targetUserIds.length)
    } else {
      console.log('📊 [ANALYTICS] NON-ADMIN - Fetching user-specific data')
    }

    // Build transactions query
    let transactionsQuery = supabaseService
      .from('transactions')
      .select('*')

    // Build payment links query
    let paymentLinksQuery = supabaseService
      .from('payment_links')
      .select('*')
      .in('creator_id', targetUserIds)

    // Apply creator filter if provided (for non-admin filtering)
    if (filter.creatorId) {
      paymentLinksQuery = paymentLinksQuery.eq('creator_id', filter.creatorId)
    }

    // Apply date filters
    if (filter.startDate) {
      transactionsQuery = transactionsQuery.gte('created_at', filter.startDate)
    }

    if (filter.endDate) {
      transactionsQuery = transactionsQuery.lte('created_at', filter.endDate)
    }

    // Execute queries
    const [transactionsResult, paymentLinksResult] = await Promise.all([
      transactionsQuery,
      paymentLinksQuery
    ])

    if (transactionsResult.error) {
      console.error('❌ [ANALYTICS] Transactions query error:', transactionsResult.error)
      throw new Error('Failed to fetch transactions')
    }

    if (paymentLinksResult.error) {
      console.error('❌ [ANALYTICS] Payment links query error:', paymentLinksResult.error)
      throw new Error('Failed to fetch payment links')
    }

    const transactions = transactionsResult.data || []
    const paymentLinks = paymentLinksResult.data || []

    console.log('📊 [ANALYTICS] Data fetched:', {
      transactions: transactions.length,
      paymentLinks: paymentLinks.length
    })

    // Get payment link IDs for the user/company
    const paymentLinkIds = paymentLinks.map((pl: any) => pl.id)

    // Filter transactions to only those belonging to the user's/company's payment links
    const relevantTransactions = transactions.filter((t: any) =>
      paymentLinkIds.includes(t.payment_link_id)
    )

    // Calculate basic metrics
    const completedTransactions = relevantTransactions.filter((t: any) => t.status === 'completed')

    const totalRevenue = completedTransactions.reduce((sum: number, t: any) =>
      sum + (t.amount_aed || 0), 0
    )

    const totalTransactions = completedTransactions.length
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

    const uniqueCustomers = new Set(
      completedTransactions
        .map((t: any) => t.buyer_email)
        .filter(Boolean)
    ).size

    const totalPaymentLinks = paymentLinks.length
    const activePaymentLinks = paymentLinks.filter((pl: any) => pl.is_active).length
    const conversionRate = totalPaymentLinks > 0 ? (totalTransactions / totalPaymentLinks) * 100 : 0

    console.log('📊 [ANALYTICS] Metrics calculated:', {
      totalRevenue,
      totalTransactions,
      uniqueCustomers,
      totalPaymentLinks
    })

    // Return analytics data with all required fields
    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue,
      uniqueCustomers,
      totalPaymentLinks,
      activePaymentLinks,
      conversionRate,
      revenueByPeriod: [],
      topPaymentLinks: [],
      customerRetention: 0,
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: [],
      generatedAt: new Date(),
      successRate: conversionRate,
      averageOrderValue: averageTransactionValue,
      revenueByDay: [],
      paymentMethodBreakdown: [],
      customerInsights: {
        totalUniqueCustomers: uniqueCustomers,
        returningCustomers: 0,
        averageCustomerValue: averageTransactionValue
      }
    }
  } catch (error) {
    console.error('❌ [ANALYTICS] Error in generateBasicAnalytics:', error)

    // Return fallback empty analytics
    return {
      totalRevenue: 0,
      totalTransactions: 0,
      averageTransactionValue: 0,
      uniqueCustomers: 0,
      totalPaymentLinks: 0,
      activePaymentLinks: 0,
      conversionRate: 0,
      revenueByPeriod: [],
      topPaymentLinks: [],
      customerRetention: 0,
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: [],
      generatedAt: new Date(),
      successRate: 0,
      averageOrderValue: 0,
      revenueByDay: [],
      paymentMethodBreakdown: [],
      customerInsights: {
        totalUniqueCustomers: 0,
        returningCustomers: 0,
        averageCustomerValue: 0
      }
    }
  }
}
