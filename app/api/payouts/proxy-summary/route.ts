import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const userId = user.id
    console.log(`🔍 PAYOUT DEBUG - User ID: ${userId}`)

    // Use service role client to bypass RLS for user data (role field needs elevated access)
    const serviceClient = createServiceRoleClient()

    // Get user's bank connection status, role, and company info
    const { data: userData, error: userDataError } = await serviceClient
      .from('users')
      .select('stripe_connect_account_id, stripe_connect_status, role, company_name')
      .eq('id', userId)
      .single()

    if (userDataError) {
      console.error('🔍 PAYOUT DEBUG - User data query error:', userDataError)
    }

    // Check Stripe Connect status
    const stripeConnected = userData?.stripe_connect_status === 'active'

    // Check manual bank account entries
    let manualBankConnected = false
    try {
      const { data: bankAccounts } = await supabase
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
      
      if (bankAccounts && bankAccounts.length > 0) {
        manualBankConnected = true
      }
    } catch (error) {
      console.log('Manual bank account check failed, continuing...')
    }

    // Bank is connected if EITHER system shows connection
    const bankConnected = stripeConnected || manualBankConnected

    // Simple approach: Calculate available balance
    let userBalance = 0

    // Check user role (case-insensitive)
    const isAdmin = userData?.role?.toLowerCase() === 'admin'
    const isModel = userData?.role?.toLowerCase() === 'model'
    console.log(`🔍 PAYOUT DEBUG - User role: "${userData?.role}", isModel: ${isModel}`)

    if (isModel) {
      // MODEL: Get pending auction payouts directly from auctions table
      console.log(`💰 MODEL USER (role: ${userData.role}): Getting pending auction payouts`)

      // Fetch all completed auctions first, then filter by payout_status in code
      // (Supabase .or() doesn't work correctly when combined with .eq() filters)
      const { data: allCompletedAuctions } = await supabase
        .from('auctions')
        .select('id, title, end_time, model_payout_amount, payout_status, profit_amount, platform_fee_amount, auction_current_price, auction_start_price')
        .eq('creator_id', userId)
        .eq('status', 'completed')
        .order('end_time', { ascending: false })

      // Filter in code: include auctions where payout_status is null, pending, or processing
      const pendingAuctions = (allCompletedAuctions || []).filter(
        a => !a.payout_status || a.payout_status === 'pending' || a.payout_status === 'processing'
      )

      console.log(`🔍 PAYOUT DEBUG - Query for pending auctions: creator_id=${userId}, status=completed, payout_status=pending OR null`)
      console.log(`🔍 PAYOUT DEBUG - Found ${pendingAuctions?.length || 0} pending auctions:`, pendingAuctions)
      console.log(`💰 Found ${pendingAuctions?.length || 0} pending auction payouts`)

      // Fetch video status for all pending auctions
      const auctionIds = (pendingAuctions || []).map(a => a.id)
      let videoMap = new Map<string, { file_url: string | null, watched_to_end_at: string | null, payout_unlocked_at: string | null }>()

      if (auctionIds.length > 0) {
        const { data: videoRecords } = await supabase
          .from('auction_videos')
          .select('auction_id, file_url, watched_to_end_at, payout_unlocked_at')
          .in('auction_id', auctionIds)

        videoMap = new Map(
          (videoRecords || []).map(v => [v.auction_id, v])
        )
      }

      // Calculate total pending balance
      userBalance = (pendingAuctions || []).reduce((sum, auction) => {
        return sum + (Number(auction.model_payout_amount) || 0)
      }, 0)

      console.log(`💰 MODEL Total Pending Balance: ${userBalance}`)

      // Format pending payouts for response
      const formattedPendingPayouts = (pendingAuctions || []).map(auction => {
        const video = videoMap.get(auction.id)
        const hasVideo = !!(video && video.file_url)
        const videoWatched = !!(video && video.watched_to_end_at)
        // Payout unlocked if: no video record OR no file_url OR payout_unlocked_at is set
        const payoutUnlocked = !video || !hasVideo || !!(video && video.payout_unlocked_at)

        return {
          auction_id: auction.id,
          auction_title: auction.title || 'Untitled Auction',
          ended_at: auction.end_time,
          model_amount: Number(auction.model_payout_amount),
          payout_status: auction.payout_status,
          // Profit breakdown
          winning_amount: Number(auction.auction_current_price) || 0,
          start_price: Number(auction.auction_start_price) || 0,
          profit_amount: Number(auction.profit_amount) || 0,
          platform_fee_amount: Number(auction.platform_fee_amount) || 0,
          // Video status
          has_video: hasVideo,
          video_watched: videoWatched,
          payout_unlocked: payoutUnlocked
        }
      })

      // Get total paid out amount from auctions
      const { data: paidAuctions } = await supabase
        .from('auctions')
        .select('model_payout_amount')
        .eq('creator_id', userId)
        .eq('payout_status', 'transferred')

      const totalPaidOut = (paidAuctions || []).reduce((sum, auction) => {
        return sum + (Number(auction.model_payout_amount) || 0)
      }, 0)

      // Get last payout from auctions (most recent transferred payout)
      const { data: lastPayoutAuction } = await supabase
        .from('auctions')
        .select('model_payout_amount, payment_captured_at')
        .eq('creator_id', userId)
        .eq('payout_status', 'transferred')
        .not('payment_captured_at', 'is', null)
        .order('payment_captured_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const payoutSummary = {
        availableBalance: userBalance,
        pendingBalance: userBalance,
        pendingPayouts: formattedPendingPayouts,
        totalEarnings: userBalance + totalPaidOut,
        totalPaidOut,
        lastPayoutAmount: lastPayoutAuction ? Number(lastPayoutAuction.model_payout_amount) : 0,
        lastPayoutDate: lastPayoutAuction?.payment_captured_at || null,
        bankConnected
      }

      console.log(`🔍 PAYOUT DEBUG - Returning payoutSummary with ${formattedPendingPayouts.length} pending payouts`)

      return NextResponse.json({
        payoutSummary,
        success: true
      })

    } else if (isAdmin) {
      // ADMIN: Get today's paid payment links and sum FULL service_amount_aed
      console.log(`💰 ADMIN USER (role: ${userData.role}): Getting today's full service revenue`)

      const today = new Date()
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      console.log(`💰 Date range: ${startOfToday.toISOString()} to ${endOfToday.toISOString()}`)

      // Build query for payment links
      let query = supabase
        .from('payment_links')
        .select('service_amount_aed, amount_aed, paid_at, client_name, company_name')
        .not('paid_at', 'is', null)
        .gte('paid_at', startOfToday.toISOString())
        .lt('paid_at', endOfToday.toISOString())

      // If company_name exists, filter by it. Otherwise get all payment links for today
      if (userData.company_name) {
        console.log(`💰 Filtering by company: "${userData.company_name}"`)
        query = query.eq('company_name', userData.company_name)
      } else {
        console.log(`💰 No company_name set, getting ALL payment links for today`)
      }

      const { data: adminPaymentLinks } = await query

      console.log(`💰 Found ${adminPaymentLinks?.length || 0} paid payment links for today`)

      if (adminPaymentLinks && adminPaymentLinks.length > 0) {
        console.log(`💰 Payment links data:`, adminPaymentLinks.map(link => ({
          client_name: link.client_name,
          company_name: link.company_name,
          service_amount_aed: link.service_amount_aed,
          amount_aed: link.amount_aed,
          paid_at: link.paid_at
        })))

        // Sum all service_amount_aed for today (FULL AMOUNT for ADMIN)
        userBalance = adminPaymentLinks.reduce((sum, link) => {
          const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91) || 0
          console.log(`💰 Adding FULL service amount: ${serviceAmount}`)
          return sum + serviceAmount
        }, 0)

        console.log(`💰 ADMIN TOTAL SERVICE REVENUE FOR TODAY (FULL AMOUNT): ${userBalance}`)
      } else {
        console.log(`💰 No paid payment links found for today`)
        userBalance = 0
      }

    } else {
      // STAFF: Get personal payment links and use 1% commission
      console.log(`💰 STAFF USER (role: ${userData?.role}): Getting personal payment links for 1% commission`)

      const { data: staffPaymentLinks } = await supabase
        .from('payment_links')
        .select('service_amount_aed, amount_aed')
        .eq('creator_id', userId)
        .not('paid_at', 'is', null)

      const totalServiceRevenue = (staffPaymentLinks || []).reduce((sum, link) => {
        const serviceAmount = link.service_amount_aed || (link.amount_aed * 0.91) || 0
        return sum + serviceAmount
      }, 0)

      userBalance = totalServiceRevenue * 0.01
      console.log(`💰 STAFF: Total service revenue: ${totalServiceRevenue}, 1% commission: ${userBalance}`)
    }

    // Quick fix: If ADMIN but fell through to staff calculation, multiply by 100
    if (userData?.role?.toLowerCase() === 'admin' && userBalance > 0) {
      userBalance = userBalance * 100
      console.log(`💰 ADMIN FIX: Multiplied by 100 to get full amount: ${userBalance}`)
    }

    // Get earnings from completed transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        amount_aed,
        status,
        completed_at,
        payment_link:payment_link_id (
          creator_id
        )
      `)
      .eq('status', 'completed')
      .eq('payment_link.creator_id', userId)

    const totalEarnings = (transactions || []).reduce((sum, t) => sum + (t.amount_aed || 0), 0)

    // Get all payouts (both paid and pending) to calculate total requested
    const { data: allPayouts } = await supabase
      .from('payouts')
      .select('payout_amount_aed, status')
      .eq('user_id', userId)
      .in('status', ['paid', 'pending'])

    const totalRequestedPayouts = (allPayouts || []).reduce((sum, p) => sum + (p.payout_amount_aed || 0), 0)

    // Get last payout
    const { data: lastPayout } = await supabase
      .from('payouts')
      .select('payout_amount_aed, paid_at')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Calculate available balance
    // For ADMIN: Show raw sum of today's service revenue without deducting payouts
    // For STAFF: Subtract requested payouts from commission balance
    const availableBalance = isAdmin
      ? userBalance
      : Math.max(0, userBalance - totalRequestedPayouts)

    console.log(`💰 Total Requested Payouts: ${totalRequestedPayouts}`)
    console.log(`💰 Available Balance: ${availableBalance} (${isAdmin ? 'ADMIN: Today\'s full service revenue' : `${userBalance} - ${totalRequestedPayouts}`})`)

    const payoutSummary = {
      availableBalance,
      pendingBalance: availableBalance,
      totalEarnings,
      totalPaidOut: totalRequestedPayouts,
      lastPayoutAmount: lastPayout?.payout_amount_aed || 0,
      lastPayoutDate: lastPayout?.paid_at || null,
      bankConnected
    }

    return NextResponse.json({ 
      payoutSummary,
      success: true 
    })
    
  } catch (error: any) {
    console.error('Proxy payout summary error:', error)
    return NextResponse.json(
      { error: 'Server error loading payout data', details: error.message },
      { status: 500 }
    )
  }
}