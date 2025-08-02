// Database operations for Crossmint integration
// Handles all database interactions related to wallets and transactions

import { supabase } from '@/lib/supabase';
import { generateUniqueShortId } from '@/lib/short-id';
import {
  CrossmintUser,
  CrossmintPaymentLink,
  WalletTransaction,
  calculateMarketplaceFee,
  CreatePaymentLinkRequest,
  CreatePaymentLinkResponse
} from '@/types/crossmint';

export class CrossmintDatabaseService {
  
  // USER & WALLET MANAGEMENT
  
  /**
   * Update user with wallet information after creation
   */
  async updateUserWallet(
    userId: string,
    walletAddress: string,
    crossmintWalletId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        wallet_address: walletAddress,
        crossmint_wallet_id: crossmintWalletId,
        wallet_created_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user wallet: ${error.message}`);
    }
  }

  /**
   * Get user with wallet information
   */
  async getUserWithWallet(userId: string): Promise<CrossmintUser | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user by email with wallet information
   */
  async getUserByEmail(email: string): Promise<CrossmintUser | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get user by email: ${error.message}`);
    }

    return data;
  }

  // PAYMENT LINK MANAGEMENT
  
  /**
   * Check if a payment link ID already exists
   */
  private async paymentLinkExists(linkId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('payment_links')
        .select('id')
        .eq('id', linkId)
        .single();
      
      // If error and it's not "not found", something went wrong
      if (error && error.code !== 'PGRST116') {
        console.warn(`Database error checking payment link existence: ${error.message}`);
        // Return false to assume it doesn't exist rather than throwing
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error(`Unexpected error checking payment link existence: ${error}`);
      // Return false to assume it doesn't exist rather than throwing
      return false;
    }
  }
  
  /**
   * Create payment link with marketplace fee calculation
   */
  async createPaymentLink(request: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
    console.log('🔄 Starting payment link creation...');
    console.log('📋 Request data:', { title: request.title, amount: request.original_amount_aed });
    
    const feeCalculation = calculateMarketplaceFee(request.original_amount_aed);
    console.log('💰 Fee calculation:', feeCalculation);
    
    // Generate a unique short ID for the payment link
    console.log('🎲 Generating short ID...');
    const shortId = await generateUniqueShortId(
      (id) => this.paymentLinkExists(id)
    );
    console.log('🆔 Generated ID:', shortId, '(length:', shortId.length, ')');
    
    // Set expiration to 7 days from now
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);

    const paymentLinkData = {
      id: shortId, // Use our custom short ID
      client_name: request.client_name,
      title: request.title,
      description: request.description,
      // Legacy field for compatibility
      amount_aed: feeCalculation.totalAmount,
      // New clear naming fee fields
      service_amount_aed: feeCalculation.originalAmount,
      decode_amount_aed: feeCalculation.feeAmount,
      total_amount_aed: feeCalculation.totalAmount,
      expiration_date: expirationDate.toISOString(),
      creator_id: request.creator_id,
      linked_user_id: request.linked_user_id,
      is_active: true
    };

    console.log('💾 Inserting payment link data with ID:', paymentLinkData.id);
    
    const { data, error } = await supabase
      .from('payment_links')
      .insert(paymentLinkData)
      .select()
      .single();
      
    console.log('📤 Database insert result - ID returned:', data?.id);

    if (error) {
      throw new Error(`Failed to create payment link: ${error.message}`);
    }

    return {
      ...data,
      fee_calculation: feeCalculation
    };
  }

  /**
   * Get payment link with fee information
   */
  async getPaymentLink(linkId: string): Promise<CrossmintPaymentLink | null> {
    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', linkId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get payment link: ${error.message}`);
    }

    return data;
  }

  /**
   * Update payment link status
   */
  async updatePaymentLinkStatus(linkId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('payment_links')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', linkId);

    if (error) {
      throw new Error(`Failed to update payment link status: ${error.message}`);
    }
  }

  /**
   * Update payment link with fee structure (for legacy links)
   */
  async updatePaymentLinkFees(linkId: string, fees: {
    original_amount_aed: number;
    fee_amount_aed: number;
    total_amount_aed: number;
  }): Promise<void> {
    const { error } = await supabase
      .from('payment_links')
      .update({
        ...fees,
        updated_at: new Date().toISOString()
      })
      .eq('id', linkId);

    if (error) {
      throw new Error(`Failed to update payment link fees: ${error.message}`);
    }
  }

  // TRANSACTION MANAGEMENT
  
  /**
   * Record a new wallet transaction
   */
  async recordTransaction(transaction: Omit<WalletTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<WalletTransaction> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert({
        ...transaction,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record transaction: ${error.message}`);
    }

    return data as WalletTransaction;
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionId: string,
    status: WalletTransaction['status'],
    completedAt?: Date
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (completedAt) {
      updateData.completed_at = completedAt.toISOString();
    }

    const { error } = await supabase
      .from('wallet_transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (error) {
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }

  /**
   * Get user transactions for dashboard
   */
  async getUserTransactions(userId: string, limit: number = 50): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get user transactions: ${error.message}`);
    }

    return (data || []) as WalletTransaction[];
  }

  /**
   * Get transaction by Crossmint transaction ID
   */
  async getTransactionByCrossmintId(crossmintTransactionId: string): Promise<WalletTransaction | null> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('crossmint_transaction_id', crossmintTransactionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get transaction by Crossmint ID: ${error.message}`);
    }

    return data as WalletTransaction;
  }

  // EXPIRATION MANAGEMENT
  
  /**
   * Deactivate expired payment links
   */
  async deactivateExpiredLinks(): Promise<number> {
    // TODO: Uncomment when auto_deactivate_expired_links function is added to database
    // const { data, error } = await supabase.rpc('auto_deactivate_expired_links');
    // if (error) {
    //   throw new Error(`Failed to deactivate expired links: ${error.message}`);
    // }
    // return data || 0;
    
    return 0; // Temporary: return 0 until database function is implemented
  }

  /**
   * Get payment links expiring soon (within 24 hours)
   */
  async getLinksExpiringSoon(): Promise<CrossmintPaymentLink[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .lt('expiration_date', tomorrow.toISOString())
      .eq('is_active', true)
      .order('expiration_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get links expiring soon: ${error.message}`);
    }

    return data || [];
  }

  // ANALYTICS & REPORTING
  
  /**
   * Get user transaction summary
   */
  async getUserTransactionSummary(userId: string) {
    // TODO: Uncomment when user_transaction_summary view is added to database
    // const { data, error } = await supabase
    //   .from('user_transaction_summary')
    //   .select('*')
    //   .eq('user_id', userId)
    //   .single();
    // if (error) {
    //   if (error.code === 'PGRST116') {
    //     // No transactions yet, return empty summary
    //     return {
    //       user_id: userId,
    //       total_transactions: 0,
    //       total_received_usdc: 0,
    //       total_transferred_usdc: 0,
    //       total_fees_usdc: 0,
    //       last_transaction_at: null
    //     };
    //   }
    //   throw new Error(`Failed to get transaction summary: ${error.message}`);
    // }
    // return data;

    // Temporary: return empty summary until database view is implemented
    return {
      user_id: userId,
      total_transactions: 0,
      total_received_usdc: 0,
      total_transferred_usdc: 0,
      total_fees_usdc: 0,
      last_transaction_at: null
    };
  }

  /**
   * Get marketplace statistics (admin only)
   */
  async getMarketplaceStats() {
    const { data: totalRevenue, error: revenueError } = await supabase
      .from('wallet_transactions')
      .select('amount_usdc')
      .eq('transaction_type', 'fee_collected')
      .eq('status', 'completed');

    if (revenueError) {
      throw new Error(`Failed to get revenue stats: ${revenueError.message}`);
    }

    const { data: activeLinks, error: linksError } = await supabase
      .from('payment_links')
      .select('id')
      .eq('is_active', true);

    if (linksError) {
      throw new Error(`Failed to get active links: ${linksError.message}`);
    }

    const { data: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .not('wallet_address', 'is', null);

    if (usersError) {
      throw new Error(`Failed to get users with wallets: ${usersError.message}`);
    }

    const totalFees = totalRevenue?.reduce((sum, tx) => sum + (tx.amount_usdc || 0), 0) || 0;

    return {
      total_marketplace_fees_usdc: totalFees,
      active_payment_links: activeLinks?.length || 0,
      users_with_wallets: totalUsers?.length || 0,
      updated_at: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const crossmintDB = new CrossmintDatabaseService();