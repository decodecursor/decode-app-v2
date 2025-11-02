/**
 * Auction Payment Processor
 * Handles Stripe pre-authorization and dual bid management
 */

import { AuctionStrategy } from '../strategies/AuctionStrategy';
import { createClient } from '@/lib/supabase/server';
import type { Bid, BidStatus } from '@/lib/models/Bid.model';

export class AuctionPaymentProcessor {
  private strategy: AuctionStrategy;

  constructor() {
    this.strategy = new AuctionStrategy();
  }

  /**
   * Manage dual pre-authorizations
   * Keep top 2 bids pre-authorized, cancel all others
   */
  async manageDualPreAuth(auctionId: string, newBidId: string): Promise<void> {
    const supabase = createClient();

    try {
      // Get all active pre-authorized bids for this auction, sorted by amount
      const { data: bids, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .in('payment_intent_status', ['requires_capture'])
        .order('amount', { ascending: false });

      if (error) throw error;

      if (!bids || bids.length === 0) return;

      // Identify top 2 bids
      const topTwoBids = bids.slice(0, 2);
      const bidsToCancel = bids.slice(2);

      // Update bid statuses
      for (const bid of bids) {
        if (bid.id === newBidId) {
          // New highest bid
          await this.updateBidStatus(bid.id, 'winning');
        } else if (topTwoBids.find(b => b.id === bid.id)) {
          // Second highest bid
          await this.updateBidStatus(bid.id, 'pending');
        } else {
          // Cancel this bid's pre-auth
          await this.cancelBidPreAuth(bid);
        }
      }
    } catch (error) {
      console.error('Error managing dual pre-auth:', error);
      throw error;
    }
  }

  /**
   * Cancel a bid's pre-authorization
   */
  async cancelBidPreAuth(bid: Bid): Promise<void> {
    try {
      // Cancel the Stripe PaymentIntent
      const result = await this.strategy.cancelPayment(bid.payment_intent_id);

      if (result.success) {
        // Update bid status
        await this.updateBidStatus(bid.id, 'cancelled');
        await this.updatePaymentIntentStatus(bid.id, 'cancelled');
      } else {
        console.error('Failed to cancel pre-auth:', result.error);
      }
    } catch (error) {
      console.error('Error canceling bid pre-auth:', error);
      throw error;
    }
  }

  /**
   * Capture winning bid payment
   */
  async captureWinningBid(bidId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();

    try {
      // Get the bid
      const { data: bid, error } = await supabase
        .from('bids')
        .select('*')
        .eq('id', bidId)
        .single();

      if (error || !bid) {
        return { success: false, error: 'Bid not found' };
      }

      // Capture the payment
      const result = await this.strategy.capturePayment(bid.payment_intent_id);

      if (result.success) {
        // Update bid status
        await this.updateBidStatus(bid.id, 'captured');
        await this.updatePaymentIntentStatus(bid.id, 'captured');

        return { success: true };
      } else {
        // Update bid status to failed
        await this.updateBidStatus(bid.id, 'failed');
        await this.updatePaymentIntentStatus(bid.id, 'failed');

        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error capturing winning bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Capture failed',
      };
    }
  }

  /**
   * Attempt fallback capture (capture second highest bid if first fails)
   */
  async attemptFallbackCapture(auctionId: string): Promise<{ success: boolean; bid_id?: string; error?: string }> {
    const supabase = createClient();

    try {
      // Get top 2 pre-authorized bids
      const { data: bids, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('payment_intent_status', 'requires_capture')
        .order('amount', { ascending: false })
        .limit(2);

      if (error) throw error;

      if (!bids || bids.length === 0) {
        return { success: false, error: 'No bids available for capture' };
      }

      // Try to capture the highest bid first
      const firstBid = bids[0];
      const firstResult = await this.captureWinningBid(firstBid.id);

      if (firstResult.success) {
        // Cancel remaining pre-auths
        if (bids.length > 1) {
          await this.cancelBidPreAuth(bids[1]);
        }
        return { success: true, bid_id: firstBid.id };
      }

      // If first bid fails and there's a second bid, try it
      if (bids.length > 1) {
        const secondBid = bids[1];
        const secondResult = await this.captureWinningBid(secondBid.id);

        if (secondResult.success) {
          return { success: true, bid_id: secondBid.id };
        }

        return { success: false, error: 'Both top bids failed to capture' };
      }

      return { success: false, error: firstResult.error };
    } catch (error) {
      console.error('Error in fallback capture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fallback capture failed',
      };
    }
  }

  /**
   * Cancel all remaining pre-authorizations for an auction
   */
  async cancelAllPreAuths(auctionId: string): Promise<void> {
    const supabase = createClient();

    try {
      const { data: bids, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('payment_intent_status', 'requires_capture');

      if (error) throw error;

      if (bids && bids.length > 0) {
        await Promise.all(bids.map(bid => this.cancelBidPreAuth(bid)));
      }
    } catch (error) {
      console.error('Error canceling all pre-auths:', error);
      throw error;
    }
  }

  /**
   * Helper: Update bid status
   */
  private async updateBidStatus(bidId: string, status: BidStatus): Promise<void> {
    const supabase = createClient();

    await supabase
      .from('bids')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bidId);
  }

  /**
   * Helper: Update payment intent status
   */
  private async updatePaymentIntentStatus(
    bidId: string,
    status: 'requires_capture' | 'captured' | 'cancelled' | 'failed'
  ): Promise<void> {
    const supabase = createClient();

    await supabase
      .from('bids')
      .update({ payment_intent_status: status, updated_at: new Date().toISOString() })
      .eq('id', bidId);
  }

  /**
   * Get pre-authorization details
   */
  async getPreAuthDetails(paymentIntentId: string): Promise<any> {
    return await this.strategy.getPaymentDetails(paymentIntentId);
  }
}
