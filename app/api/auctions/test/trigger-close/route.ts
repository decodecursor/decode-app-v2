/**
 * POST /api/auctions/test/trigger-close
 * Manual trigger to close ended auctions (for testing)
 * IMPORTANT: Only use in development/testing - production uses cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionService } from '@/lib/services/AuctionService';
import { BiddingService } from '@/lib/services/BiddingService';
import { AuctionPaymentProcessor } from '@/lib/payments/processors/AuctionPaymentProcessor';
import { AuctionPaymentSplitter } from '@/lib/payments/processors/AuctionPaymentSplitter';
import { AuctionNotificationService } from '@/lib/services/AuctionNotificationService';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development/test environments
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Manual trigger not allowed in production' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const specificAuctionId = body.auction_id;

    const auctionService = new AuctionService();
    const biddingService = new BiddingService();
    const paymentProcessor = new AuctionPaymentProcessor();
    const paymentSplitter = new AuctionPaymentSplitter();
    const notificationService = new AuctionNotificationService();
    const videoService = new AuctionVideoService();

    // Get active auctions that have ended (or specific auction)
    let endedAuctions = await auctionService.getActiveAuctions();

    // Filter to specific auction if provided
    if (specificAuctionId) {
      endedAuctions = endedAuctions.filter(a => a.id === specificAuctionId);
      if (endedAuctions.length === 0) {
        return NextResponse.json(
          { error: 'Auction not found or not ended' },
          { status: 404 }
        );
      }
    }

    let closedCount = 0;
    let errors = [];
    let details = [];

    for (const auction of endedAuctions) {
      try {
        console.log(`[MANUAL TRIGGER] Processing ended auction: ${auction.id}`);

        // Get winning bid
        const winningBid = await biddingService.getWinningBid(auction.id);

        if (winningBid) {
          // Attempt to capture payment (with fallback to second bid)
          const captureResult = await paymentProcessor.attemptFallbackCapture(auction.id);

          if (captureResult.success) {
            // Get the actually captured bid
            const capturedBid = captureResult.bid_id === winningBid.id
              ? winningBid
              : await biddingService.getAuctionBids(auction.id, 2).then(bids =>
                  bids.find(b => b.id === captureResult.bid_id)
                );

            if (capturedBid) {
              // End auction with winner
              await auctionService.endAuction(auction.id, capturedBid.id);

              // Complete auction (mark payment captured)
              await auctionService.completeAuction(auction.id);

              // Create payout record
              await paymentSplitter.createPayout(
                auction.creator_id,
                auction.id,
                Number(capturedBid.amount)
              );

              // Create video recording session
              const sessionResult = await videoService.createRecordingSession({
                auction_id: auction.id,
                bid_id: capturedBid.id,
              });

              // Send winner notification
              if (sessionResult.success && sessionResult.session) {
                await notificationService.notifyWinner({
                  auction_id: auction.id,
                  bid_id: capturedBid.id,
                  winner_email: capturedBid.bidder_email,
                  winner_name: capturedBid.bidder_name,
                  auction_title: auction.title,
                  winning_amount: Number(capturedBid.amount),
                  recording_token: sessionResult.session.token,
                });

                details.push({
                  auction_id: auction.id,
                  winner_email: capturedBid.bidder_email,
                  recording_token: sessionResult.session.token,
                  status: 'success',
                });
              }

              console.log(`[MANUAL TRIGGER] Auction ${auction.id} closed successfully with winner`);
            }
          } else {
            // Payment capture failed
            await auctionService.endAuction(auction.id);
            errors.push({
              auction_id: auction.id,
              error: 'Payment capture failed',
            });
            console.error(`[MANUAL TRIGGER] Failed to capture payment for auction ${auction.id}`);
          }

          // Cancel remaining pre-auths
          await paymentProcessor.cancelAllPreAuths(auction.id);
        } else {
          // No bids - just end auction
          await auctionService.endAuction(auction.id);
          details.push({
            auction_id: auction.id,
            status: 'ended_no_bids',
          });
          console.log(`[MANUAL TRIGGER] Auction ${auction.id} ended with no bids`);
        }

        closedCount++;
      } catch (error) {
        console.error(`[MANUAL TRIGGER] Error processing auction ${auction.id}:`, error);
        errors.push({
          auction_id: auction.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      closed_count: closedCount,
      total_processed: endedAuctions.length,
      details,
      errors: errors.length > 0 ? errors : undefined,
      note: 'Manual trigger completed. Check console logs for details.',
    });
  } catch (error) {
    console.error('[MANUAL TRIGGER] Error in POST /api/auctions/test/trigger-close:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
