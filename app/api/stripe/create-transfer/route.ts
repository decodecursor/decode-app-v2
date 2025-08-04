import { NextRequest, NextResponse } from 'next/server'
import { stripeTransferService } from '@/lib/stripe-transfer-service'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { 
      paymentIntentId, 
      paymentId,
      amountAed,
      userId 
    } = await request.json()

    if (!paymentIntentId || !paymentId || !amountAed || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get user's connected account ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('stripe_connect_account_id')
      .eq('id', userId)
      .single()

    if (userError || !userData?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'User does not have a connected Stripe account' },
        { status: 400 }
      )
    }

    // Create the transfer
    const result = await stripeTransferService.createTransfer({
      paymentIntentId,
      connectedAccountId: userData.stripe_connect_account_id,
      amountAed,
      paymentId,
      userId
    })

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
      amount: result.amount
    })

  } catch (error) {
    console.error('Transfer API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create transfer' },
      { status: 500 }
    )
  }
}