/**
 * GET /api/auctions/[id]/video/session
 * Fetch existing video recording session for the winner
 * SECURITY: Only the winning bidder can fetch their session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated (optional for guest bidders)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isAuthenticated = !authError && user;

    // Get bid_id from query params
    const { searchParams } = new URL(request.url);
    const bidId = searchParams.get('bid_id');

    if (!bidId) {
      return NextResponse.json(
        { error: 'Missing bid_id parameter' },
        { status: 400 }
      );
    }

    // SECURITY CHECK 1: Verify auction exists
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('winner_bid_id, winner_email, status')
      .eq('id', params.id)
      .single();

    if (auctionError || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // SECURITY CHECK 2: Verify auction has ended and has a winner
    if (auction.status !== 'ended' && auction.status !== 'completed') {
      return NextResponse.json(
        { error: 'Auction has not ended yet' },
        { status: 400 }
      );
    }

    if (!auction.winner_bid_id || !auction.winner_email) {
      return NextResponse.json({ error: 'No winner for this auction' }, { status: 400 });
    }

    // SECURITY CHECK 3: Verify requester is the winner
    // Allow if: (authenticated AND email matches) OR (bid_id matches winner_bid_id for guests)
    const isAuthenticatedWinner = isAuthenticated && auction.winner_email === user?.email;
    const isGuestWinner = auction.winner_bid_id === bidId;

    if (!isAuthenticatedWinner && !isGuestWinner) {
      return NextResponse.json(
        { error: 'Forbidden - you are not the winner of this auction' },
        { status: 403 }
      );
    }

    // All security checks passed - get recording session
    const videoService = new AuctionVideoService();
    const result = await videoService.getRecordingSession({
      auction_id: params.id,
      bid_id: bidId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      session: result.session,
    });
  } catch (error) {
    console.error('Error in GET /api/auctions/[id]/video/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
