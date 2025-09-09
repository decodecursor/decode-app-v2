import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateUniquePayoutRequestId } from '@/lib/short-id'

export async function POST(request: NextRequest) {
  try {
    const { userId, amount } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    // Enforce minimum payout amount of AED 50
    if (amount < 50) {
      return NextResponse.json(
        { error: 'Minimum payout amount is AED 50. Below AED 50 payouts are not possible.' },
        { status: 400 }
      )
    }

    // Verify user exists and has connected bank account
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, stripe_connect_account_id, stripe_connect_status')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has connected and active Stripe account
    if (!userData.stripe_connect_account_id || userData.stripe_connect_status !== 'active') {
      return NextResponse.json(
        { error: 'Bank account not connected or not verified. Please connect your bank account first.' },
        { status: 400 }
      )
    }

    // Check available balance via Stripe (if API exists)
    let availableBalance = 0
    try {
      const balanceResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/account-balance?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        availableBalance = balanceData.available || 0
      }
    } catch (error) {
      console.error('Error checking balance:', error)
      // Continue without balance check if API unavailable
    }

    // Validate requested amount against available balance
    if (availableBalance > 0 && amount > availableBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: AED ${availableBalance.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Generate unique payout request ID
    const payoutRequestId = await generateUniquePayoutRequestId(async (id) => {
      const { data } = await supabaseAdmin
        .from('payouts')
        .select('payout_request_id')
        .eq('payout_request_id', id)
        .single()
      return data !== null
    })

    // Create payout request in database
    const payoutData = {
      user_id: userId,
      amount_aed: amount,
      payout_request_id: payoutRequestId,
      status: 'pending',
      period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last week
      period_end: new Date().toISOString(), // Today
      scheduled_for: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      created_at: new Date().toISOString()
    }

    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert([payoutData])
      .select()
      .single()

    if (payoutError) {
      console.error('Error creating payout:', payoutError)
      return NextResponse.json(
        { error: 'Failed to create payout request' },
        { status: 500 }
      )
    }

    // In a real implementation, you would integrate with Stripe Connect here
    // to create an actual payout. For now, we just create the database record.

    // TODO: Integrate with Stripe Connect API
    // const stripePayout = await stripe.transfers.create({
    //   amount: Math.round(amount * 100), // Convert to cents
    //   currency: 'aed',
    //   destination: userData.stripe_connect_account_id,
    //   metadata: {
    //     payout_id: payout.id,
    //     user_id: userId
    //   }
    // })

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        requestId: payoutRequestId,
        amount: amount,
        status: 'pending',
        scheduledFor: payoutData.scheduled_for
      }
    })

  } catch (error: any) {
    console.error('Payout request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}