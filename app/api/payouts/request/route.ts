import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { generateUniquePayoutRequestId } from '@/lib/short-id'
import { emailService } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [PAYOUT-REQUEST] Request received - SIMPLIFIED VERSION v3 - FINAL')

    // Use standard server client for authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ [PAYOUT-REQUEST] No authenticated user found')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('✅ [PAYOUT-REQUEST] Found user:', user.id)

    const requestBody = await request.json()
    console.log('📋 [PAYOUT-REQUEST] Request body:', requestBody)

    const { amount } = requestBody
    const userId = user.id

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    // Enforce minimum payout amount of AED 50
    if (amount < 50) {
      return NextResponse.json(
        { error: 'Minimum payout amount is AED 50. Please request at least AED 50 for processing.' },
        { status: 400 }
      )
    }

    // Fetch user profile data for email and additional info
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    console.log('📋 [PAYOUT-REQUEST] User data:', userData)

    // Get user email
    const userEmail = user.email || userData?.email

    if (!userEmail) {
      console.error('❌ [PAYOUT-REQUEST] No email found for user')
      return NextResponse.json(
        { error: 'Valid email address required for payout requests.' },
        { status: 400 }
      )
    }

    // Calculate available balance using same logic as proxy-summary (commission-based)
    const { data: userPaymentLinks } = await supabase
      .from('payment_links')
      .select(`
        service_amount_aed,
        amount_aed,
        paid_at
      `)
      .eq('creator_id', userId)
      .not('paid_at', 'is', null)

    // Calculate total service revenue (what user earned)
    const totalServiceRevenue = (userPaymentLinks || []).reduce((sum, link) => {
      let serviceAmount = link.service_amount_aed || 0

      // If service_amount_aed is missing, calculate it (total - 9% platform fee)
      if (!serviceAmount && link.amount_aed) {
        serviceAmount = link.amount_aed * 0.91
      }

      return sum + serviceAmount
    }, 0)

    // Calculate total commission (1% of service revenue)
    const totalCommission = totalServiceRevenue * 0.01

    // Get total previous payouts (both paid and pending)
    const { data: allPayouts } = await supabase
      .from('payouts')
      .select('payout_amount_aed, paid_at, status')
      .eq('user_id', userId)
      .in('status', ['paid', 'pending'])
      .order('created_at', { ascending: false })

    const totalRequestedPayouts = (allPayouts || []).reduce((sum, p) => sum + (p.payout_amount_aed || 0), 0)

    // Calculate available balance
    const availableBalance = Math.max(0, totalCommission - totalRequestedPayouts)

    console.log(`💰 Balance: Commission: ${totalCommission}, Requested: ${totalRequestedPayouts}, Available: ${availableBalance}`)

    // Validate requested amount against available balance
    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Requested amount exceeds available balance. You have AED ${availableBalance.toFixed(2)} available for payout.` },
        { status: 400 }
      )
    }

    // Determine payout method for this request
    let payoutMethod = userData?.preferred_payout_method || null

    // If no preferred method, determine from available accounts
    if (!payoutMethod) {
      // Check if user has Stripe Connect enabled
      if (userData?.stripe_connect_status === 'active' && userData?.stripe_payouts_enabled) {
        payoutMethod = 'stripe_connect'
      } else {
        // Check for bank account
        const { data: bankAccount } = await supabase
          .from('user_bank_accounts')
          .select('id')
          .eq('user_id', userId)
          .eq('is_primary', true)
          .limit(1)
          .maybeSingle()

        if (bankAccount) {
          payoutMethod = 'bank_account'
        } else {
          // Check for PayPal account
          const { data: paypalAccount } = await supabase
            .from('user_paypal_accounts')
            .select('id')
            .eq('user_id', userId)
            .eq('is_primary', true)
            .limit(1)
            .maybeSingle()

          if (paypalAccount) {
            payoutMethod = 'paypal'
          }
        }
      }
    }

    console.log(`💳 [PAYOUT-REQUEST] Determined payout method: ${payoutMethod}`)

    // Validate that a payout method is available
    if (!payoutMethod) {
      return NextResponse.json(
        { error: 'No valid payment method configured. Please set up a bank account, PayPal account, or complete Stripe Connect setup before requesting a payout.' },
        { status: 400 }
      )
    }

    // Generate unique payout request ID
    const payoutRequestId = await generateUniquePayoutRequestId(async (id) => {
      const { data } = await supabase
        .from('payouts')
        .select('payout_request_id')
        .eq('payout_request_id', id)
        .single()
      return data !== null
    })

    // Create payout request in database (use service role client to bypass RLS)
    const serviceClient = createServiceRoleClient()

    const payoutData = {
      user_id: userId,
      payout_amount_aed: amount,
      company_name: userData?.company_name,
      user_name: userData?.user_name,
      payout_request_id: payoutRequestId,
      payout_method: payoutMethod,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    const { data: payout, error: payoutError } = await serviceClient
      .from('payouts')
      .insert([payoutData])
      .select()
      .single()

    if (payoutError) {
      console.error('❌ Error creating payout:', payoutError)
      return NextResponse.json(
        { error: 'Unable to process your payout request at this time. Please try again later.' },
        { status: 500 }
      )
    }

    console.log('✅ Payout created successfully:', payout.id)

    // Send email notification to admin
    try {
      console.log('📧 Sending admin notification email...')

      // Get bank account info if available
      const { data: bankAccount } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      // Get PayPal account info if available
      const { data: paypalAccount } = await supabase
        .from('user_paypal_accounts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      await emailService.sendAdminPayoutRequestNotification({
        payout_request_id: payoutRequestId,
        user_name: userData?.user_name || 'Unknown User',
        user_email: userEmail,
        user_role: userData?.role || 'Unknown',
        user_id: userId,
        company_name: userData?.company_name || 'Unknown Company',
        branch_name: userData?.branch_name,
        amount: amount,
        total_earnings: totalServiceRevenue,
        available_balance: availableBalance,
        previous_payouts_count: allPayouts?.length || 0,
        beneficiary_name: bankAccount?.beneficiary_name,
        bank_name: bankAccount?.bank_name,
        account_type: bankAccount?.account_type,
        iban_number: bankAccount?.iban_number,
        stripe_connect_account_id: userData?.stripe_connect_account_id,
        preferred_payout_method: payoutMethod,
        paypal_email: paypalAccount?.email,
        paypal_account_type: paypalAccount?.account_type,
        last_payout_date: allPayouts?.[0]?.paid_at,
        last_payout_amount: allPayouts?.[0]?.payout_amount_aed,
        request_date: new Date().toISOString()
      })

      console.log('✅ Admin notification email sent successfully')
    } catch (emailError) {
      // Don't fail the payout request if email fails
      console.error('⚠️ Failed to send admin notification email:', emailError)
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        requestId: payoutRequestId,
        amount: amount
      }
    })

  } catch (error: any) {
    console.error('❌ Payout request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}