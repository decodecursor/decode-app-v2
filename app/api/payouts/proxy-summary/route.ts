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

    // Calculate available balance using same logic as PaymentStats (commission-based)
    // Get user's completed payment links to calculate commission
    let paymentLinksQuery = supabase
      .from('payment_links')
      .select(`
        service_amount_aed,
        amount_aed,
        paid_at
      `)
      .not('paid_at', 'is', null)

    // For Admin users, get all company payment links directly; for others, get personal data
    if (userData?.role === 'Admin' && userData?.company_name) {
      console.log(`🔍 Admin user ${userId}: Getting ALL payment links for company: ${userData.company_name}`)
      paymentLinksQuery = paymentLinksQuery.eq('company_name', userData.company_name)
    } else {
      // For Staff users, get personal payment links only
      console.log(`🔍 Staff user ${userId}: Getting personal payment links only`)
      paymentLinksQuery = paymentLinksQuery.eq('creator_id', userId)
    }

    // For Admin users, filter to current day only
    if (userData?.role === 'Admin') {
      // Filter to current date (today) in UTC
      const today = new Date()
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      paymentLinksQuery = paymentLinksQuery
        .gte('paid_at', startOfToday.toISOString())
        .lt('paid_at', endOfToday.toISOString())

      console.log(`🔍 Admin user ${userId}: Filtering payments to current day (${startOfToday.toISOString()} to ${endOfToday.toISOString()})`)
    }

    const { data: userPaymentLinks } = await paymentLinksQuery

    // Calculate total service revenue (what user earned)
    const totalServiceRevenue = (userPaymentLinks || []).reduce((sum, link) => {
      let serviceAmount = link.service_amount_aed || 0

      // If service_amount_aed is missing, calculate it (total - 9% platform fee)
      if (!serviceAmount && link.amount_aed) {
        serviceAmount = link.amount_aed * 0.91
      }

      return sum + serviceAmount
    }, 0)

    // For Admin users, use full service revenue; for others, use 1% commission
    const userBalance = userData?.role === 'Admin' ? totalServiceRevenue : totalServiceRevenue * 0.01
    const totalCommission = totalServiceRevenue * 0.01

    const userRoleLabel = userData?.role === 'Admin' ? 'Admin (Current Day Only)' : 'User (All Time)'
    console.log(`💰 Payout Balance Calculation for ${userRoleLabel} ${userId}:`)
    console.log(`💰 Payment Links: ${userPaymentLinks?.length || 0}`)
    console.log(`💰 Total Service Revenue: ${totalServiceRevenue}`)
    console.log(`💰 User Balance: ${userBalance} (${userData?.role === 'Admin' ? 'Full Service Revenue' : '1% Commission'})`)
    console.log(`💰 Total Commission (1%): ${totalCommission}`)

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

    // Calculate available balance by subtracting all requested payouts from user balance
    const availableBalance = Math.max(0, userBalance - totalRequestedPayouts)

    console.log(`💰 Total Requested Payouts: ${totalRequestedPayouts}`)
    console.log(`💰 Available Balance: ${availableBalance} (${userBalance} - ${totalRequestedPayouts})`)

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