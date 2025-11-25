/**
 * POST /api/auctions/cron/close-auctions
 * Cron job to close ended auctions and capture payments
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

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auctionService = new AuctionService();
    const biddingService = new BiddingService();
    const paymentProcessor = new AuctionPaymentProcessor();
    const paymentSplitter = new AuctionPaymentSplitter();
    const notificationService = new AuctionNotificationService();
    const videoService = new AuctionVideoService();

    // Get active auctions that have ended
    const endedAuctions = await auctionService.getActiveAuctions();

    let closedCount = 0;
    let errors = [];

    for (const auction of endedAuctions) {
      try {
        console.log(`Processing ended auction: ${auction.id}`);

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
              // Calculate profit amounts
              const winningAmount = Number(capturedBid.bid_amount);
              const startPrice = Number(auction.auction_start_price);
              const profit = Math.max(winningAmount - startPrice, 0);
              const platformFee = profit * 0.25;
              const modelPayout = winningAmount - platformFee;

              // End auction with winner
              await auctionService.endAuction(auction.id, capturedBid.id);

              // Complete auction (mark payment captured)
              await auctionService.completeAuction(auction.id);

              // Update auction with profit amounts
              console.log(`💰 [Cron] Saving profit amounts for auction ${auction.id}:`, {
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
                .eq('id', auction.id)
                .select('id, profit_amount, platform_fee_amount, model_payout_amount')
                .single();

              if (profitError) {
                console.error(`❌ [Cron] Failed to save profit amounts for auction ${auction.id}:`, profitError);
                errors.push({
                  auction_id: auction.id,
                  error: `Failed to save profit amounts: ${profitError.message}`
                });
                continue; // Skip to next auction instead of throwing
              }

              if (!profitData) {
                console.error(`❌ [Cron] No row returned - auction ${auction.id} may not exist`);
                errors.push({
                  auction_id: auction.id,
                  error: `Failed to save profit amounts: No row updated`
                });
                continue;
              }

              console.log(`✅ [Cron] Verified saved profit amounts for auction ${auction.id}:`, profitData);

              // Create payout record with profit-based fee calculation
              await paymentSplitter.createPayout(
                auction.creator_id,
                auction.id,
                winningAmount,
                startPrice
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
                  winning_amount: Number(capturedBid.bid_amount),
                  recording_token: sessionResult.session.token,
                });
              }

              console.log(`Auction ${auction.id} closed successfully with winner`);
            }
          } else {
            // Payment capture failed
            await auctionService.endAuction(auction.id);
            errors.push({
              auction_id: auction.id,
              error: 'Payment capture failed',
            });
            console.error(`Failed to capture payment for auction ${auction.id}`);
          }

          // Cancel remaining pre-auths
          await paymentProcessor.cancelAllPreAuths(auction.id);
        } else {
          // No bids - just end auction
          await auctionService.endAuction(auction.id);
          console.log(`Auction ${auction.id} ended with no bids`);
        }

        // Send auction ended notification to creator
        // TODO: Fetch creator details from users table using auction.creator_id
        // For now, skip creator notification in cron job
        // Creators can check dashboard for results

        closedCount++;
      } catch (error) {
        console.error(`Error processing auction ${auction.id}:`, error);
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
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in POST /api/auctions/cron/close-auctions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
