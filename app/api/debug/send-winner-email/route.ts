/**
 * POST /api/debug/send-winner-email
 * Manual remediation endpoint to send winner email for a specific auction
 * This creates/recreates video session and sends email with extended token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { AuctionService } from '@/lib/services/AuctionService';
import { BiddingService } from '@/lib/services/BiddingService';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';
import { AuctionNotificationService } from '@/lib/services/AuctionNotificationService';

export async function POST(request: NextRequest) {
  try {
    const { auctionId } = await request.json();

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Missing auctionId' },
        { status: 400 }
      );
    }

    console.log(`🔧 [Manual Remediation] Processing auction ${auctionId}`);

    const auctionService = new AuctionService();
    const biddingService = new BiddingService();
    const videoService = new AuctionVideoService();
    const notificationService = new AuctionNotificationService();

    // 1. Get auction details
    const auction = await auctionService.getAuction(auctionId);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    console.log(`📋 Auction: ${auction.title} (${auction.status})`);

    // 2. Get winning bid
    const winningBid = await biddingService.getWinningBid(auctionId);

    if (!winningBid) {
      return NextResponse.json(
        { error: 'No winning bid found for this auction' },
        { status: 404 }
      );
    }

    console.log(`🏆 Winner: ${winningBid.bidder_name} (${winningBid.bidder_email})`);

    // 3. Check if video session already exists
    const supabase = createServiceRoleClient();
    const { data: existingSession } = await supabase
      .from('auction_videos')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('bid_id', winningBid.id)
      .single();

    let sessionToken: string | undefined;

    if (existingSession && !existingSession.deleted_at) {
      // Check if token is expired
      const tokenExpiry = new Date(existingSession.token_expires_at);
      const now = new Date();

      if (tokenExpiry < now) {
        console.log(`⚠️  Existing video session token expired at ${tokenExpiry.toISOString()}`);
        console.log(`   Extending token expiry to ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}`);

        // Extend token expiry by 24 hours from now
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 24);

        const { error: updateError } = await supabase
          .from('auction_videos')
          .update({ token_expires_at: newExpiry.toISOString() })
          .eq('id', existingSession.id);

        if (updateError) {
          console.error(`❌ Failed to extend token expiry:`, updateError);
        } else {
          console.log(`✅ Token expiry extended successfully`);
        }

        sessionToken = existingSession.recording_token;
      } else {
        console.log(`✅ Video session already exists with valid token (expires: ${tokenExpiry.toISOString()})`);
        sessionToken = existingSession.recording_token;
      }
    } else {
      // Create new video session
      console.log(`🎥 Creating new video recording session...`);
      const sessionResult = await videoService.createRecordingSession({
        auction_id: auctionId,
        bid_id: winningBid.id,
      });

      if (!sessionResult.success) {
        console.error(`❌ Failed to create video session:`, sessionResult.error);
        return NextResponse.json(
          {
            error: 'Failed to create video recording session',
            details: sessionResult.error,
          },
          { status: 500 }
        );
      }

      sessionToken = sessionResult.session!.token;
      console.log(`✅ Video session created successfully`);
    }

    // 4. Send winner email
    console.log(`📧 Sending winner email...`);
    const emailResult = await notificationService.notifyWinner({
      auction_id: auctionId,
      bid_id: winningBid.id,
      winner_email: winningBid.bidder_email,
      winner_name: winningBid.bidder_name,
      auction_title: auction.title,
      winning_amount: Number(winningBid.bid_amount),
      recording_token: sessionToken,
    });

    if (!emailResult.success) {
      console.error(`❌ Failed to send email:`, emailResult.error);
      return NextResponse.json(
        {
          error: 'Failed to send winner email',
          details: emailResult.error,
          session_token: sessionToken, // Return token anyway so admin can manually share
        },
        { status: 500 }
      );
    }

    console.log(`✅ Winner email sent successfully to ${winningBid.bidder_email}`);

    return NextResponse.json({
      success: true,
      auction_id: auctionId,
      auction_title: auction.title,
      winner_email: winningBid.bidder_email,
      winner_name: winningBid.bidder_name,
      session_token: sessionToken,
      video_recording_url: `${process.env.NEXT_PUBLIC_APP_URL}/auctions/video/${sessionToken}`,
      message: 'Winner email sent successfully with video recording link',
    });
  } catch (error) {
    console.error('❌ [Manual Remediation] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
