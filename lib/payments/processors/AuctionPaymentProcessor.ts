/**
 * Auction Payment Processor
 * Handles Stripe pre-authorization and dual bid management
 */

import { AuctionStrategy } from '../strategies/AuctionStrategy';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
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
    const startTime = Date.now();
    const supabase = createServiceRoleClient();

    try {
      // Get all active pre-authorized bids for this auction, sorted by bid_amount
      const { data: bids, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .in('payment_intent_status', ['requires_capture', 'captured'])
        .order('bid_amount', { ascending: false });

      if (error) throw error;

      if (!bids || bids.length === 0) {
        console.log('[AuctionPaymentProcessor] manageDualPreAuth: No bids to process');
        return;
      }

      // Identify top 2 bids
      const topTwoBids = bids.slice(0, 2);

      // Update bid statuses - reuse the same supabase client
      // CRITICAL FIX: Mark highest bid as 'winning' based on AMOUNT, not newBidId
      // NOTE: Each updateBidStatusWithClient call triggers a separate Postgres UPDATE
      // which fires a separate realtime event to all connected clients.
      // The frontend debounces these events to prevent leaderboard flickering.
      for (const bid of bids) {
        if (bid.id === topTwoBids[0].id) {
          // Highest bid by amount (regardless of whether it's new)
          await this.updateBidStatusWithClient(supabase, bid.id, 'winning');
        } else if (topTwoBids[1] && bid.id === topTwoBids[1].id) {
          // Second highest bid
          await this.updateBidStatusWithClient(supabase, bid.id, 'outbid');
        } else {
          // Cancel this bid's pre-auth
          await this.cancelBidPreAuthWithClient(supabase, bid);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log('[AuctionPaymentProcessor] manageDualPreAuth completed:', {
        auction_id: auctionId,
        bids_processed: bids.length,
        total_time_ms: totalTime
      });
    } catch (error) {
      console.error('Error managing dual pre-auth:', error);
      throw error;
    }
  }

  /**
   * Cancel a bid's pre-authorization
   */
  async cancelBidPreAuth(bid: Bid): Promise<void> {
    const supabase = createServiceRoleClient();
    return this.cancelBidPreAuthWithClient(supabase, bid);
  }

  /**
   * Cancel a bid's pre-authorization (with client reuse)
   */
  private async cancelBidPreAuthWithClient(supabase: any, bid: Bid): Promise<void> {
    try {
      // Cancel the Stripe PaymentIntent
      const result = await this.strategy.cancelPayment(bid.payment_intent_id);

      if (result.success) {
        // Update bid status - reuse same client
        await this.updateBidStatusWithClient(supabase, bid.id, 'cancelled');
        await this.updatePaymentIntentStatusWithClient(supabase, bid.id, 'cancelled');
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
   * CRITICAL: Includes safety checks to prevent incorrect 'failed' status
   */
  async captureWinningBid(bidId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createServiceRoleClient();

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

      // SAFETY CHECK: If already captured in our DB, return success
      if (bid.payment_intent_status === 'captured' || bid.status === 'captured') {
        console.log('[AuctionPaymentProcessor] Bid already captured, skipping:', bidId);
        return { success: true };
      }

      // SAFETY CHECK: If already marked as failed, don't retry (prevents loops)
      if (bid.status === 'failed') {
        console.log('[AuctionPaymentProcessor] Bid already failed, skipping:', bidId);
        return { success: false, error: 'Bid already marked as failed' };
      }

      console.log('[AuctionPaymentProcessor] Attempting to capture bid:', {
        bid_id: bidId,
        bid_amount: bid.bid_amount,
        payment_intent_id: bid.payment_intent_id,
        current_status: bid.status,
        current_payment_status: bid.payment_intent_status,
      });

      // Capture the payment (includes Stripe status pre-check)
      const result = await this.strategy.capturePayment(bid.payment_intent_id);

      if (result.success) {
        // Update bid status
        await this.updateBidStatus(bid.id, 'captured');
        await this.updatePaymentIntentStatus(bid.id, 'captured');

        console.log('[AuctionPaymentProcessor] Successfully captured bid:', bidId);
        return { success: true };
      } else {
        // Only mark as failed if capture truly failed (not state issues)
        // The capturePayment function now handles "already captured" as success
        console.error('[AuctionPaymentProcessor] Capture failed for bid:', {
          bid_id: bidId,
          error: result.error,
        });

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
   * CRITICAL FIX: Query both 'requires_capture' AND 'succeeded' to find highest bid
   */
  async attemptFallbackCapture(auctionId: string): Promise<{ success: boolean; bid_id?: string; error?: string }> {
    const supabase = createServiceRoleClient();

    try {
      // Get top 2 authorized bids (BOTH requires_capture AND succeeded)
      // CRITICAL: Must match EventBridge fallback filter to select correct winner
      const { data: bids, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .in('payment_intent_status', ['requires_capture', 'captured'])
        .order('bid_amount', { ascending: false })
        .limit(2);

      if (error) throw error;

      if (!bids || bids.length === 0) {
        return { success: false, error: 'No bids available for capture' };
      }

      // CRITICAL: Verify sorting is correct - Supabase may return wrong order
      // Sort manually to guarantee highest bid is first
      if (bids.length > 1) {
        const firstAmount = Number(bids[0].bid_amount);
        const secondAmount = Number(bids[1].bid_amount);
        if (secondAmount > firstAmount) {
          console.error('[AuctionPaymentProcessor] CRITICAL: Bids returned in WRONG ORDER! Sorting manually.', {
            first: { id: bids[0].id, amount: firstAmount },
            second: { id: bids[1].id, amount: secondAmount }
          });
          // Sort manually as fallback
          bids.sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount));
        }
      }

      console.log('[AuctionPaymentProcessor] attemptFallbackCapture bids (after sort verification):', bids.map(b => ({
        id: b.id,
        bid_amount: b.bid_amount,
        bidder_email: b.bidder_email,
        payment_intent_status: b.payment_intent_status
      })));

      // Try to capture the highest bid first
      const firstBid = bids[0];

      // CRITICAL: If bid already captured, just return it as winner
      if (firstBid.payment_intent_status === 'captured') {
        console.log('[AuctionPaymentProcessor] Highest bid already captured:', firstBid.id);
        // Cancel any remaining pre-auths
        if (bids.length > 1 && bids[1].payment_intent_status === 'requires_capture') {
          await this.cancelBidPreAuth(bids[1]);
        }
        return { success: true, bid_id: firstBid.id };
      }

      // Bid needs capture
      const firstResult = await this.captureWinningBid(firstBid.id);

      if (firstResult.success) {
        // Cancel remaining pre-auths
        if (bids.length > 1 && bids[1].payment_intent_status === 'requires_capture') {
          await this.cancelBidPreAuth(bids[1]);
        }
        return { success: true, bid_id: firstBid.id };
      }

      // If first bid fails and there's a second bid, try it
      if (bids.length > 1) {
        const secondBid = bids[1];

        // Check if second bid is already captured
        if (secondBid.payment_intent_status === 'captured') {
          console.log('[AuctionPaymentProcessor] Second bid already captured:', secondBid.id);
          return { success: true, bid_id: secondBid.id };
        }

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
    const supabase = createServiceRoleClient();

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
    const supabase = createServiceRoleClient();
    return this.updateBidStatusWithClient(supabase, bidId, status);
  }

  /**
   * Helper: Update bid status (with client reuse for performance)
   */
  private async updateBidStatusWithClient(supabase: any, bidId: string, status: BidStatus): Promise<void> {
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
    const supabase = createServiceRoleClient();
    return this.updatePaymentIntentStatusWithClient(supabase, bidId, status);
  }

  /**
   * Helper: Update payment intent status (with client reuse for performance)
   */
  private async updatePaymentIntentStatusWithClient(
    supabase: any,
    bidId: string,
    status: 'requires_capture' | 'captured' | 'cancelled' | 'failed'
  ): Promise<void> {
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
