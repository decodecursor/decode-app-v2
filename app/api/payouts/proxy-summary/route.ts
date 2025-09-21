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
    
    // Get user's bank connection status
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_connect_account_id, stripe_connect_status')
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
    const { data: userPaymentLinks } = await supabase
      .from('payment_links')
      .select(`
        service_amount_aed,
        amount_aed,
        paid_at
      `)
      .eq('creator_id', userId)
      .not('paid_at', 'is', null)

    // Calculate total service revenue (what user earned)
    const totalServiceRevenue = (userPaymentLinks || []).reduce((sum, link) => {
      let serviceAmount = link.service_amount_aed || 0

      // If service_amount_aed is missing, calculate it (total - 9% platform fee)
      if (!serviceAmount && link.amount_aed) {
        serviceAmount = link.amount_aed * 0.91
      }

      return sum + serviceAmount
    }, 0)

    // Calculate total commission (1% of service revenue)
    const totalCommission = totalServiceRevenue * 0.01

    console.log(`💰 Payout Balance Calculation for User ${userId}:`)
    console.log(`💰 Payment Links: ${userPaymentLinks?.length || 0}`)
    console.log(`💰 Total Service Revenue: ${totalServiceRevenue}`)
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

    // Get all completed payouts to calculate total paid out
    const { data: allPayouts } = await supabase
      .from('payouts')
      .select('amount_aed')
      .eq('user_id', userId)
      .eq('status', 'paid')

    const totalPaidOut = (allPayouts || []).reduce((sum, p) => sum + (p.amount_aed || 0), 0)

    // Get last payout
    const { data: lastPayout } = await supabase
      .from('payouts')
      .select('amount_aed, paid_at')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Calculate available balance by subtracting previous payouts from total commission
    const availableBalance = Math.max(0, totalCommission - totalPaidOut)

    console.log(`💰 Total Paid Out: ${totalPaidOut}`)
    console.log(`💰 Available Balance: ${availableBalance} (${totalCommission} - ${totalPaidOut})`)

    const payoutSummary = {
      availableBalance,
      pendingBalance: availableBalance,
      totalEarnings,
      totalPaidOut,
      lastPayoutAmount: lastPayout?.amount_aed || 0,
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