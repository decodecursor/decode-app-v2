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
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const biddingService = new BiddingService();
    const bids = await biddingService.getUserBids(params.id, email);

    return NextResponse.json({
      success: true,
      bids,
    });
  } catch (error) {
    console.error('Error in GET /api/auctions/[id]/user-bids:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
