/**
 * POST /api/debug/investigate-auction
 * Investigation endpoint for debugging auction email issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';

export async function POST(request: NextRequest) {
  try {
    const { auctionId } = await request.json();

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Missing auctionId' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const results: any = {
      auction_id: auctionId,
      timestamp: new Date().toISOString(),
    };

    // 1. Check auction status
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .single();

    if (auctionError) {
      results.auction_error = auctionError.message;
    } else if (!auction) {
      results.auction = null;
      results.error = 'Auction not found';
    } else {
      results.auction = {
        id: auction.id,
        title: auction.title,
        status: auction.status,
        winner_email: auction.winner_email,
        winner_name: auction.winner_name,
        winner_bid_id: auction.winner_bid_id,
        payment_captured_at: auction.payment_captured_at,
        created_at: auction.created_at,
        end_time: auction.end_time,
      };
    }

    // 2. Check video session
    const { data: videoSessions, error: videoError } = await supabase
      .from('auction_videos')
      .select('*')
      .eq('auction_id', auctionId);

    if (videoError) {
      results.video_error = videoError.message;
    } else {
      results.video_sessions = videoSessions || [];
      results.has_video_session = (videoSessions || []).length > 0;

      if (videoSessions && videoSessions.length > 0) {
        videoSessions.forEach((session) => {
          const tokenExpiry = new Date(session.token_expires_at);
          const now = new Date();
          session.token_expired = tokenExpiry < now;
        });
      }
    }

    // 3. Check bids
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .order('bid_amount', { ascending: false });

    if (bidsError) {
      results.bids_error = bidsError.message;
    } else {
      results.bids = bids || [];
      results.captured_bid = bids?.find((b) => b.status === 'captured');
    }

    // 4. Diagnosis
    const diagnosis: string[] = [];

    if (!results.has_video_session) {
      diagnosis.push('NO_VIDEO_SESSION: Video session was never created - this prevented email from being sent');
    }

    if (!results.captured_bid) {
      diagnosis.push('NO_CAPTURED_BID: No successful payment capture found');
    }

    if (auction && auction.status !== 'completed') {
      diagnosis.push(`WRONG_STATUS: Auction status is '${auction.status}', not 'completed'`);
    }

    if (auction && !auction.winner_email) {
      diagnosis.push('NO_WINNER_EMAIL: No winner email recorded in auction table');
    }

    if (results.captured_bid && results.captured_bid.bidder_email.includes('noemail+')) {
      diagnosis.push(`WHATSAPP_BIDDER: Winner used WhatsApp contact (${results.captured_bid.whatsapp_number})`);
    }

    results.diagnosis = diagnosis;

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('Error investigating auction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
