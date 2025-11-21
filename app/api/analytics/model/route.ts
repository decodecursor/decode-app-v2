import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { USER_ROLES } from '@/types/user'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a MODEL
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== USER_ROLES.MODEL) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get period from query params
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'month'

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        startDate = new Date('2020-01-01')
        break
    }

    // Fetch auctions data
    const { data: auctions, error: auctionsError } = await supabase
      .from('auctions')
      .select(`
        id,
        auction_title,
        auction_starting_price,
        auction_current_price,
        status,
        created_at,
        ends_at,
        total_bids
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())

    if (auctionsError) {
      console.error('Error fetching auctions:', auctionsError)
    }

    // Fetch bids data
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('id, auction_id, bid_amount')
      .in('auction_id', auctions?.map(a => a.id) || [])

    if (bidsError) {
      console.error('Error fetching bids:', bidsError)
    }

    // Calculate analytics
    const totalAuctions = auctions?.length || 0
    const activeAuctions = auctions?.filter(a => a.status === 'active').length || 0
    const completedAuctions = auctions?.filter(a => a.status === 'completed') || []
    const totalBids = bids?.length || 0

    // Calculate total funds collected
    const totalFundsCollected = completedAuctions.reduce(
      (sum, auction) => sum + (Number(auction.auction_current_price) || 0),
      0
    )

    // Mock beauty services revenue (70% of total)
    const beautyServicesRevenue = totalFundsCollected * 0.78

    // Mock profit (35% margin)
    const totalProfit = totalFundsCollected * 0.36

    // Calculate conversion rate
    const conversionRate = totalAuctions > 0
      ? (completedAuctions.length / totalAuctions) * 100
      : 0

    // Calculate average auction value
    const avgAuctionValue = completedAuctions.length > 0
      ? totalFundsCollected / completedAuctions.length
      : 0

    // Mock top service
    const topService = {
      name: "Premium Makeup Package",
      revenue: beautyServicesRevenue * 0.362
    }

    // Mock retention rate
    const retentionRate = 65.3

    // Prepare revenue by period data (last 7 days)
    const revenueByPeriod = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayAuctions = auctions?.filter(a => {
        const auctionDate = new Date(a.created_at)
        return auctionDate >= date && auctionDate < nextDate && a.status === 'completed'
      }) || []

      const dayRevenue = dayAuctions.reduce(
        (sum, a) => sum + (Number(a.auction_current_price) || 0),
        0
      )

      revenueByPeriod.push({
        date: date.toISOString().split('T')[0],
        amount: dayRevenue
      })
    }

    // Mock service breakdown
    const serviceBreakdown = [
      { service: 'Premium Makeup', revenue: beautyServicesRevenue * 0.362, percentage: 36.2 },
      { service: 'Bridal Services', revenue: beautyServicesRevenue * 0.294, percentage: 29.4 },
      { service: 'Hair Styling', revenue: beautyServicesRevenue * 0.225, percentage: 22.5 },
      { service: 'Spa Treatments', revenue: beautyServicesRevenue * 0.119, percentage: 11.9 },
    ]

    // Auction performance
    const auctionPerformance = [
      { status: 'Completed', count: completedAuctions.length },
      { status: 'Active', count: activeAuctions },
      { status: 'Cancelled', count: auctions?.filter(a => a.status === 'cancelled').length || 0 },
    ]

    // Recent auctions (last 5)
    const recentAuctions = (auctions || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(auction => ({
        id: auction.id,
        title: auction.auction_title,
        revenue: Number(auction.auction_current_price) || 0,
        date: auction.created_at,
        status: auction.status
      }))

    // Return analytics data
    return NextResponse.json({
      success: true,
      analytics: {
        // Core metrics
        totalFundsCollected,
        beautyServicesRevenue,
        totalProfit,
        totalAuctions,

        // Additional metrics
        activeAuctions,
        totalBids,
        conversionRate,
        avgAuctionValue,
        topService,
        retentionRate,

        // Chart data
        revenueByPeriod,
        serviceBreakdown,
        auctionPerformance,

        // Recent activity
        recentAuctions
      }
    })

  } catch (error) {
    console.error('Error in analytics API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}