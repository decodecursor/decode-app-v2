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
   * Update guest bidder Stripe customer ID
   */
  async updateStripeCustomerId(guestBidderId: string, stripeCustomerId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    try {
      await supabase
        .from('guest_bidders')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', guestBidderId);
    } catch (error) {
      console.error('Error updating Stripe customer ID:', error);
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
    } catch (error) {
      console.error('Error saving payment method:', error);
    }
  }

  /**
   * Get saved payment method ID for guest bidder
   */
  async getSavedPaymentMethod(guestBidderId: string): Promise<string | null> {
    const supabase = createServiceRoleClient();

    try {
      const { data, error } = await supabase
        .from('guest_bidders')
        .select('default_payment_method_id')
        .eq('id', guestBidderId)
        .single();

      if (error || !data) return null;

      return data.default_payment_method_id || null;
    } catch (error) {
      console.error('Error getting saved payment method:', error);
      return null;
    }
  }
}
