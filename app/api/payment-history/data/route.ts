import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get user ID from cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // Extract user ID from session cookies
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`

    let sessionData: any = null
    const singleCookie = allCookies.find(c => c.name === cookieName)

    if (singleCookie) {
      try {
        sessionData = JSON.parse(singleCookie.value)
      } catch (e) {
        // Try chunked cookies
        const chunks: string[] = []
        let chunkIndex = 0
        while (true) {
          const chunkCookie = allCookies.find(c => c.name === `${cookieName}.${chunkIndex}`)
          if (!chunkCookie) break
          chunks.push(chunkCookie.value)
          chunkIndex++
        }
        if (chunks.length > 0) {
          const fullSession = chunks.join('')
          sessionData = JSON.parse(fullSession)
        }
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
        const fullSession = chunks.join('')
        sessionData = JSON.parse(fullSession)
      }
    }

    if (!sessionData || !sessionData.user) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    const userId = sessionData.user.id

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

    // Fetch payment links with paid_at field
    const { data: linksData, error: linksError } = await supabase
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
      const { data } = await supabase
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