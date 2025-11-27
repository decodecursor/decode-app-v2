/**
 * POST /api/payouts/auction-request
 * Handle MODEL auction payout requests for selected auctions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateUniquePayoutRequestId } from '@/lib/short-id'
import { emailService } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [AUCTION-PAYOUT-REQUEST] Request received')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ [AUCTION-PAYOUT-REQUEST] No authenticated user found')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const userId = user.id
    console.log('✅ [AUCTION-PAYOUT-REQUEST] Found user:', userId)

    // Get user profile to verify role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, user_name, company_name, preferred_payout_method')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('❌ [AUCTION-PAYOUT-REQUEST] Error fetching user profile:', userError)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Validate user is MODEL role
    if (userData.role?.toLowerCase() !== 'model') {
      console.log('❌ [AUCTION-PAYOUT-REQUEST] User is not a MODEL:', userData.role)
      return NextResponse.json(
        { error: 'Only MODEL users can request auction payouts' },
        { status: 403 }
      )
    }

    const requestBody = await request.json()
    console.log('📋 [AUCTION-PAYOUT-REQUEST] Request body:', requestBody)

    const { auction_ids } = requestBody

    if (!auction_ids || !Array.isArray(auction_ids) || auction_ids.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one auction for payout' },
        { status: 400 }
      )
    }

    // Fetch selected auctions to validate ownership and status
    const { data: auctions, error: auctionsError } = await supabase
      .from('auctions')
      .select('id, title, model_payout_amount, payout_status, creator_id, end_time')
      .in('id', auction_ids)
      .eq('creator_id', userId)
      .eq('status', 'completed')
      .eq('payout_status', 'pending')

    if (auctionsError) {
      console.error('❌ [AUCTION-PAYOUT-REQUEST] Error fetching auctions:', auctionsError)
      return NextResponse.json(
        { error: 'Error validating auctions' },
        { status: 500 }
      )
    }

    if (!auctions || auctions.length === 0) {
      return NextResponse.json(
        { error: 'No valid auctions found. Auctions may already be processing or do not belong to you.' },
        { status: 400 }
      )
    }

    // Check if all requested auctions were found
    if (auctions.length !== auction_ids.length) {
      const foundIds = auctions.map(a => a.id)
      const missingIds = auction_ids.filter((id: string) => !foundIds.includes(id))
      console.log('⚠️ [AUCTION-PAYOUT-REQUEST] Some auctions not found or not eligible:', missingIds)
      return NextResponse.json(
        { error: `Some auctions are not available for payout. Please refresh and try again.` },
        { status: 400 }
      )
    }

    // Check video watch requirement for each auction
    // Payout is only allowed if: video was watched (payout_unlocked_at set) OR no video was uploaded
    for (const auction of auctions) {
      const { data: video } = await supabase
        .from('auction_videos')
        .select('id, file_url, payout_unlocked_at')
        .eq('auction_id', auction.id)
        .single()

      // If video exists with file_url but payout not unlocked, block the request
      if (video && video.file_url && !video.payout_unlocked_at) {
        console.log(`⚠️ [AUCTION-PAYOUT-REQUEST] Video not watched for auction: ${auction.id}`)
        return NextResponse.json(
          { error: `Please watch the winner video for "${auction.title}" before requesting payout.` },
          { status: 400 }
        )
      }
    }

    // Calculate total amount
    const totalAmount = auctions.reduce((sum, auction) => {
      return sum + (Number(auction.model_payout_amount) || 0)
    }, 0)

    console.log(`💰 [AUCTION-PAYOUT-REQUEST] Total amount for ${auctions.length} auctions: AED ${totalAmount}`)

    // Enforce minimum payout amount
    if (totalAmount < 50) {
      return NextResponse.json(
        { error: `Minimum payout amount is AED 50. Selected auctions total AED ${totalAmount.toFixed(2)}.` },
        { status: 400 }
      )
    }

    // Determine payout method
    let payoutMethod = userData.preferred_payout_method || null

    if (!payoutMethod) {
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

    if (!payoutMethod) {
      return NextResponse.json(
        { error: 'Please configure a payment method (bank account or PayPal) before requesting a payout.' },
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

    // Update auctions to 'processing' status
    const { error: updateError } = await supabase
      .from('auctions')
      .update({
        payout_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .in('id', auction_ids)
      .eq('creator_id', userId)

    if (updateError) {
      console.error('❌ [AUCTION-PAYOUT-REQUEST] Error updating auctions:', updateError)
      return NextResponse.json(
        { error: 'Failed to process payout request. Please try again.' },
        { status: 500 }
      )
    }

    // Create payout record for history tracking
    const auctionTitles = auctions.map(a => a.title).join(', ')
    const payoutData = {
      user_id: userId,
      payout_amount_aed: totalAmount,
      company_name: userData.company_name,
      user_name: userData.user_name,
      payout_request_id: payoutRequestId,
      payout_method: payoutMethod,
      status: 'pending',
      notes: `Auction payouts: ${auctionTitles}`,
      created_at: new Date().toISOString()
    }

    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .insert([payoutData])
      .select()
      .single()

    if (payoutError) {
      console.error('❌ [AUCTION-PAYOUT-REQUEST] Error creating payout record:', payoutError)
      // Revert auction status updates
      await supabase
        .from('auctions')
        .update({ payout_status: 'pending' })
        .in('id', auction_ids)
        .eq('creator_id', userId)

      return NextResponse.json(
        { error: 'Failed to create payout request. Please try again.' },
        { status: 500 }
      )
    }

    console.log('✅ [AUCTION-PAYOUT-REQUEST] Payout created successfully:', payout.id)

    // Send email notification to admin
    try {
      console.log('📧 [AUCTION-PAYOUT-REQUEST] Sending admin notification email...')

      const { data: bankAccount } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      const { data: paypalAccount } = await supabase
        .from('user_paypal_accounts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      // Include auction details in user_name field for now (will be visible in email)
      const auctionDetails = `${userData.user_name || 'MODEL User'} - Auction Payout (${auctions.length} auctions: ${auctions.map(a => a.title).join(', ')})`

      await emailService.sendAdminPayoutRequestNotification({
        payout_request_id: payoutRequestId,
        user_name: auctionDetails,
        user_email: user.email || '',
        user_role: 'model',
        user_id: userId,
        company_name: userData.company_name || '',
        amount: totalAmount,
        total_earnings: totalAmount,
        available_balance: totalAmount,
        previous_payouts_count: 0,
        beneficiary_name: bankAccount?.beneficiary_name,
        bank_name: bankAccount?.bank_name,
        account_type: bankAccount?.account_type,
        iban_number: bankAccount?.iban_number,
        preferred_payout_method: payoutMethod,
        paypal_email: paypalAccount?.email,
        paypal_account_type: paypalAccount?.account_type,
        request_date: new Date().toISOString()
      })

      console.log('✅ [AUCTION-PAYOUT-REQUEST] Admin notification email sent')
    } catch (emailError) {
      console.error('⚠️ [AUCTION-PAYOUT-REQUEST] Failed to send admin notification:', emailError)
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        requestId: payoutRequestId,
        amount: totalAmount,
        auctionCount: auctions.length
      }
    })

  } catch (error: any) {
    console.error('❌ [AUCTION-PAYOUT-REQUEST] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}
