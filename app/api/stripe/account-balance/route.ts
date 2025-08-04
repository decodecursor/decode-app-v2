import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { stripeTransferService } from '@/lib/stripe-transfer-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user's connected account ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_connect_account_id')
      .eq('id', userId)
      .single() as any

    if (userError || !userData?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'No connected Stripe account found' },
        { status: 404 }
      )
    }

    // Get balance from Stripe
    const balance = await stripeTransferService.getAccountBalance(
      userData.stripe_connect_account_id
    )

    // Get pending transfers from database
    const { data: pendingTransfers } = await supabase
      .from('transfers')
      .select('amount_aed')
      .eq('user_id', userId)
      .eq('status', 'pending')

    const pendingAmount = pendingTransfers?.reduce((sum, t) => sum + t.amount_aed, 0) || 0

    // Get this week's earnings
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1) // Monday
    startOfWeek.setHours(0, 0, 0, 0)

    const { data: weeklyTransfers } = await supabase
      .from('transfers')
      .select('amount_aed')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', startOfWeek.toISOString())

    const weeklyEarnings = weeklyTransfers?.reduce((sum, t) => sum + t.amount_aed, 0) || 0

    return NextResponse.json({
      available: balance.available,
      pending: balance.pending + pendingAmount,
      currency: balance.currency,
      weeklyEarnings,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching account balance:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}