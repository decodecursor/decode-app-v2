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

    // Fetch payment links with paid_at field
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
      .eq('creator_id', userId)
      .not('paid_at', 'is', null) // Only get paid payment links
      .order('paid_at', { ascending: false })

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

      return {
        ...link,
        creator: Array.isArray(link.creator) ? (link.creator[0] || { user_name: null, email: '' }) : (link.creator || { user_name: null, email: '' }),
        transaction_count: completedTransactions.length,
        total_revenue: completedTransactions.reduce((sum: number, t: any) => sum + (t.amount_aed || 0), 0)
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

    // Calculate stats
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonthTransactions = processedTransactions.filter(t =>
      new Date(t.completed_at || t.created_at) >= thisMonthStart
    )

    const stats = {
      totalRevenue: processedTransactions.reduce((sum, t) => sum + (t.amount_aed || 0), 0),
      activeLinks: processedLinks.filter((link: any) => link.is_active).length,
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
      paymentLinks: processedLinks,
      transactions: processedTransactions,
      stats
    })

  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}