/**
 * POST /api/auctions/eventbridge/close
 * EventBridge Scheduler callback to close a single auction at exact end_time
 *
 * This endpoint is invoked by AWS EventBridge Scheduler at the exact moment
 * an auction ends, ensuring immediate payment capture and winner notification.
 * Updated: 2025-11-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { AuctionService } from '@/lib/services/AuctionService';
import { BiddingService } from '@/lib/services/BiddingService';
import { AuctionPaymentProcessor } from '@/lib/payments/processors/AuctionPaymentProcessor';
import { AuctionPaymentSplitter } from '@/lib/payments/processors/AuctionPaymentSplitter';
import { AuctionNotificationService } from '@/lib/services/AuctionNotificationService';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';
import { getEventBridgeScheduler } from '@/lib/services/EventBridgeScheduler';

interface EventBridgePayload {
  auctionId: string;
  source: string;
  scheduledTime: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify request is from EventBridge
    const eventBridgeSource = request.headers.get('X-EventBridge-Source');
    if (eventBridgeSource !== 'aws.scheduler') {
      console.warn('[EventBridge] Invalid source header:', eventBridgeSource);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid source' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: EventBridgePayload = await request.json();
    const { auctionId, source, scheduledTime } = body;

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Missing auctionId in payload' },
        { status: 400 }
      );
    }

    console.log(`[EventBridge] Processing auction close: ${auctionId}`, {
      source,
      scheduledTime,
      actualTime: new Date().toISOString(),
    });

    // Initialize services
    const auctionService = new AuctionService();
    const biddingService = new BiddingService();
    const paymentProcessor = new AuctionPaymentProcessor();
    const paymentSplitter = new AuctionPaymentSplitter();
    const notificationService = new AuctionNotificationService();
    const videoService = new AuctionVideoService();

    // Get auction details
    const auction = await auctionService.getAuction(auctionId);

    if (!auction) {
      console.error(`[EventBridge] Auction ${auctionId} not found`);
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // IDEMPOTENCY: Check if auction is already processed
    if (auction.status === 'completed' || auction.status === 'ended') {
      console.log(`[EventBridge] Auction ${auctionId} already processed (${auction.status})`);

      // Clean up schedule if it still exists
      if (auction.scheduler_event_id) {
        const scheduler = getEventBridgeScheduler();
        await scheduler.cancelSchedule(auction.scheduler_event_id);
      }

      return NextResponse.json({
        success: true,
        message: 'Auction already processed',
        auction_id: auctionId,
        status: auction.status,
      });
    }

    // VALIDATION: Check if auction should actually end
    if (auction.status === 'cancelled') {
      console.log(`[EventBridge] Auction ${auctionId} was cancelled`);
      return NextResponse.json({
        success: true,
        message: 'Auction was cancelled',
        auction_id: auctionId,
      });
    }

    if (auction.status !== 'active') {
      console.warn(`[EventBridge] Auction ${auctionId} has unexpected status: ${auction.status}`);
    }

    // Get winning bid
    const winningBid = await biddingService.getWinningBid(auctionId);

    if (winningBid) {
      console.log(`[EventBridge] Found winning bid ${winningBid.id} for auction ${auctionId}`);

      // Attempt to capture payment (with fallback to second highest bid)
      const captureResult = await paymentProcessor.attemptFallbackCapture(auctionId);

      if (captureResult.success) {
        // Get the actually captured bid (might be 2nd if 1st failed)
        const capturedBid =
          captureResult.bid_id === winningBid.id
            ? winningBid
            : await biddingService
                .getAuctionBids(auctionId, 2)
                .then((bids) => bids.find((b) => b.id === captureResult.bid_id));

        if (capturedBid) {
          console.log(`[EventBridge] Payment captured for bid ${capturedBid.id}`);

          // Calculate profit amounts
          const winningAmount = Number(capturedBid.bid_amount);
          const startPrice = Number(auction.auction_start_price);
          const profit = Math.max(winningAmount - startPrice, 0);
          const platformFee = profit * 0.25;
          const modelPayout = winningAmount - platformFee;

          // End auction with winner
          await auctionService.endAuction(auctionId, capturedBid.id);

          // Complete auction (mark payment captured) and save profit amounts
          await auctionService.completeAuction(auctionId);

          // Update auction with profit amounts
          console.log(`💰 [EventBridge] Saving profit amounts for auction ${auctionId}:`, {
            profit,
            platformFee,
            modelPayout
          });

          const supabase = createServiceRoleClient();
          const { data: profitData, error: profitError } = await supabase
            .from('auctions')
            .update({
              profit_amount: profit,
              platform_fee_amount: platformFee,
              model_payout_amount: modelPayout,
            })
            .eq('id', auctionId);

          if (profitError) {
            console.error(`❌ [EventBridge] Failed to save profit amounts for auction ${auctionId}:`, profitError);
            throw new Error(`Failed to save profit amounts: ${profitError.message}`);
          }

          console.log(`✅ [EventBridge] Successfully saved profit amounts for auction ${auctionId}`);

          // Create payout record with profit-based fee calculation
          await paymentSplitter.createPayout(
            auction.creator_id,
            auctionId,
            winningAmount,
            startPrice
          );

          // Create video recording session (generates secure token)
          const sessionResult = await videoService.createRecordingSession({
            auction_id: auctionId,
            bid_id: capturedBid.id,
          });

          // Send winner notification with video recording link
          if (sessionResult.success && sessionResult.session) {
            await notificationService.notifyWinner({
              auction_id: auctionId,
              bid_id: capturedBid.id,
              winner_email: capturedBid.bidder_email,
              winner_name: capturedBid.bidder_name,
              auction_title: auction.title,
              winning_amount: Number(capturedBid.bid_amount),
              recording_token: sessionResult.session.token,
            });

            console.log(`[EventBridge] Winner notification sent to ${capturedBid.bidder_email}`);
          } else {
            console.error(
              `[EventBridge] Failed to create video recording session:`,
              sessionResult.error
            );
          }

          console.log(`[EventBridge] Auction ${auctionId} closed successfully with winner`);
        } else {
          console.error(`[EventBridge] Could not find captured bid ${captureResult.bid_id}`);
        }
      } else {
        // Payment capture failed for all bids
        await auctionService.endAuction(auctionId);
        console.error(
          `[EventBridge] Failed to capture payment for auction ${auctionId}:`,
          captureResult.error
        );

        return NextResponse.json(
          {
            success: false,
            error: 'Payment capture failed',
            auction_id: auctionId,
          },
          { status: 500 }
        );
      }

      // Cancel remaining pre-authorizations
      await paymentProcessor.cancelAllPreAuths(auctionId);
    } else {
      // No bids - just end auction
      await auctionService.endAuction(auctionId);
      console.log(`[EventBridge] Auction ${auctionId} ended with no bids`);
    }

    // Clean up the EventBridge schedule
    if (auction.scheduler_event_id) {
      const scheduler = getEventBridgeScheduler();
      await scheduler.cancelSchedule(auction.scheduler_event_id);
      console.log(`[EventBridge] Cleaned up schedule ${auction.scheduler_event_id}`);
    }

    return NextResponse.json({
      success: true,
      auction_id: auctionId,
      winner_bid_id: winningBid?.id,
      message: 'Auction closed successfully',
    });
  } catch (error) {
    console.error('[EventBridge] Error closing auction:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
