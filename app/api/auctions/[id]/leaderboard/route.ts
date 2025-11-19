/**
 * GET /api/auctions/[id]/leaderboard
 * Get live bidding leaderboard with bidder names
 */

import { NextRequest, NextResponse } from 'next/server';
import { BiddingService } from '@/lib/services/BiddingService';
import { formatBidderNameForLeaderboard } from '@/lib/models/Bid.model';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    const showFullNames = searchParams.get('show_full_names') === 'true';

    const biddingService = new BiddingService();
    const bids = await biddingService.getAuctionBids(params.id, limit);

    // Format leaderboard - show full names
    const leaderboard = bids.map((bid, index) => ({
      rank: index + 1,
      bidder_name: bid.bidder_name,
      bid_amount: Number(bid.bid_amount),
      placed_at: bid.placed_at,
      status: bid.status,
    }));

    // Get statistics
    const stats = await biddingService.getBidStatistics(params.id);

    return NextResponse.json({
      success: true,
      leaderboard,
      statistics: stats,
    });
  } catch (error) {
    console.error('Error in GET /api/auctions/[id]/leaderboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
