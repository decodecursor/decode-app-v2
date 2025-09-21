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
        { error: 'Minimum payout amount is AED 50. Please request at least AED 50 for processing.' },
        { status: 400 }
      )
    }

    // Verify user exists and check available payout methods
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, stripe_connect_account_id, stripe_connect_status, preferred_payout_method')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json(
        { error: 'Unable to process payout request. Please try again or contact support.' },
        { status: 404 }
      )
    }

    // For now, we'll process email-based payout requests for any user with a valid email
    // The actual payout will be handled manually via email
    if (!userData.email) {
      return NextResponse.json(
        { error: 'Valid email address required for payout requests.' },
        { status: 400 }
      )
    }

    console.log(`✅ Payout request: User ${userId} has valid email for email-based payout`)

    // Calculate available balance using same logic as proxy-summary (commission-based)
    const { data: userPaymentLinks } = await supabaseAdmin
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

    // Get total previous payouts
    const { data: allPayouts } = await supabaseAdmin
      .from('payouts')
      .select('amount_aed')
      .eq('user_id', userId)
      .eq('status', 'paid')

    const totalPaidOut = (allPayouts || []).reduce((sum, p) => sum + (p.amount_aed || 0), 0)

    // Calculate available balance
    const availableBalance = Math.max(0, totalCommission - totalPaidOut)

    console.log(`💰 Payout Request Balance Check for User ${userId}:`)
    console.log(`💰 Total Commission: ${totalCommission}, Paid Out: ${totalPaidOut}, Available: ${availableBalance}`)

    // Validate requested amount against available balance
    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Requested amount exceeds available balance. You have AED ${availableBalance.toFixed(2)} available for payout.` },
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
        { error: 'Unable to process your payout request at this time. Please try again later.' },
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