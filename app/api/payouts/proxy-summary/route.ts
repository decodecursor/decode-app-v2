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
        .from('user_bank_account')
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

    // Get available balance if bank connected
    let availableBalance = 0
    if (bankConnected && userData?.stripe_connect_account_id) {
      try {
        const balanceResponse = await fetch(`${request.nextUrl.origin}/api/stripe/account-balance?userId=${userId}`)
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json()
          availableBalance = balanceData.available || 0
        }
      } catch (error) {
        console.error('Error loading balance:', error)
      }
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

    // Get last payout
    const { data: lastPayout } = await supabase
      .from('payouts')
      .select('amount_aed, paid_at')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const payoutSummary = {
      availableBalance,
      pendingBalance: availableBalance,
      totalEarnings,
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