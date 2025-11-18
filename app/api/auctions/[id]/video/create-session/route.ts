/**
 * POST /api/auctions/[id]/video/create-session
 * Create a video recording session for the winner
 * SECURITY: Only the winning bidder can create a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // SECURITY CHECK 1: Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.bid_id) {
      return NextResponse.json(
        { error: 'Missing bid_id' },
        { status: 400 }
      );
    }

    // SECURITY CHECK 2: Verify auction exists and user is the winner
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('winner_bid_id, winner_email, status')
      .eq('id', params.id)
      .single();

    if (auctionError || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // SECURITY CHECK 3: Verify auction has ended and has a winner
    if (auction.status !== 'ended' && auction.status !== 'completed') {
      return NextResponse.json(
        { error: 'Auction has not ended yet' },
        { status: 400 }
      );
    }

    if (!auction.winner_bid_id || !auction.winner_email) {
      return NextResponse.json({ error: 'No winner for this auction' }, { status: 400 });
    }

    // SECURITY CHECK 4: Verify the provided bid_id matches the winning bid
    if (auction.winner_bid_id !== body.bid_id) {
      return NextResponse.json(
        { error: 'Invalid bid - not the winning bid' },
        { status: 403 }
      );
    }

    // SECURITY CHECK 5: Verify user's email matches the winner's email
    if (auction.winner_email !== user.email) {
      return NextResponse.json(
        { error: 'Forbidden - you are not the winner of this auction' },
        { status: 403 }
      );
    }

    // All security checks passed - create recording session
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
