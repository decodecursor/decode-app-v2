/**
 * Guest Bidder Service
 * Handles guest bidder profile management and reuse
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role';
import type { GuestBidder, CreateGuestBidderDto } from '@/lib/models/GuestBidder.model';
import { normalizeEmail, validateEmail, validateGuestName } from '@/lib/models/GuestBidder.model';

export class GuestBidderService {
  /**
   * Get or create guest bidder profile
   */
  async getOrCreateGuestBidder(params: {
    email: string;
    name: string;
  }): Promise<{ success: boolean; guest_bidder_id?: string; stripe_customer_id?: string; error?: string }> {
    const supabase = createServiceRoleClient();

    try {
      // Validate inputs
      if (!validateEmail(params.email)) {
        return { success: false, error: 'Invalid email address' };
      }

      if (!validateGuestName(params.name)) {
        return { success: false, error: 'Invalid name format' };
      }

      const normalizedEmail = normalizeEmail(params.email);

      // Check if guest bidder already exists
      const { data: existing, error: fetchError } = await supabase
        .from('guest_bidders')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (existing) {
        return {
          success: true,
          guest_bidder_id: existing.id,
          stripe_customer_id: existing.stripe_customer_id,
        };
      }

      // Create new guest bidder
      const { data: newGuest, error: createError } = await supabase
        .from('guest_bidders')
        .insert({
          email: normalizedEmail,
          name: params.name,
        })
        .select()
        .single();

      if (createError) throw createError;

      return {
        success: true,
        guest_bidder_id: newGuest.id,
      };
    } catch (error) {
      console.error('Error getting/creating guest bidder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process guest bidder',
      };
    }
  }

  /**
   * Get guest bidder by email
   */
  async getGuestBidderByEmail(email: string): Promise<GuestBidder | null> {
    const supabase = createServiceRoleClient();

    try {
      const normalizedEmail = normalizeEmail(email);

      const { data, error } = await supabase
        .from('guest_bidders')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (error) return null;

      return data;
    } catch (error) {
      console.error('Error getting guest bidder by email:', error);
      return null;
    }
  }

  /**
   * Get guest bidder statistics
   */
  async getGuestStatistics(guestBidderId: string): Promise<{
    total_bids: number;
    active_bids: number;
    won_auctions: number;
    total_spent: number;
  }> {
    const supabase = createServiceRoleClient();

    try {
      // Get bid counts
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('status, amount')
        .eq('guest_bidder_id', guestBidderId);

      if (bidsError) throw bidsError;

      const activeBids = bids?.filter(b => b.status === 'winning' || b.status === 'pending').length || 0;
      const wonBids = bids?.filter(b => b.status === 'captured').length || 0;
      const totalSpent = bids
        ?.filter(b => b.status === 'captured')
        .reduce((sum, b) => sum + Number(b.amount), 0) || 0;

      return {
        total_bids: bids?.length || 0,
        active_bids: activeBids,
        won_auctions: wonBids,
        total_spent: totalSpent,
      };
    } catch (error) {
      console.error('Error getting guest statistics:', error);
      return {
        total_bids: 0,
        active_bids: 0,
        won_auctions: 0,
        total_spent: 0,
      };
    }
  }

  /**
   * Update guest bidder stats after winning
   */
  async updateGuestWinStats(guestBidderId: string, winningAmount: number): Promise<void> {
    const supabase = createServiceRoleClient();

    try {
      const { data: guest } = await supabase
        .from('guest_bidders')
        .select('total_won, total_spent')
        .eq('id', guestBidderId)
        .single();

      if (guest) {
        await supabase
          .from('guest_bidders')
          .update({
            total_won: guest.total_won + 1,
            total_spent: Number(guest.total_spent) + winningAmount,
          })
          .eq('id', guestBidderId);
      }
    } catch (error) {
      console.error('Error updating guest win stats:', error);
    }
  }

  /**
   * Save payment method ID for guest bidder
   */
  async savePaymentMethod(guestBidderId: string, paymentMethodId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    try {
      await supabase
        .from('guest_bidders')
        .update({
          default_payment_method_id: paymentMethodId,
          last_payment_method_saved_at: new Date().toISOString(),
        })
        .eq('id', guestBidderId);

      console.log('[GuestBidderService] Saved payment method:', {
        guest_bidder_id: guestBidderId,
        payment_method_id: paymentMethodId,
      });
    } catch (error) {
      console.error('Error saving payment method:', error);
    }
  }

  /**
   * Update Stripe customer ID for guest bidder
   * Called immediately after customer creation to ensure ID is persisted
   */
  async updateStripeCustomerId(guestBidderId: string, stripeCustomerId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    try {
      await supabase
        .from('guest_bidders')
        .update({
          stripe_customer_id: stripeCustomerId,
        })
        .eq('id', guestBidderId);

      console.log('[GuestBidderService] Saved Stripe customer ID:', {
        guest_bidder_id: guestBidderId,
        stripe_customer_id: stripeCustomerId,
      });
    } catch (error) {
      console.error('Error updating Stripe customer ID:', error);
    }
  }

  /**
   * Get saved payment method ID for guest bidder
   * Includes retry logic to handle Edge browser's slower webhook processing
   */
  async getSavedPaymentMethod(guestBidderId: string): Promise<string | null> {
    const supabase = createServiceRoleClient();

    // Get browser info for debugging
    const browserInfo = typeof window !== 'undefined'
      ? (navigator.userAgent.includes('Edg') ? 'Edge' : 'Other')
      : 'Server';

    // Enhanced retry logic: 6 attempts with exponential backoff
    // Total max wait time: 800 + 1200 + 1600 + 2000 + 2400 + 2800 = 10.8 seconds
    const maxAttempts = 6;
    const baseDelay = 800; // Start with 800ms

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        const { data, error } = await supabase
          .from('guest_bidders')
          .select('default_payment_method_id, stripe_customer_id, last_payment_method_saved_at')
          .eq('id', guestBidderId)
          .single();

        if (error || !data) {
          if (attempt < maxAttempts - 1) {
            const delay = baseDelay + (attempt * 400); // Exponential backoff
            console.log(`[GuestBidderService] Payment method not found yet, retrying... (attempt ${attempt + 1}/${maxAttempts}, delay: ${delay}ms, browser: ${browserInfo})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          console.error('[GuestBidderService] No guest bidder found after all attempts:', {
            guest_bidder_id: guestBidderId,
            attempts: maxAttempts,
            browser: browserInfo,
            error: error?.message
          });
          return null;
        }

        // If payment method exists, return it
        if (data.default_payment_method_id && data.stripe_customer_id) {
          const queryTime = Date.now() - startTime;
          console.log('[GuestBidderService] Found saved payment method:', {
            guest_bidder_id: guestBidderId,
            payment_method_id: data.default_payment_method_id,
            customer_id: data.stripe_customer_id,
            saved_at: data.last_payment_method_saved_at,
            attempt: attempt + 1,
            query_time_ms: queryTime,
            browser: browserInfo
          });
          return data.default_payment_method_id;
        }

        // Log partial data for debugging
        if (data.stripe_customer_id && !data.default_payment_method_id) {
          console.warn('[GuestBidderService] Customer exists but no payment method saved yet:', {
            guest_bidder_id: guestBidderId,
            customer_id: data.stripe_customer_id,
            attempt: attempt + 1,
            browser: browserInfo
          });
        }

        // No payment method yet, retry if attempts remaining
        if (attempt < maxAttempts - 1) {
          const delay = baseDelay + (attempt * 400); // Exponential backoff
          console.log(`[GuestBidderService] Payment method not saved yet, retrying... (attempt ${attempt + 1}/${maxAttempts}, delay: ${delay}ms, browser: ${browserInfo})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        const delay = baseDelay + (attempt * 400);
        console.error(`[GuestBidderService] Error getting saved payment method (attempt ${attempt + 1}/${maxAttempts}):`, {
          error,
          guest_bidder_id: guestBidderId,
          browser: browserInfo
        });
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('[GuestBidderService] No saved payment method found after all attempts:', {
      guest_bidder_id: guestBidderId,
      attempts: maxAttempts,
      total_wait_time_ms: baseDelay * maxAttempts + (400 * (maxAttempts * (maxAttempts - 1)) / 2),
      browser: browserInfo
    });
    return null;
  }

  /**
   * Check if guest bidder has previously bid on a specific auction
   * Used to scope saved payment methods per auction
   */
  async hasGuestBidOnAuction(guestBidderId: string, auctionId: string): Promise<boolean> {
    const supabase = createServiceRoleClient();

    try {
      // Only count valid bids (not canceled, failed, or expired)
      const { data, error} = await supabase
        .from('bids')
        .select('id, status, created_at')
        .eq('guest_bidder_id', guestBidderId)
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'winning', 'outbid', 'active', 'won', 'completed']);

      if (error) {
        console.error('[GuestBidderService] Error checking previous bids:', error);
        return false;
      }

      const hasBid = data && data.length > 0;
      console.log('[GuestBidderService] Previous bid check:', {
        guest_bidder_id: guestBidderId,
        auction_id: auctionId,
        has_previous_bid: hasBid,
        bid_count: data?.length || 0,
        bids_found: data,
      });

      return hasBid;
    } catch (error) {
      console.error('[GuestBidderService] Exception checking previous bids:', error);
      return false;
    }
  }
}
