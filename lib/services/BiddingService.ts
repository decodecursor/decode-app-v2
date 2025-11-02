/**
 * Bidding Service
 * Handles bid placement, validation, and anti-sniping logic
 */

import { createClient } from '@/utils/supabase/server';
import type { CreateBidDto, Bid, calculateMinimumBid } from '@/lib/models/Bid.model';
import { AuctionService } from './AuctionService';
import { GuestBidderService } from './GuestBidderService';
import { AuctionPaymentProcessor } from '@/lib/payments/processors/AuctionPaymentProcessor';
import { AuctionStrategy } from '@/lib/payments/strategies/AuctionStrategy';
import { getAuctionConfig } from '@/lib/payments/config/paymentConfig';

const ANTI_SNIPING_THRESHOLD = 60; // seconds
const ANTI_SNIPING_EXTENSION = 60; // seconds

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
    amount: number;
    is_guest: boolean;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<{ success: boolean; bid_id?: string; client_secret?: string; error?: string }> {
    const supabase = await createClient();

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
      const minBid = this.calculateMinimumBid(auction.current_price, auction.start_price);
      if (params.amount < minBid) {
        return { success: false, error: `Minimum bid is $${minBid}` };
      }

      // 3. Handle guest bidder
      let guestBidderId: string | undefined;
      let stripeCustomerId: string | undefined;

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

      // 4. Create Stripe PaymentIntent (pre-authorization)
      const paymentResult = await this.auctionStrategy.createPayment({
        user_id: params.user_id || '',
        user_role: 'Beauty Model',
        amount: params.amount,
        description: auction.title,
        metadata: {},
        auction_id: params.auction_id,
        bid_id: '', // Will be filled after bid creation
        bidder_email: params.bidder_email,
        bidder_name: params.bidder_name,
        is_guest: params.is_guest,
        guest_stripe_customer_id: stripeCustomerId,
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
          is_guest: params.is_guest,
          user_id: params.user_id,
          guest_bidder_id: guestBidderId,
          amount: params.amount,
          payment_intent_id: paymentResult.payment_intent_id!,
          payment_intent_status: 'requires_capture',
          status: 'pending',
          ip_address: params.ip_address,
          user_agent: params.user_agent,
        })
        .select()
        .single();

      if (bidError) throw bidError;

      // 6. Manage dual pre-authorizations
      await this.paymentProcessor.manageDualPreAuth(params.auction_id, bid.id);

      // 7. Check for anti-sniping
      await this.checkAntiSniping(params.auction_id);

      return {
        success: true,
        bid_id: bid.id,
        client_secret: paymentResult.metadata?.client_secret,
      };
    } catch (error) {
      console.error('Error placing bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to place bid',
      };
    }
  }

  /**
   * Get bids for an auction (leaderboard)
   */
  async getAuctionBids(
    auctionId: string,
    limit: number = 10
  ): Promise<Bid[]> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .order('amount', { ascending: false })
        .order('placed_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting auction bids:', error);
      return [];
    }
  }

  /**
   * Get user's bids on an auction
   */
  async getUserBids(auctionId: string, email: string): Promise<Bid[]> {
    const supabase = await createClient();

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
   * Get winning bid for an auction
   */
  async getWinningBid(auctionId: string): Promise<Bid | null> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('status', 'winning')
        .single();

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

    const config = this.config.settings.minIncrementPercentages;

    if (currentPrice < 100) {
      return Math.ceil(currentPrice * (1 + config.under100 / 100));
    }

    if (currentPrice < 500) {
      return Math.ceil(currentPrice * (1 + config.under500 / 100));
    }

    return Math.ceil(currentPrice * (1 + config.over500 / 100));
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
   * Get bid statistics
   */
  async getBidStatistics(auctionId: string): Promise<{
    total_bids: number;
    unique_bidders: number;
    highest_bid: number;
    lowest_bid: number;
    average_bid: number;
  }> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('bids')
        .select('amount, bidder_email')
        .eq('auction_id', auctionId);

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

      const amounts = data.map(b => Number(b.amount));
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
