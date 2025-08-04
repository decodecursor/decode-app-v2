import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { stripeService } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    // Get user session from request body (sent from client)
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify user exists (basic validation)
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (userCheckError || !userExists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = { id: userId }

    // Get user data from database (using available fields only)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, professional_center_name')
      .eq('id', user.id)
      .single()

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    // Check if user already has a Stripe Connect account
    const { data: existingAccount } = await supabase
      .from('users')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single()

    if (existingAccount?.stripe_connect_account_id) {
      return NextResponse.json({
        accountId: existingAccount.stripe_connect_account_id,
        message: 'Existing Stripe Connect account found'
      })
    }

    // Ensure Stripe is initialized
    stripeService.ensureStripeInitialized()

    // Create Stripe Connect account for UAE
    const account = await stripeService.stripe.accounts.create({
      type: 'express',
      country: 'AE', // United Arab Emirates
      email: userData.email,
      business_type: 'individual', // For independent contractors
      business_profile: {
        name: userData.professional_center_name || undefined,
        mcc: '7230', // Beauty shops and barber shops
        url: 'https://decode-beauty.ae', // Your platform URL
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual', // We'll handle weekly payouts programmatically
          },
        },
      },
    })

    // Store the Stripe Connect account ID
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        stripe_connect_account_id: account.id,
        stripe_connect_status: 'pending'
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to store Stripe Connect account ID:', updateError)
      // Don't fail the request, account was created successfully
    }

    console.log('Created Stripe Connect account:', account.id, 'for user:', user.id)

    return NextResponse.json({
      accountId: account.id,
      message: 'Stripe Connect account created successfully'
    })

  } catch (error) {
    console.error('Stripe Connect account creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Stripe Connect account' },
      { status: 500 }
    )
  }
}