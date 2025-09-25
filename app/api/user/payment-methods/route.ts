import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET - Retrieve user's payment methods (bank account + PayPal + profile data)
export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch all data in parallel for better performance
    const [
      bankAccountResult,
      paypalAccountResult,
      userProfileResult
    ] = await Promise.all([
      // Get user's bank account
      supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .order('created_at', { ascending: false })
        .maybeSingle(),

      // Get user's PayPal account
      supabase
        .from('user_paypal_account')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle(),

      // Get user profile for preferred method and Stripe status
      supabase
        .from('users')
        .select('preferred_payout_method, stripe_connect_status, user_name')
        .eq('id', user.id)
        .single()
    ])

    // Handle bank account data
    let bankAccount = null
    if (bankAccountResult.error && bankAccountResult.error.code !== 'PGRST116') {
      console.error('Error fetching bank account:', bankAccountResult.error)
    } else if (bankAccountResult.data) {
      bankAccount = bankAccountResult.data
    } else if (userProfileResult.data?.stripe_connect_status === 'active') {
      // Fallback to Stripe Connect if available
      bankAccount = {
        id: 'stripe',
        iban_number: '****connected',
        bank_name: 'Stripe Connect',
        beneficiary_name: userProfileResult.data.user_name || 'User',
        is_verified: true,
        status: 'active'
      }
    }

    // Handle PayPal account data
    let paypalAccount = null
    if (paypalAccountResult.error && paypalAccountResult.error.code !== 'PGRST116') {
      console.error('Error fetching PayPal account:', paypalAccountResult.error)
    } else if (paypalAccountResult.data) {
      paypalAccount = paypalAccountResult.data
    }

    // Build available methods array
    const availableMethods = []
    if (bankAccount) {
      availableMethods.push({
        type: 'bank_account',
        displayName: 'Bank Account',
        isConnected: true
      })
    }
    if (paypalAccount) {
      availableMethods.push({
        type: 'paypal',
        displayName: 'PayPal',
        isConnected: true
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        bankAccount,
        paypalAccount,
        availableMethods,
        preferredMethod: userProfileResult.data?.preferred_payout_method || null,
        userProfile: userProfileResult.data
      }
    })

  } catch (error) {
    console.error('Payment methods GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}