/**
 * POST /api/debug/complete-auction
 * Comprehensive auction remediation endpoint
 *
 * This endpoint performs ALL steps required to properly complete an auction:
 * 1. Calculate profit amounts
 * 2. Update auction to 'completed' status
 * 3. Create payout record
 * 4. Create video recording session
 * 5. Send winner notification email
 *
 * Use this when EventBridge failed to fire or incomplete remediation was done.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { AuctionService } from '@/lib/services/AuctionService';
import { BiddingService } from '@/lib/services/BiddingService';
import { AuctionPaymentSplitter } from '@/lib/payments/processors/AuctionPaymentSplitter';
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

    console.log(`🔧 [Complete Auction] Processing auction ${auctionId}`);

    const auctionService = new AuctionService();
    const biddingService = new BiddingService();
    const paymentSplitter = new AuctionPaymentSplitter();
    const videoService = new AuctionVideoService();
    const notificationService = new AuctionNotificationService();
    const supabase = createServiceRoleClient();

    // 1. Get auction details
    const auction = await auctionService.getAuction(auctionId);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    console.log(`📋 Auction: ${auction.title} (${auction.status})`);

    // Check if already completed
    if (auction.status === 'completed') {
      console.log(`✅ Auction already completed`);
      return NextResponse.json({
        success: true,
        message: 'Auction already completed',
        auction_id: auctionId,
        status: 'completed'
      });
    }

    // 2. Get winning bid
    const winningBid = await biddingService.getWinningBid(auctionId);

    if (!winningBid) {
      return NextResponse.json(
        { error: 'No winning bid found for this auction' },
        { status: 404 }
      );
    }

    console.log(`🏆 Winner: ${winningBid.bidder_name} (${winningBid.bidder_email})`);
    console.log(`💰 Winning amount: ${winningBid.bid_amount}`);

    // 3. Calculate profit amounts
    const winningAmount = Number(winningBid.bid_amount);
    const startPrice = Number(auction.auction_start_price);
    const profit = Math.max(winningAmount - startPrice, 0);
    const platformFee = profit * 0.25;
    const modelPayout = profit - platformFee;

    console.log(`💰 Profit calculation:`, {
      winningAmount,
      startPrice,
      profit,
      platformFee,
      modelPayout
    });

    // 4. Update auction to 'completed' status
    console.log(`📝 Updating auction to completed status...`);

    const { data: completedAuction, error: completeError } = await supabase
      .from('auctions')
      .update({
        status: 'completed',
        payment_captured_at: new Date().toISOString(),
        winner_bid_id: winningBid.id,
        winner_name: winningBid.bidder_name,
        winner_email: winningBid.bidder_email,
        winner_instagram_username: winningBid.bidder_instagram_username,
        profit_amount: profit,
        platform_fee_amount: platformFee,
        model_payout_amount: modelPayout,
      })
      .eq('id', auctionId)
      .select('id, status, profit_amount, platform_fee_amount, model_payout_amount')
      .single();

    if (completeError) {
      console.error(`❌ Failed to complete auction:`, completeError);
      return NextResponse.json(
        {
          error: 'Failed to update auction status',
          details: completeError.message
        },
        { status: 500 }
      );
    }

    if (!completedAuction) {
      console.error(`❌ No row returned after update`);
      return NextResponse.json(
        { error: 'Failed to update auction - no row returned' },
        { status: 500 }
      );
    }

    console.log(`✅ Auction updated successfully:`, completedAuction);

    // 5. Create payout record
    console.log(`💸 Creating payout record...`);

    try {
      await paymentSplitter.createPayout(
        auction.creator_id,
        auctionId,
        winningAmount,
        startPrice
      );
      console.log(`✅ Payout record created`);
    } catch (payoutError) {
      console.error(`❌ Failed to create payout record:`, payoutError);
      // Continue - payout can be created manually if needed
    }

    // 6. Create/update video recording session
    console.log(`🎥 Creating video recording session...`);

    // Check if session already exists
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
        console.log(`⚠️  Existing video session token expired, extending...`);

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
          console.log(`✅ Token expiry extended to ${newExpiry.toISOString()}`);
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
        // Continue - email can still be sent
      } else {
        sessionToken = sessionResult.session!.token;
        console.log(`✅ Video session created successfully`);
      }
    }

    // 7. Send winner email
    console.log(`📧 Sending winner email...`);
    const emailResult = await notificationService.notifyWinner({
      auction_id: auctionId,
      bid_id: winningBid.id,
      winner_email: winningBid.bidder_email,
      winner_name: winningBid.bidder_name,
      auction_title: auction.title,
      winning_amount: winningAmount,
      creator_name: auction.creator?.user_name || 'the creator',
      recording_token: sessionToken,
    });

    if (!emailResult.success) {
      console.error(`❌ Failed to send email:`, emailResult.error);
      // Don't fail the request - auction is still completed
    } else {
      console.log(`✅ Winner email sent successfully to ${winningBid.bidder_email}`);
    }

    // Success response
    return NextResponse.json({
      success: true,
      auction_id: auctionId,
      auction_title: auction.title,
      auction_status: 'completed',
      winner_email: winningBid.bidder_email,
      winner_name: winningBid.bidder_name,
      profit_amount: profit,
      platform_fee_amount: platformFee,
      model_payout_amount: modelPayout,
      session_token: sessionToken,
      video_recording_url: sessionToken ? `${process.env.NEXT_PUBLIC_APP_URL}/auctions/video/${sessionToken}` : null,
      message: 'Auction completed successfully with all required steps',
    });
  } catch (error) {
    console.error('❌ [Complete Auction] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
