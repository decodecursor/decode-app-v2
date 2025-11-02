/**
 * POST /api/auctions/[id]/video/create-session
 * Create a video recording session for the winner
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.bid_id) {
      return NextResponse.json(
        { error: 'Missing bid_id' },
        { status: 400 }
      );
    }

    const videoService = new AuctionVideoService();
    const result = await videoService.createRecordingSession({
      auction_id: params.id,
      bid_id: body.bid_id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      session: result.session,
    });
  } catch (error) {
    console.error('Error in POST /api/auctions/[id]/video/create-session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
