import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { USER_ROLES } from '@/types/user'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [PAYMENT-HISTORY API] Request started')

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
    console.log('📊 [PAYMENT-HISTORY API] User authenticated:', userId)

    // Use service role to query data
    const supabaseService = createServiceRoleClient()

    // Copy working logic from /api/payment-links/list - use users table instead of user_profiles
    const { data: currentUser, error: userError } = await supabaseService
      .from('users')
      .select('role, company_name')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('❌ [PAYMENT-HISTORY API] Failed to fetch user from users table:', userError)
    }

    // Use same role detection as working API
    const isAdmin = currentUser?.role === 'Admin'
    const companyName = currentUser?.company_name

    console.log('📊 [PAYMENT-HISTORY API] USING WORKING LOGIC FROM payment-links/list:')
    console.log('  - Raw role from users table:', currentUser?.role)
    console.log('  - isAdmin result:', isAdmin)
    console.log('  - company_name from users:', currentUser?.company_name)
    console.log('  - Final companyName:', companyName)

    // Build the query based on user role
    let query = supabaseService
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
        is_paid,
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

    // Copy exact working logic from /api/payment-links/list for company filtering
    if (isAdmin && companyName) {
      console.log('📊 [PAYMENT-HISTORY API] ADMIN USER - Fetching company-wide data for:', companyName)
      // Get all users from the company (same as working API)
      const { data: companyUsers } = await supabaseService
        .from('users')
        .select('id')
        .eq('company_name', companyName)

      const companyUserIds = companyUsers?.map(u => u.id) || []
      console.log('📊 [PAYMENT-HISTORY API] Found company user IDs:', companyUserIds.length, companyUserIds)

      if (companyUserIds.length > 0) {
        query = query.in('creator_id', companyUserIds)
      } else {
        // Fallback to user's own data if no company users found
        query = query.eq('creator_id', userId)
      }
    } else {
      // For non-admin users, get only their own payment links
      console.log('📊 [PAYMENT-HISTORY API] NON-ADMIN USER - Fetching user-specific data for userId:', userId)
      query = query.eq('creator_id', userId)
    }

    // Add extensive debugging before query
    console.log('📊 [PAYMENT-HISTORY API] About to query with:')
    console.log('  - isAdmin:', isAdmin)
    console.log('  - companyName:', companyName)

    // Test simple query first without OR condition
    console.log('📊 [PAYMENT-HISTORY API] Testing simple query first...')
    const { data: testData } = await query.limit(5)
    console.log('  - Simple query found:', testData?.length || 0, 'total payment links')
    if (testData && testData.length > 0) {
      console.log('  - Sample payment link:', {
        id: testData[0].id,
        payment_status: testData[0].payment_status,
        is_paid: testData[0].is_paid,
        company_name: testData[0].company_name
      })
    }

    // Now try with payment status filter - use separate conditions
    const { data: linksData, error: linksError } = await query
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })

    console.log('📊 [PAYMENT-HISTORY API] Query completed:')
    console.log('  - Found links:', linksData?.length || 0)
    console.log('  - Query error:', linksError)

    if (linksError) {
      console.error('Payment links query failed:', linksError)
      return NextResponse.json(
        { error: 'Failed to fetch payment links' },
        { status: 500 }
      )
    }

    // Process payment links
    const processedLinks = (linksData || []).map((link: any) => {
      const transactions = link.transactions || []
      const completedTransactions = transactions.filter((t: any) => t.status === 'completed')

      // Calculate service revenue (91% of total if not specified)
      const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91)
      const totalRevenue = completedTransactions.reduce((sum: number, t: any) => sum + (t.amount_aed || 0), 0)

      console.log(`📊 [API] Processing link ${link.id}: amount=${link.amount_aed}, service=${link.service_amount_aed}, calculated_service=${serviceAmount}, transactions=${completedTransactions.length}`)

      return {
        ...link,
        service_amount_aed: serviceAmount, // Ensure service amount is always present
        creator: Array.isArray(link.creator) ? (link.creator[0] || { user_name: null, email: '' }) : (link.creator || { user_name: null, email: '' }),
        transaction_count: completedTransactions.length,
        total_revenue: totalRevenue
      }
    })

    // Fetch transactions for these payment links
    let transactionsData: any[] = []
    if (processedLinks.length > 0) {
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
        .in('payment_link_id', processedLinks.map((link: any) => link.id))
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

    // Calculate stats - using service_amount_aed for proper revenue calculation
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonthLinks = processedLinks.filter((link: any) =>
      link.paid_at && new Date(link.paid_at) >= thisMonthStart
    )

    // Calculate total revenue from payment links (service amount after platform fee)
    const totalServiceRevenue = processedLinks.reduce((sum: any, link: any) => {
      const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91)
      return sum + (serviceAmount * link.transaction_count) // Multiply by transaction count
    }, 0)

    const thisMonthServiceRevenue = thisMonthLinks.reduce((sum: any, link: any) => {
      const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91)
      return sum + (serviceAmount * link.transaction_count)
    }, 0)

    const totalTransactionCount = processedLinks.reduce((sum: any, link: any) =>
      sum + link.transaction_count, 0)

    const thisMonthTransactionCount = thisMonthLinks.reduce((sum: any, link: any) =>
      sum + link.transaction_count, 0)

    const stats = {
      totalRevenue: totalServiceRevenue,
      activeLinks: processedLinks.filter((link: any) => link.is_active).length,
      totalTransactions: totalTransactionCount,
      successfulPayments: totalTransactionCount, // All counted transactions are successful
      averagePayment: totalTransactionCount > 0
        ? totalServiceRevenue / totalTransactionCount
        : 0,
      thisMonth: {
        revenue: thisMonthServiceRevenue,
        transactions: thisMonthTransactionCount
      }
    }

    console.log(`📊 [API] Stats calculated:`, stats)
    console.log(`📊 [API] Total links: ${processedLinks.length}, This month links: ${thisMonthLinks.length}`)

    console.log('📊 [PAYMENT-HISTORY API] Successfully returning:', {
      paymentLinks: processedLinks.length,
      transactions: processedTransactions.length,
      isAdmin,
      companyName
    })

    return NextResponse.json({
      success: true,
      paymentLinks: processedLinks,
      transactions: processedTransactions,
      stats,
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