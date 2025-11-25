import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const userId = user.id
    
    // Get user's bank connection status, role, and company info
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_connect_account_id, stripe_connect_status, role, company_name')
      .eq('id', userId)
      .single()

    // Check Stripe Connect status
    const stripeConnected = userData?.stripe_connect_status === 'active'

    // Check manual bank account entries
    let manualBankConnected = false
    try {
      const { data: bankAccounts } = await supabase
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
      
      if (bankAccounts && bankAccounts.length > 0) {
        manualBankConnected = true
      }
    } catch (error) {
      console.log('Manual bank account check failed, continuing...')
    }

    // Bank is connected if EITHER system shows connection
    const bankConnected = stripeConnected || manualBankConnected

    // Simple approach: Calculate available balance
    let userBalance = 0

    // Check user role (case-insensitive)
    const isAdmin = userData?.role?.toLowerCase() === 'admin'
    const isModel = userData?.role?.toLowerCase() === 'model'

    if (isModel) {
      // MODEL: Get pending auction payouts
      console.log(`💰 MODEL USER (role: ${userData.role}): Getting pending auction payouts`)

      const { data: pendingAuctionPayouts } = await supabase
        .from('auction_payouts')
        .select(`
          id,
          auction_id,
          auction_winning_amount,
          auction_profit_model_amount,
          status,
          created_at,
          auctions!inner (
            id,
            title,
            auction_end_time,
            status
          )
        `)
        .eq('model_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      console.log(`💰 Found ${pendingAuctionPayouts?.length || 0} pending auction payouts`)

      // Calculate total pending balance
      userBalance = (pendingAuctionPayouts || []).reduce((sum, payout) => {
        return sum + (Number(payout.auction_profit_model_amount) || 0)
      }, 0)

      console.log(`💰 MODEL Total Pending Balance: ${userBalance}`)

      // Format pending payouts for response
      const formattedPendingPayouts = (pendingAuctionPayouts || []).map(payout => ({
        auction_id: payout.auction_id,
        auction_title: payout.auctions?.title || 'Untitled Auction',
        ended_at: payout.auctions?.auction_end_time || payout.created_at,
        model_amount: Number(payout.auction_profit_model_amount),
        payout_status: payout.status
      }))

      // Get total paid out amount
      const { data: paidPayouts } = await supabase
        .from('auction_payouts')
        .select('auction_profit_model_amount')
        .eq('model_id', userId)
        .eq('status', 'transferred')

      const totalPaidOut = (paidPayouts || []).reduce((sum, payout) => {
        return sum + (Number(payout.auction_profit_model_amount) || 0)
      }, 0)

      // Get last payout
      const { data: lastModelPayout } = await supabase
        .from('auction_payouts')
        .select('auction_profit_model_amount, transferred_at')
        .eq('model_id', userId)
        .eq('status', 'transferred')
        .not('transferred_at', 'is', null)
        .order('transferred_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const payoutSummary = {
        availableBalance: userBalance,
        pendingBalance: userBalance,
        pendingPayouts: formattedPendingPayouts,
        totalEarnings: userBalance + totalPaidOut,
        totalPaidOut,
        lastPayoutAmount: lastModelPayout ? Number(lastModelPayout.auction_profit_model_amount) : 0,
        lastPayoutDate: lastModelPayout?.transferred_at || null,
        bankConnected
      }

      return NextResponse.json({
        payoutSummary,
        success: true
      })

    } else if (isAdmin) {
      // ADMIN: Get today's paid payment links and sum FULL service_amount_aed
      console.log(`💰 ADMIN USER (role: ${userData.role}): Getting today's full service revenue`)

      const today = new Date()
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      console.log(`💰 Date range: ${startOfToday.toISOString()} to ${endOfToday.toISOString()}`)

      // Build query for payment links
      let query = supabase
        .from('payment_links')
        .select('service_amount_aed, amount_aed, paid_at, client_name, company_name')
        .not('paid_at', 'is', null)
        .gte('paid_at', startOfToday.toISOString())
        .lt('paid_at', endOfToday.toISOString())

      // If company_name exists, filter by it. Otherwise get all payment links for today
      if (userData.company_name) {
        console.log(`💰 Filtering by company: "${userData.company_name}"`)
        query = query.eq('company_name', userData.company_name)
      } else {
        console.log(`💰 No company_name set, getting ALL payment links for today`)
      }

      const { data: adminPaymentLinks } = await query

      console.log(`💰 Found ${adminPaymentLinks?.length || 0} paid payment links for today`)

      if (adminPaymentLinks && adminPaymentLinks.length > 0) {
        console.log(`💰 Payment links data:`, adminPaymentLinks.map(link => ({
          client_name: link.client_name,
          company_name: link.company_name,
          service_amount_aed: link.service_amount_aed,
          amount_aed: link.amount_aed,
          paid_at: link.paid_at
        })))

        // Sum all service_amount_aed for today (FULL AMOUNT for ADMIN)
        userBalance = adminPaymentLinks.reduce((sum, link) => {
          const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91) || 0
          console.log(`💰 Adding FULL service amount: ${serviceAmount}`)
          return sum + serviceAmount
        }, 0)

        console.log(`💰 ADMIN TOTAL SERVICE REVENUE FOR TODAY (FULL AMOUNT): ${userBalance}`)
      } else {
        console.log(`💰 No paid payment links found for today`)
        userBalance = 0
      }

    } else {
      // STAFF: Get personal payment links and use 1% commission
      console.log(`💰 STAFF USER (role: ${userData?.role}): Getting personal payment links for 1% commission`)

      const { data: staffPaymentLinks } = await supabase
        .from('payment_links')
        .select('service_amount_aed, amount_aed')
        .eq('creator_id', userId)
        .not('paid_at', 'is', null)

      const totalServiceRevenue = (staffPaymentLinks || []).reduce((sum, link) => {
        const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91) || 0
        return sum + serviceAmount
      }, 0)

      userBalance = totalServiceRevenue * 0.01
      console.log(`💰 STAFF: Total service revenue: ${totalServiceRevenue}, 1% commission: ${userBalance}`)
    }

    // Quick fix: If ADMIN but fell through to staff calculation, multiply by 100
    if (userData?.role?.toLowerCase() === 'admin' && userBalance > 0) {
      userBalance = userBalance * 100
      console.log(`💰 ADMIN FIX: Multiplied by 100 to get full amount: ${userBalance}`)
    }

    // Get earnings from completed transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        amount_aed,
        status,
        completed_at,
        payment_link:payment_link_id (
          creator_id
        )
      `)
      .eq('status', 'completed')
      .eq('payment_link.creator_id', userId)

    const totalEarnings = (transactions || []).reduce((sum, t) => sum + (t.amount_aed || 0), 0)

    // Get all payouts (both paid and pending) to calculate total requested
    const { data: allPayouts } = await supabase
      .from('payouts')
      .select('payout_amount_aed, status')
      .eq('user_id', userId)
      .in('status', ['paid', 'pending'])

    const totalRequestedPayouts = (allPayouts || []).reduce((sum, p) => sum + (p.payout_amount_aed || 0), 0)

    // Get last payout
    const { data: lastPayout } = await supabase
      .from('payouts')
      .select('payout_amount_aed, paid_at')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Calculate available balance
    // For ADMIN: Show raw sum of today's service revenue without deducting payouts
    // For STAFF: Subtract requested payouts from commission balance
    const availableBalance = isAdmin
      ? userBalance
      : Math.max(0, userBalance - totalRequestedPayouts)

    console.log(`💰 Total Requested Payouts: ${totalRequestedPayouts}`)
    console.log(`💰 Available Balance: ${availableBalance} (${isAdmin ? 'ADMIN: Today\'s full service revenue' : `${userBalance} - ${totalRequestedPayouts}`})`)

    const payoutSummary = {
      availableBalance,
      pendingBalance: availableBalance,
      totalEarnings,
      totalPaidOut: totalRequestedPayouts,
      lastPayoutAmount: lastPayout?.payout_amount_aed || 0,
      lastPayoutDate: lastPayout?.paid_at || null,
      bankConnected
    }

    return NextResponse.json({ 
      payoutSummary,
      success: true 
    })
    
  } catch (error: any) {
    console.error('Proxy payout summary error:', error)
    return NextResponse.json(
      { error: 'Server error loading payout data', details: error.message },
      { status: 500 }
    )
  }
}