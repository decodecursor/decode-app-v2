import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { stripeService } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await request.json()

    if (!accountId || !userId) {
      return NextResponse.json(
        { error: 'Account ID and User ID are required' },
        { status: 400 }
      )
    }

    // Verify the account belongs to the user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_connect_account_id')
      .eq('id', userId)
      .single()

    if (userError || userData.stripe_connect_account_id !== accountId) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 403 }
      )
    }

    // Ensure Stripe is initialized
    stripeService.ensureStripeInitialized()

    // Create Account Session for embedded component
    const accountSession = await stripeService.stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    })

    return NextResponse.json({
      client_secret: accountSession.client_secret,
      message: 'Account session created successfully'
    })

  } catch (error) {
    console.error('Stripe Account Session creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account session' },
      { status: 500 }
    )
  }
}