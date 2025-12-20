/**
 * Bidding Service
 * Handles bid placement, validation, and anti-sniping logic
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role';
import type { CreateBidDto, Bid, calculateMinimumBid } from '@/lib/models/Bid.model';
import { AuctionService } from './AuctionService';
import { GuestBidderService } from './GuestBidderService';
import { AuctionPaymentProcessor } from '@/lib/payments/processors/AuctionPaymentProcessor';
import { AuctionStrategy } from '@/lib/payments/strategies/AuctionStrategy';
import { getAuctionConfig } from '@/lib/payments/config/paymentConfig';
import { authkeyWhatsAppService } from './AuthkeyWhatsAppService';
import Stripe from 'stripe';

const ANTI_SNIPING_THRESHOLD = 60; // seconds
const ANTI_SNIPING_EXTENSION = 60; // seconds

// Lazy initialization to avoid build-time errors when env vars aren't available
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-06-30.basil',
    });
  }
  return stripeInstance;
}

export class BiddingService {
  private auctionService: AuctionService;
  private guestBidderService: GuestBidderService;
  private paymentProcessor: AuctionPaymentProcessor;
  private auctionStrategy: AuctionStrategy;
  private config = getAuctionConfig();

  constructor() {
    this.auctionService = new AuctionService();
    this.guestBidderService = new GuestBidderService();
    this.paymentProcessor = new AuctionPaymentProcessor();
    this.auctionStrategy = new AuctionStrategy();
  }

  /**
   * Place a bid on an auction
   */
  async placeBid(params: {
    auction_id: string;
    bidder_email: string;
    bidder_name: string;
    contact_method: 'whatsapp' | 'email';
    whatsapp_number?: string;
    bidder_instagram_username?: string;
    bid_amount: number;
    is_guest: boolean;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    payment_intent_id?: string; // For preloaded PaymentIntent flow
  }): Promise<{ success: boolean; bid_id?: string; client_secret?: string; payment_auto_confirmed?: boolean; saved_card_last4?: string; error?: string }> {
    const supabase = createServiceRoleClient();

    try {
      // 1. Validate auction
      const auction = await this.auctionService.getAuction(params.auction_id);
      if (!auction) {
        return { success: false, error: 'Auction not found' };
      }

      if (auction.status !== 'active') {
        return { success: false, error: 'Auction is not active' };
      }

      if (new Date(auction.end_time) <= new Date()) {
        return { success: false, error: 'Auction has ended' };
      }

      // 2. Validate bid amount
      const minBid = this.calculateMinimumBid(auction.auction_current_price, auction.auction_start_price);
      if (params.bid_amount < minBid) {
        return { success: false, error: `Minimum bid is $${minBid}` };
      }

      // 3. Handle guest bidder
      let guestBidderId: string | undefined;
      let stripeCustomerId: string | undefined;

      // Create guest bidder profile for all guest bidders (email and WhatsApp)
      if (params.is_guest) {
        const guestResult = await this.guestBidderService.getOrCreateGuestBidder({
          email: params.bidder_email,
          name: params.bidder_name,
        });

        if (!guestResult.success) {
          return { success: false, error: guestResult.error };
        }

        guestBidderId = guestResult.guest_bidder_id;
        stripeCustomerId = guestResult.stripe_customer_id;
      }

      // 4. Create or Update Stripe PaymentIntent (pre-authorization)
      const paymentResult = await this.auctionStrategy.createPayment({
        user_id: params.user_id || '',
        user_role: 'Model',
        amount: params.bid_amount,
        description: auction.title,
        metadata: {},
        auction_id: params.auction_id,
        bid_id: '', // Will be filled after bid creation
        bidder_email: params.bidder_email,
        bidder_name: params.bidder_name,
        is_guest: params.is_guest,
        guest_stripe_customer_id: stripeCustomerId,
        guest_bidder_id: guestBidderId,
        payment_intent_id: params.payment_intent_id, // For preloaded PaymentIntent flow
      } as any);

      if (!paymentResult.success) {
        return { success: false, error: paymentResult.error };
      }

      // 5. Create bid record
      const { data: bid, error: bidError } = await supabase
        .from('bids')
        .insert({
          auction_id: params.auction_id,
          bidder_email: params.bidder_email,
          bidder_name: params.bidder_name,
          contact_method: params.contact_method,
          whatsapp_number: params.whatsapp_number,
          bidder_instagram_username: params.bidder_instagram_username,
          is_guest: params.is_guest,
          user_id: params.user_id,
          guest_bidder_id: guestBidderId,
          bid_amount: params.bid_amount,
          payment_intent_id: paymentResult.payment_intent_id!,
          payment_intent_status: 'requires_capture', // Will be filtered out by manageDualPreAuth until confirmed
          status: 'pending', // Not authorized yet, won't appear in leaderboard
          ip_address: params.ip_address,
          user_agent: params.user_agent,
        })
        .select()
        .single();

      if (bidError) throw bidError;

      // CRITICAL FIX: Update payment intent metadata with actual bid_id
      // This ensures webhook can properly update bid status for saved card payments
      if (paymentResult.payment_intent_id && bid.id) {
        console.log('[BiddingService] Updating payment intent with bid_id:', {
          payment_intent_id: paymentResult.payment_intent_id,
          bid_id: bid.id,
        });

        // Retry logic for metadata update (defense against race condition)
        let updateSuccess = false;
        let lastError = null;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await getStripe().paymentIntents.update(paymentResult.payment_intent_id, {
              metadata: {
                bid_id: bid.id,
                auction_id: params.auction_id,
                is_guest: params.is_guest ? 'true' : 'false',
                guest_bidder_id: guestBidderId || '',
              }
            });
            console.log('[BiddingService] Successfully updated payment intent metadata', {
              attempt,
              bid_id: bid.id,
              payment_intent_id: paymentResult.payment_intent_id,
            });
            updateSuccess = true;
            break;
          } catch (updateError) {
            lastError = updateError;
            console.warn('[BiddingService] Metadata update attempt failed:', {
              attempt,
              max_retries: maxRetries,
              error: updateError instanceof Error ? updateError.message : 'Unknown error',
              bid_id: bid.id,
              payment_intent_id: paymentResult.payment_intent_id,
            });

            // Wait briefly before retry (exponential backoff)
            if (attempt < maxRetries) {
              const delayMs = Math.min(100 * Math.pow(2, attempt - 1), 500);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

        if (!updateSuccess) {
          console.error('[BiddingService] ❌ Failed to update payment intent metadata after all retries:', {
            bid_id: bid.id,
            payment_intent_id: paymentResult.payment_intent_id,
            retries: maxRetries,
            last_error: lastError instanceof Error ? lastError.message : 'Unknown error',
            note: 'Fallback webhook handler will attempt to find bid by payment_intent_id',
          });
          // Don't throw - bid is already created
          // Fallback webhook handler will find the bid by payment_intent_id
        }
      }

      // Note: auction_current_price is now updated by database trigger
      // only when bid status changes to 'winning', 'outbid', or 'captured'
      // This prevents race conditions and ensures only confirmed bids affect the price

      // NOTE: manageDualPreAuth is NOT called here anymore!
      // It's called in confirmBidPayment() AFTER user has actually authorized payment.
      // This prevents bids from appearing on leaderboard before payment is confirmed.

      // 6. Check for anti-sniping
      await this.checkAntiSniping(params.auction_id);

      const paymentAutoConfirmed = paymentResult.metadata?.has_saved_payment_method || false;
      const savedCardLast4 = paymentResult.metadata?.saved_card_last4;

      console.log('[BiddingService] Bid placed successfully - returning response:', {
        bid_id: bid.id,
        has_client_secret: !!paymentResult.metadata?.client_secret,
        payment_auto_confirmed: paymentAutoConfirmed,
        has_saved_payment_method: paymentResult.metadata?.has_saved_payment_method,
        saved_card_last4: savedCardLast4,
        is_guest: params.is_guest,
        guest_bidder_id: guestBidderId,
      });

      return {
        success: true,
        bid_id: bid.id,
        client_secret: paymentResult.metadata?.client_secret,
        payment_auto_confirmed: paymentAutoConfirmed,
        saved_card_last4: savedCardLast4,
      };
    } catch (error) {
      console.error('Error placing bid:', error);
      let errorMessage = 'Failed to place bid';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get bids for an auction (leaderboard)
   * Only returns bids with authorized payment (requires_capture)
   */
  async getAuctionBids(
    auctionId: string,
    limit: number = 10
  ): Promise<Bid[]> {
    const supabase = createServiceRoleClient();

    try {
      // First, fetch ALL bids to compare total vs confirmed
      const allBidsQuery = await supabase
        .from('bids')
        .select('id, status')
        .eq('auction_id', auctionId);

      const totalBids = allBidsQuery.data?.length || 0;

      // Then fetch only confirmed bids
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .in('status', ['winning', 'outbid', 'captured', 'cancelled']) // Show all bids except pending/failed
        .order('bid_amount', { ascending: false })
        .order('placed_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const confirmedBids = data?.length || 0;

      // Log discrepancy when total bids exist but few/none are confirmed
      if (totalBids > confirmedBids) {
        console.warn(
          `[BiddingService] Auction ${auctionId}: ${totalBids} total bids but only ${confirmedBids} confirmed bids (showing only winning/outbid/captured statuses)`
        );
      }

      return data || [];
    } catch (error) {
      console.error('[BiddingService] Error getting auction bids:', error);
      return [];
    }
  }

  /**
   * Get user's bids on an auction
   */
  async getUserBids(auctionId: string, email: string): Promise<Bid[]> {
    const supabase = createServiceRoleClient();

    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('bidder_email', email)
        .order('placed_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting user bids:', error);
      return [];
    }
  }

  /**
   * Confirm bid payment authorization
   * CRITICAL: Verifies actual Stripe status before updating database
   */
  async confirmBidPayment(bidId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createServiceRoleClient();

    try {
      // Get bid with payment_intent_id and auction_id
      const { data: bid, error: fetchError } = await supabase
        .from('bids')
        .select('payment_intent_id, auction_id')
        .eq('id', bidId)
        .single();

      if (fetchError || !bid) {
        return { success: false, error: 'Bid not found' };
      }

      // CRITICAL FIX: Verify actual Stripe PaymentIntent status before updating DB
      const paymentIntent = await getStripe().paymentIntents.retrieve(bid.payment_intent_id);

      console.log('[BiddingService] confirmBidPayment - Stripe status check:', {
        bid_id: bidId,
        payment_intent_id: bid.payment_intent_id,
        stripe_status: paymentIntent.status,
      });

      // Only proceed if Stripe confirms payment is actually authorized
      if (paymentIntent.status !== 'requires_capture') {
        console.error('[BiddingService] Payment NOT authorized in Stripe:', {
          bid_id: bidId,
          expected: 'requires_capture',
          actual: paymentIntent.status,
        });
        return {
          success: false,
          error: `Payment not authorized. Stripe status: ${paymentIntent.status}`,
        };
      }

      // NOW safe to update DB - Stripe has confirmed authorization
      const { error: updateError } = await supabase
        .from('bids')
        .update({
          payment_intent_status: 'requires_capture',
        })
        .eq('id', bidId);

      if (updateError) throw updateError;

      // Re-evaluate bid statuses after VERIFIED payment confirmation
      await this.paymentProcessor.manageDualPreAuth(bid.auction_id, bidId);

      // Send WhatsApp bid confirmation (async, don't block on failure)
      this.sendBidConfirmationWhatsApp(bidId, bid.auction_id).catch((err) => {
        console.error('[BiddingService] WhatsApp notification failed:', err);
      });

      return { success: true };
    } catch (error) {
      console.error('Error confirming bid payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm payment',
      };
    }
  }

  /**
   * Get winning bid for an auction
   */
  async getWinningBid(auctionId: string): Promise<Bid | null> {
    const supabase = createServiceRoleClient();

    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('status', 'winning')
        .order('bid_amount', { ascending: false })  // CRITICAL FIX: Order by AMOUNT first
        .order('placed_at', { ascending: true })    // Tiebreaker: earliest if equal amounts
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting winning bid:', error);
      return null;
    }
  }

  /**
   * Calculate minimum bid amount
   */
  private calculateMinimumBid(currentPrice: number, startPrice: number): number {
    if (currentPrice === 0) {
      return startPrice;
    }

    const increments = this.config.settings.minIncrements;

    // 5 AED increment for bids 5-999
    if (currentPrice < 1000) {
      return currentPrice + increments.under1000;
    }

    // 10 AED increment for bids 1,000-2,499
    if (currentPrice < 2500) {
      return currentPrice + increments.under2500;
    }

    // 25 AED increment for bids 2,500-4,999
    if (currentPrice < 5000) {
      return currentPrice + increments.under5000;
    }

    // 50 AED increment for bids 5,000-9,999
    if (currentPrice < 10000) {
      return currentPrice + increments.under10000;
    }

    // 100 AED increment for bids 10,000+
    return currentPrice + increments.over10000;
  }

  /**
   * Check and apply anti-sniping logic
   */
  private async checkAntiSniping(auctionId: string): Promise<void> {
    const auction = await this.auctionService.getAuction(auctionId);
    if (!auction) return;

    const now = new Date();
    const endTime = new Date(auction.end_time);
    const timeRemaining = (endTime.getTime() - now.getTime()) / 1000; // seconds

    // If bid placed in last 60 seconds, extend auction by 60 seconds
    if (timeRemaining > 0 && timeRemaining <= ANTI_SNIPING_THRESHOLD) {
      await this.auctionService.extendAuctionTime(auctionId, ANTI_SNIPING_EXTENSION);
      console.log(`Anti-sniping: Extended auction ${auctionId} by ${ANTI_SNIPING_EXTENSION} seconds`);
    }
  }

  /**
   * Send WhatsApp bid confirmation notification
   * Only sends if bidder chose WhatsApp as contact method
   */
  private async sendBidConfirmationWhatsApp(bidId: string, auctionId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    try {
      // Fetch bid details
      const { data: bid, error: bidError } = await supabase
        .from('bids')
        .select('contact_method, whatsapp_number, bidder_name, bid_amount')
        .eq('id', bidId)
        .single();

      if (bidError || !bid) {
        console.log('[BiddingService] Could not fetch bid for WhatsApp notification:', bidId);
        return;
      }

      // Only send if contact method is WhatsApp
      if (bid.contact_method !== 'whatsapp' || !bid.whatsapp_number) {
        console.log('[BiddingService] Bidder prefers email, skipping WhatsApp notification');
        return;
      }

      // Fetch auction with creator
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .select('title, creator_id')
        .eq('id', auctionId)
        .single();

      if (auctionError || !auction) {
        console.error('[BiddingService] Could not fetch auction for WhatsApp notification');
        return;
      }

      // Fetch model name
      const { data: creator, error: creatorError } = await supabase
        .from('users')
        .select('user_name')
        .eq('id', auction.creator_id)
        .single();

      if (creatorError || !creator) {
        console.error('[BiddingService] Could not fetch creator for WhatsApp notification');
        return;
      }

      // Send WhatsApp notification
      console.log('[BiddingService] Sending WhatsApp bid confirmation to:', bid.whatsapp_number.substring(0, 7) + '****');

      const result = await authkeyWhatsAppService.sendBidConfirmation({
        bidId,
        phone: bid.whatsapp_number,
        bidderName: bid.bidder_name,
        bidAmount: Number(bid.bid_amount),
        auctionTitle: auction.title,
        modelName: creator.user_name,
      });

      if (result.success) {
        console.log('[BiddingService] WhatsApp bid confirmation sent. Message ID:', result.messageId);
      } else {
        console.error('[BiddingService] WhatsApp bid confirmation failed:', result.error);
      }
    } catch (error) {
      console.error('[BiddingService] Error sending WhatsApp notification:', error);
    }
  }

  /**
   * Get bid statistics
   */
  async getBidStatistics(auctionId: string): Promise<{
    total_bids: number;
    unique_bidders: number;
    highest_bid: number;
    lowest_bid: number;
    average_bid: number;
  }> {
    const supabase = createServiceRoleClient();

    try {
      const { data, error } = await supabase
        .from('bids')
        .select('bid_amount, bidder_email')
        .eq('auction_id', auctionId)
        .in('status', ['winning', 'outbid', 'captured', 'cancelled']); // Count all confirmed bids (same filter as leaderboard)

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          total_bids: 0,
          unique_bidders: 0,
          highest_bid: 0,
          lowest_bid: 0,
          average_bid: 0,
        };
      }

      const amounts = data.map(b => Number(b.bid_amount));
      const uniqueEmails = new Set(data.map(b => b.bidder_email));

      return {
        total_bids: data.length,
        unique_bidders: uniqueEmails.size,
        highest_bid: Math.max(...amounts),
        lowest_bid: Math.min(...amounts),
        average_bid: amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length,
      };
    } catch (error) {
      console.error('Error getting bid statistics:', error);
      return {
        total_bids: 0,
        unique_bidders: 0,
        highest_bid: 0,
        lowest_bid: 0,
        average_bid: 0,
      };
    }
  }
}
