/**
 * GET /api/auctions/[id]/user-bids
 * Get user's previous bids on an auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { BiddingService } from '@/lib/services/BiddingService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = performance.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    console.log('[API /user-bids] Request received:', {
      auction_id: params.id,
      email: email ? `${email.substring(0, 3)}***` : 'missing', // Partial email for privacy
      timestamp: new Date().toISOString()
    });

    if (!email) {
      console.warn('[API /user-bids] Missing email parameter');
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const biddingService = new BiddingService();
    const bids = await biddingService.getUserBids(params.id, email);

    const duration = performance.now() - startTime;
    console.log('[API /user-bids] Query completed:', {
      auction_id: params.id,
      bid_count: bids?.length || 0,
      duration_ms: Math.round(duration),
      has_instagram: bids && bids.length > 0 ? !!bids[0].bidder_instagram_username : null
    });

    return NextResponse.json({
      success: true,
      bids,
    });
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error('[API /user-bids] Error:', {
      auction_id: params.id,
      duration_ms: Math.round(duration),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
