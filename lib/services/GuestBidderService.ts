/**
 * Guest Bidder Service
 * Handles guest bidder profile management and reuse
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role';
import type { GuestBidder, CreateGuestBidderDto } from '@/lib/models/GuestBidder.model';
import { normalizeEmail, validateEmail, validateGuestName } from '@/lib/models/GuestBidder.model';
import { guestBidderCache } from '@/lib/cache/GuestBidderCache';

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

      // Check cache first (saves ~50-100ms DB query)
      const cached = guestBidderCache.get(normalizedEmail);
      if (cached && cached.name === params.name) {
        console.log('[GuestBidderService] Cache hit - skipping DB query');
        return {
          success: true,
          guest_bidder_id: cached.id,
          stripe_customer_id: cached.stripe_customer_id || undefined,
        };
      }

      // Cache miss - check if guest bidder already exists in database
      const { data: existing, error: fetchError } = await supabase
        .from('guest_bidders')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (existing) {
        // Cache the result for future requests
        guestBidderCache.set(normalizedEmail, {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          stripe_customer_id: existing.stripe_customer_id,
          default_payment_method_id: existing.default_payment_method_id,
          last_payment_method_saved_at: existing.last_payment_method_saved_at,
        });

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

      // Cache the newly created guest bidder
      guestBidderCache.set(normalizedEmail, {
        id: newGuest.id,
        email: newGuest.email,
        name: newGuest.name,
        stripe_customer_id: newGuest.stripe_customer_id,
        default_payment_method_id: newGuest.default_payment_method_id,
        last_payment_method_saved_at: newGuest.last_payment_method_saved_at,
      });

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
   * Reduced retry logic - only retry on actual DB errors, not missing data
   */
  async getSavedPaymentMethod(guestBidderId: string): Promise<string | null> {
    const supabase = createServiceRoleClient();
    const startTime = Date.now();

    // Get browser info for debugging
    const browserInfo = typeof window !== 'undefined'
      ? (navigator.userAgent.includes('Edg') ? 'Edge' : 'Other')
      : 'Server';

    console.log('[GuestBidderService] getSavedPaymentMethod START:', {
      guest_bidder_id: guestBidderId,
      browser: browserInfo,
      timestamp: new Date().toISOString()
    });

    try {
      // First attempt - no delay
      const { data, error } = await supabase
        .from('guest_bidders')
        .select('default_payment_method_id, stripe_customer_id, last_payment_method_saved_at')
        .eq('id', guestBidderId)
        .single();

      if (error || !data) {
        console.error('[GuestBidderService] Guest bidder not found:', {
          guest_bidder_id: guestBidderId,
          error: error?.message
        });
        return null;
      }

      // OPTIMIZATION 1: Early exit for first-time bidders
      // If last_payment_method_saved_at is null, user has NEVER saved a payment method
      // Skip all retry logic - no webhook delay is possible
      if (data.last_payment_method_saved_at === null) {
        const totalTime = Date.now() - startTime;
        console.log('[GuestBidderService] First-time bidder (never saved payment method), immediate return:', {
          guest_bidder_id: guestBidderId,
          total_time_ms: totalTime,
          browser: browserInfo
        });
        return null;
      }

      // OPTIMIZATION 2: If payment method exists, return immediately
      if (data.default_payment_method_id && data.stripe_customer_id) {
        const totalTime = Date.now() - startTime;
        console.log('[GuestBidderService] Found saved payment method:', {
          guest_bidder_id: guestBidderId,
          payment_method_id: data.default_payment_method_id,
          customer_id: data.stripe_customer_id,
          saved_at: data.last_payment_method_saved_at,
          total_time_ms: totalTime,
          browser: browserInfo
        });
        return data.default_payment_method_id;
      }

      // OPTIMIZATION 3: If customer exists but no payment method, first-time bidder (no retry needed)
      if (data.stripe_customer_id && !data.default_payment_method_id) {
        const totalTime = Date.now() - startTime;
        console.log('[GuestBidderService] No saved payment method (first-time bidder with customer):', {
          guest_bidder_id: guestBidderId,
          customer_id: data.stripe_customer_id,
          total_time_ms: totalTime,
          browser: browserInfo
        });
        return null;
      }

      // EDGE CASE: Timestamp exists but payment_method_id is missing
      // This indicates webhook race condition - do single retry with minimal delay
      if (data.last_payment_method_saved_at && !data.default_payment_method_id) {
        console.warn('[GuestBidderService] Webhook race condition detected - timestamp exists but no payment_method_id, retrying once:', {
          guest_bidder_id: guestBidderId,
          last_saved_at: data.last_payment_method_saved_at,
          browser: browserInfo
        });

        // Single retry with 50ms delay (optimized from 100-300ms)
        await new Promise(resolve => setTimeout(resolve, 50));

        const { data: retryData } = await supabase
          .from('guest_bidders')
          .select('default_payment_method_id')
          .eq('id', guestBidderId)
          .single();

        const totalTime = Date.now() - startTime;

        if (retryData?.default_payment_method_id) {
          console.log('[GuestBidderService] Found payment method on retry:', {
            guest_bidder_id: guestBidderId,
            payment_method_id: retryData.default_payment_method_id,
            total_time_ms: totalTime,
            browser: browserInfo
          });
          return retryData.default_payment_method_id;
        }

        console.warn('[GuestBidderService] Payment method still missing after retry:', {
          guest_bidder_id: guestBidderId,
          total_time_ms: totalTime,
          browser: browserInfo
        });
        return null;
      }

      // No saved payment method
      const totalTime = Date.now() - startTime;
      console.log('[GuestBidderService] No saved payment method found:', {
        guest_bidder_id: guestBidderId,
        total_time_ms: totalTime,
        browser: browserInfo
      });
      return null;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('[GuestBidderService] Error getting saved payment method:', {
        error,
        guest_bidder_id: guestBidderId,
        total_time_ms: totalTime,
        browser: browserInfo
      });
      return null;
    }
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
