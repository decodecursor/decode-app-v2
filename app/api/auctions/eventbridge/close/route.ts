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
  action?: string; // 'unlock-payout' for payout unlock, undefined for auction close
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body first
    const body: EventBridgePayload = await request.json();
    const { auctionId, source, scheduledTime, action } = body;

    // Verify request is from EventBridge via Lambda
    if (source !== 'eventbridge-scheduler') {
      console.warn('[EventBridge] Invalid source:', source);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid source' },
        { status: 401 }
      );
    }

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Missing auctionId in payload' },
        { status: 400 }
      );
    }

    // Route to payout unlock handler if action is 'unlock-payout'
    if (action === 'unlock-payout') {
      return handlePayoutUnlock(auctionId, scheduledTime);
    }

    console.log(`[EventBridge] Processing auction close: ${auctionId}`, {
      source,
      scheduledTime,
      actualTime: new Date().toISOString(),
    });

    // Initialize services
    const supabase = createServiceRoleClient(); // Service role for bid queries
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
    let winningBid = await biddingService.getWinningBid(auctionId);

    // CRITICAL FIX: Fallback if no bid marked as 'winning'
    // Find highest bid with authorized payment manually by querying ALL bids
    if (!winningBid) {
      console.warn(`[EventBridge] No bid marked as 'winning', finding highest bid manually`);

      // Query ALL bids directly (bypass getAuctionBids status filter)
      const { data: allBids, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .order('bid_amount', { ascending: false });

      if (bidsError) {
        console.error(`[EventBridge] Error fetching bids:`, bidsError);
      } else if (allBids && allBids.length > 0) {
        console.log(`[EventBridge] Found ${allBids.length} total bids for auction ${auctionId}`);

        // Filter for bids with authorized payments
        const authorizedBids = allBids.filter(b =>
          b.payment_intent_status === 'requires_capture' ||
          b.payment_intent_status === 'captured'
        );

        if (authorizedBids.length > 0) {
          winningBid = authorizedBids[0]; // Already sorted by bid_amount DESC
          console.log(`[EventBridge] Found highest authorized bid manually:`, {
            bid_id: winningBid.id,
            bid_amount: winningBid.bid_amount,
            status: winningBid.status,
            payment_intent_status: winningBid.payment_intent_status
          });
        } else {
          console.warn(`[EventBridge] No authorized bids found. All ${allBids.length} bids have payment_intent_status:`,
            allBids.map(b => ({ id: b.id, payment_intent_status: b.payment_intent_status }))
          );
        }
      } else {
        console.warn(`[EventBridge] No bids found at all for auction ${auctionId}`);
      }
    }

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
          const modelPayout = profit - platformFee;

          console.log(`💰 [EventBridge] Completing auction ${auctionId} with profit amounts:`, {
            profit,
            platformFee,
            modelPayout
          });

          // ATOMIC UPDATE: Complete auction with all fields in single transaction
          const supabase = createServiceRoleClient();
          const { data: completedAuction, error: completeError } = await supabase
            .from('auctions')
            .update({
              status: 'completed',
              payment_captured_at: new Date().toISOString(),
              winner_bid_id: capturedBid.id,
              winner_name: capturedBid.bidder_name,
              winner_email: capturedBid.bidder_email,
              winner_instagram_username: capturedBid.bidder_instagram_username,
              profit_amount: profit,
              platform_fee_amount: platformFee,
              model_payout_amount: modelPayout,
            })
            .eq('id', auctionId)
            .select('id, status, profit_amount, platform_fee_amount, model_payout_amount')
            .single();

          if (completeError) {
            console.error(`❌ [EventBridge] Failed to complete auction ${auctionId}:`, completeError);
            throw new Error(`Failed to complete auction: ${completeError.message}`);
          }

          if (!completedAuction) {
            console.error(`❌ [EventBridge] No row returned - auction ${auctionId} may not exist`);
            throw new Error(`Failed to complete auction: No row updated for auction ${auctionId}`);
          }

          console.log(`✅ [EventBridge] Auction completed successfully:`, completedAuction);

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

          // CRITICAL: Always send winner notification, even if video session creation fails
          // This ensures winners are notified even when there are technical issues
          const emailResult = await notificationService.notifyWinner({
            auction_id: auctionId,
            bid_id: capturedBid.id,
            winner_email: capturedBid.bidder_email,
            winner_name: capturedBid.bidder_name,
            auction_title: auction.title,
            winning_amount: Number(capturedBid.bid_amount),
            creator_name: auction.creator?.user_name || 'the creator',
            recording_token: sessionResult.success && sessionResult.session ? sessionResult.session.token : undefined,
          });

          if (emailResult.success) {
            console.log(`✅ [EventBridge] Winner notification sent to ${capturedBid.bidder_email}`);
          } else {
            console.error(
              `❌ [EventBridge] Failed to send winner notification:`,
              emailResult.error
            );
          }

          if (!sessionResult.success) {
            console.error(
              `⚠️  [EventBridge] Failed to create video recording session:`,
              sessionResult.error
            );
            console.log(`   Email was still sent without video recording link`);
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

/**
 * Handle payout unlock action
 * Called 24 hours after auction closes if winner didn't upload video
 */
async function handlePayoutUnlock(auctionId: string, scheduledTime: string): Promise<NextResponse> {
  console.log(`[EventBridge/UnlockPayout] Processing payout unlock for auction: ${auctionId}`, {
    scheduledTime,
    actualTime: new Date().toISOString(),
  });

  const supabase = createServiceRoleClient();

  // Get video record for this auction
  const { data: video, error: videoError } = await supabase
    .from('auction_videos')
    .select('id, file_url, payout_unlocked_at')
    .eq('auction_id', auctionId)
    .single();

  if (videoError) {
    // No video record exists - this shouldn't happen but handle gracefully
    console.log(`[EventBridge/UnlockPayout] No video record found for auction ${auctionId}`);
    return NextResponse.json({
      success: true,
      message: 'No video record found - nothing to unlock',
      auction_id: auctionId,
    });
  }

  // Check if already unlocked (idempotent)
  if (video.payout_unlocked_at) {
    console.log(`[EventBridge/UnlockPayout] Payout already unlocked for auction ${auctionId}`);
    return NextResponse.json({
      success: true,
      message: 'Payout already unlocked',
      auction_id: auctionId,
      payout_unlocked_at: video.payout_unlocked_at,
    });
  }

  // Check if video was uploaded
  const hasVideo = video.file_url && video.file_url.trim() !== '';

  if (hasVideo) {
    // Video exists - model must watch it to unlock, don't auto-unlock
    console.log(`[EventBridge/UnlockPayout] Video exists for auction ${auctionId} - model must watch to unlock`);
    return NextResponse.json({
      success: true,
      message: 'Video uploaded - model must watch to unlock payout',
      auction_id: auctionId,
      requires_watch: true,
    });
  }

  // No video uploaded within 24 hours - auto-unlock payout
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('auction_videos')
    .update({
      payout_unlocked_at: now,
      // Note: watched_to_end_at stays NULL to indicate auto-unlock (no video to watch)
    })
    .eq('id', video.id);

  if (updateError) {
    console.error(`[EventBridge/UnlockPayout] Failed to unlock payout for auction ${auctionId}:`, updateError);
    return NextResponse.json(
      { error: 'Failed to unlock payout' },
      { status: 500 }
    );
  }

  console.log(`✅ [EventBridge/UnlockPayout] Auto-unlocked payout for auction ${auctionId} (no video uploaded within 24hr)`);

  return NextResponse.json({
    success: true,
    message: 'Payout auto-unlocked (no video uploaded)',
    auction_id: auctionId,
    payout_unlocked_at: now,
  });
}
