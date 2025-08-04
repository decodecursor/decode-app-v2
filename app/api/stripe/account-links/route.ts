import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json()
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Ensure Stripe is initialized
    stripeService.ensureStripeInitialized()

    // Create account link for onboarding
    const accountLink = await stripeService.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/bank-account?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/bank-account?success=true`,
      type: 'account_onboarding',
    })

    return NextResponse.json({
      url: accountLink.url,
      message: 'Account link created successfully'
    })

  } catch (error) {
    console.error('Account link creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account link' },
      { status: 500 }
    )
  }
}