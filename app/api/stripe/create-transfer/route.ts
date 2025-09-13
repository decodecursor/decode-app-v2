import { NextRequest, NextResponse } from 'next/server'
import { stripeTransferService } from '@/lib/stripe-transfer-service'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { emailService } from '@/lib/email-service'

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

    // Get user's connected account ID and details for notification
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('stripe_connect_account_id, user_name, email, role, company_name, branch_name')
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

    // Send admin notification for payout request
    try {
      await emailService.sendAdminPayoutRequestNotification({
        payout_request_id: result.transferId,
        user_name: userData.user_name,
        user_email: userData.email,
        user_role: userData.role,
        user_id: userId,
        company_name: userData.company_name,
        branch_name: userData.branch_name,
        amount: amountAed,
        stripe_connect_account_id: userData.stripe_connect_account_id,
        request_date: new Date().toISOString()
      })
      console.log('✅ PAYOUT: Admin payout notification sent')
    } catch (emailError) {
      console.error('⚠️ PAYOUT: Failed to send admin notification:', emailError)
      // Don't fail the payout if email fails
    }

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