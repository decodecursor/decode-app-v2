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
import { emailService } from '@/lib/email-service';

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
            // CRITICAL FIX: Always fetch fresh bid data by ID to ensure correct winner info
            // Don't trust winningBid data which may be stale or from wrong bid
            const supabase = createServiceRoleClient();
            const { data: capturedBid, error: capturedBidError } = await supabase
              .from('bids')
              .select('*')
              .eq('id', captureResult.bid_id)
              .single();

            if (capturedBidError) {
              console.error(`[Cron] Error fetching captured bid:`, capturedBidError);
            }

            // CRITICAL: Log full captured bid data for debugging winner selection issues
            console.log('[Cron] Captured bid data:', {
              bid_id: capturedBid?.id,
              bid_amount: capturedBid?.bid_amount,
              bidder_email: capturedBid?.bidder_email,
              bidder_name: capturedBid?.bidder_name,
              bidder_instagram: capturedBid?.bidder_instagram_username,
              status: capturedBid?.status,
              payment_intent_status: capturedBid?.payment_intent_status,
              captureResult_bid_id: captureResult.bid_id
            });

            if (capturedBid) {
              // Calculate profit amounts
              const winningAmount = Number(capturedBid.bid_amount);
              const startPrice = Number(auction.auction_start_price);
              const profit = Math.max(winningAmount - startPrice, 0);
              const platformFee = profit * 0.25;
              const modelPayout = profit - platformFee;

              console.log(`💰 [Cron] Completing auction ${auction.id} with profit amounts:`, {
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
                .eq('id', auction.id)
                .select('id, status, profit_amount, platform_fee_amount, model_payout_amount')
                .single();

              if (completeError) {
                console.error(`❌ [Cron] Failed to complete auction ${auction.id}:`, completeError);
                errors.push({
                  auction_id: auction.id,
                  error: `Failed to complete auction: ${completeError.message}`
                });
                continue; // Skip to next auction instead of throwing
              }

              if (!completedAuction) {
                console.error(`❌ [Cron] No row returned - auction ${auction.id} may not exist`);
                errors.push({
                  auction_id: auction.id,
                  error: `Failed to complete auction: No row updated`
                });
                continue;
              }

              console.log(`✅ [Cron] Auction completed successfully:`, completedAuction);

              // Create payout record with profit-based fee calculation
              await paymentSplitter.createPayout(
                auction.creator_id,
                auction.id,
                winningAmount,
                startPrice
              );

              // Send model notification email
              try {
                // Fetch model user data
                const supabase = createServiceRoleClient();
                const { data: modelUser } = await supabase
                  .from('users')
                  .select('email, user_name')
                  .eq('id', auction.creator_id)
                  .single();

                if (modelUser?.email) {
                  console.log(`📧 [Cron] Sending auction completed email to model: ${modelUser.email}`);

                  await emailService.sendModelAuctionCompletedEmail({
                    model_email: modelUser.email,
                    model_name: modelUser.user_name || 'Model',
                    auction_id: auction.id,
                    auction_title: auction.title,
                    winning_bid_amount: winningAmount,
                    winner_name: capturedBid.bidder_name,
                    platform_fee: platformFee,
                    model_payout: modelPayout,
                    dashboard_url: 'https://app.welovedecode.com/dashboard'
                  });

                  console.log(`✅ [Cron] Model auction completed email sent`);
                } else {
                  console.warn(`⚠️ [Cron] No email found for model: ${auction.creator_id}`);
                }
              } catch (emailError) {
                console.error(`❌ [Cron] Failed to send model email:`, emailError);
              }

              // Create video recording session
              const sessionResult = await videoService.createRecordingSession({
                auction_id: auction.id,
                bid_id: capturedBid.id,
              });

              // CRITICAL: Always send winner notification, even if video session creation fails
              // This ensures winners are notified even when there are technical issues
              const emailResult = await notificationService.notifyWinner({
                auction_id: auction.id,
                bid_id: capturedBid.id,
                winner_email: capturedBid.bidder_email,
                winner_name: capturedBid.bidder_name,
                auction_title: auction.title,
                winning_amount: Number(capturedBid.bid_amount),
                creator_name: auction.creator?.user_name || 'the creator',
                recording_token: sessionResult.success && sessionResult.session ? sessionResult.session.token : undefined,
              });

              if (emailResult.success) {
                console.log(`✅ [Cron] Winner notification sent to ${capturedBid.bidder_email}`);
              } else {
                console.error(
                  `❌ [Cron] Failed to send winner notification:`,
                  emailResult.error
                );
              }

              if (!sessionResult.success) {
                console.error(
                  `⚠️  [Cron] Failed to create video recording session:`,
                  sessionResult.error
                );
                console.log(`   Email was still sent without video recording link`);
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
