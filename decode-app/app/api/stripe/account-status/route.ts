import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Ensure Stripe is initialized
    stripeService.ensureStripeInitialized()

    // Fetch account details from Stripe
    const account = await stripeService.stripe.accounts.retrieve(accountId)

    // Update database with latest status
    const supabase = await createClient()
    await supabase
      .from('users')
      .update({
        stripe_connect_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
        stripe_onboarding_completed: account.details_submitted || false,
        stripe_payouts_enabled: account.payouts_enabled || false,
        stripe_charges_enabled: account.charges_enabled || false,
        stripe_details_submitted: account.details_submitted || false,
        stripe_capabilities: account.capabilities as any,
        stripe_requirements: account.requirements as any
      })
      .eq('stripe_connect_account_id', accountId)

    // Check if onboarding is complete
    const isComplete = account.charges_enabled && 
                      account.payouts_enabled && 
                      account.details_submitted

    return NextResponse.json({
      isComplete,
      status: {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements
      }
    })

  } catch (error) {
    console.error('Error checking account status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check account status' },
      { status: 500 }
    )
  }
}