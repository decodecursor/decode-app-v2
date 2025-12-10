import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripeService } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId, components = ['account_onboarding'] } = await request.json()

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient();

    // If userId is provided, verify the user owns this account
    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, stripe_connect_account_id')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 403 }
        )
      }

      // Verify the account belongs to this user
      if (userData.stripe_connect_account_id !== accountId) {
        return NextResponse.json(
          { error: 'Account does not belong to this user' },
          { status: 403 }
        )
      }
    }

    // Ensure Stripe is initialized
    stripeService.ensureStripeInitialized()

    // Build components configuration based on request
    const componentsConfig: any = {}
    
    if (components.includes('account_onboarding')) {
      componentsConfig.account_onboarding = { enabled: true }
    }
    if (components.includes('account_management')) {
      componentsConfig.account_management = { enabled: true }
    }
    if (components.includes('notification_banner')) {
      componentsConfig.notification_banner = { enabled: true }
    }
    if (components.includes('payments')) {
      componentsConfig.payments = { enabled: true }
    }

    // Create Account Session for embedded component
    const accountSession = await stripeService.stripe.accountSessions.create({
      account: accountId,
      components: componentsConfig,
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