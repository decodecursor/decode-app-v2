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

    // Get user data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, company_name, stripe_connect_account_id')
      .eq('id', user.id)
      .single()

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    // If user already has a Stripe Connect account, return it
    if (userData.stripe_connect_account_id) {
      return NextResponse.json({
        accountId: userData.stripe_connect_account_id,
        message: 'Account already exists'
      })
    }

    // Ensure Stripe is initialized
    stripeService.ensureStripeInitialized()

    // Create Stripe Connect account
    const account = await stripeService.stripe.accounts.create({
      type: 'express',
      email: userData.email,
      business_profile: {
        name: userData.company_name || undefined,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    // Store Stripe Connect account ID in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ stripe_connect_account_id: account.id })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update user with Stripe account ID:', updateError)
      // Don't return error here as the Stripe account was created successfully
    }

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