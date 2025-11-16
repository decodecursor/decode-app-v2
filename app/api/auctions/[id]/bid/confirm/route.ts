/**
 * POST /api/auctions/[id]/bid/confirm
 * Confirm bid payment authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { BiddingService } from '@/lib/services/BiddingService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.bid_id) {
      return NextResponse.json(
        { error: 'Missing required field: bid_id' },
        { status: 400 }
      );
    }

    const biddingService = new BiddingService();
    const result = await biddingService.confirmBidPayment(body.bid_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment authorized successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/auctions/[id]/bid/confirm:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
