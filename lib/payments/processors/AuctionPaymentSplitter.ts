/**
 * Auction Payment Splitter
 * Handles payment splits and payouts for auction winnings
 */

import { createClient } from '@/utils/supabase/server';
import {
  calculatePlatformFee,
  calculateNetAmount,
  DEFAULT_AUCTION_FEE_PERCENTAGE,
  type CreateAuctionPayoutDto,
} from '@/lib/models/AuctionPayout.model';

export interface PayoutCalculation {
  gross_amount: number;
  platform_fee: number;
  platform_fee_percentage: number;
  net_amount: number;
}

export class AuctionPaymentSplitter {
  /**
   * Calculate payout amounts
   */
  calculatePayout(
    winningBidAmount: number,
    feePercentage: number = DEFAULT_AUCTION_FEE_PERCENTAGE
  ): PayoutCalculation {
    const platformFee = calculatePlatformFee(winningBidAmount, feePercentage);
    const netAmount = calculateNetAmount(winningBidAmount, platformFee);

    return {
      gross_amount: winningBidAmount,
      platform_fee: platformFee,
      platform_fee_percentage: feePercentage,
      net_amount: netAmount,
    };
  }

  /**
   * Create payout record for MODEL user
   */
  async createPayout(
    modelId: string,
    auctionId: string,
    winningBidAmount: number,
    feePercentage?: number
  ): Promise<{ success: boolean; payout_id?: string; error?: string }> {
    const supabase = await createClient();

    try {
      const calculation = this.calculatePayout(winningBidAmount, feePercentage);

      const { data, error } = await supabase
        .from('auction_payouts')
        .insert({
          model_id: modelId,
          auction_id: auctionId,
          gross_amount: calculation.gross_amount,
          platform_fee: calculation.platform_fee,
          platform_fee_percentage: calculation.platform_fee_percentage,
          net_amount: calculation.net_amount,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, payout_id: data.id };
    } catch (error) {
      console.error('Error creating payout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payout',
      };
    }
  }

  /**
   * Update payout status
   */
  async updatePayoutStatus(
    payoutId: string,
    status: 'pending' | 'processing' | 'transferred' | 'failed' | 'cancelled',
    transferDetails?: {
      transfer_method?: 'bank_transfer' | 'paypal' | 'stripe_connect';
      transfer_reference?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'transferred') {
        updateData.transferred_at = new Date().toISOString();
      }

      if (transferDetails) {
        Object.assign(updateData, transferDetails);
      }

      const { error } = await supabase
        .from('auction_payouts')
        .update(updateData)
        .eq('id', payoutId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating payout status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update payout status',
      };
    }
  }

  /**
   * Get payouts for a MODEL user
   */
  async getModelPayouts(modelId: string, status?: string): Promise<any[]> {
    const supabase = await createClient();

    try {
      let query = supabase
        .from('auction_payouts')
        .select(`
          *,
          auction:auctions(id, title, winner_name, end_time)
        `)
        .eq('model_id', modelId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting model payouts:', error);
      return [];
    }
  }

  /**
   * Get payout summary for a MODEL user
   */
  async getPayoutSummary(modelId: string): Promise<{
    total_earned: number;
    total_fees: number;
    total_net: number;
    pending_amount: number;
    transferred_amount: number;
  }> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('auction_payouts')
        .select('gross_amount, platform_fee, net_amount, status')
        .eq('model_id', modelId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          total_earned: 0,
          total_fees: 0,
          total_net: 0,
          pending_amount: 0,
          transferred_amount: 0,
        };
      }

      return data.reduce(
        (summary, payout) => ({
          total_earned: summary.total_earned + Number(payout.gross_amount),
          total_fees: summary.total_fees + Number(payout.platform_fee),
          total_net: summary.total_net + Number(payout.net_amount),
          pending_amount:
            summary.pending_amount +
            (payout.status === 'pending' ? Number(payout.net_amount) : 0),
          transferred_amount:
            summary.transferred_amount +
            (payout.status === 'transferred' ? Number(payout.net_amount) : 0),
        }),
        {
          total_earned: 0,
          total_fees: 0,
          total_net: 0,
          pending_amount: 0,
          transferred_amount: 0,
        }
      );
    } catch (error) {
      console.error('Error getting payout summary:', error);
      return {
        total_earned: 0,
        total_fees: 0,
        total_net: 0,
        pending_amount: 0,
        transferred_amount: 0,
      };
    }
  }

  /**
   * Mark payout as transferred
   */
  async markAsTransferred(
    payoutId: string,
    transferMethod: 'bank_transfer' | 'paypal' | 'stripe_connect',
    transferReference?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    return await this.updatePayoutStatus(payoutId, 'transferred', {
      transfer_method: transferMethod,
      transfer_reference: transferReference,
      notes,
    });
  }
}
