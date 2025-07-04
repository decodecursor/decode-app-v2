// Transfer service for moving funds from DECODE wallet to beauty professionals
// Handles the marketplace distribution model

import { crossmintService } from '@/lib/crossmint';
import { crossmintDB } from '@/lib/crossmint-db';

interface TransferRequest {
  paymentLinkId: string;
  beautyProfessionalId: string;
  originalAmount: number;
  sourceTransactionId: string;
  paymentTransactionId: string;
}

interface TransferResult {
  success: boolean;
  transferId?: string;
  transactionId?: string;
  error?: string;
}

export class TransferService {
  
  /**
   * Process transfer to beauty professional after payment completion
   */
  async processTransferToProfessional(request: TransferRequest): Promise<TransferResult> {
    try {
      console.log(`🔄 Processing transfer to professional: ${request.beautyProfessionalId}`);
      
      // Get beauty professional details and verify wallet
      const professional = await crossmintDB.getUserWithWallet(request.beautyProfessionalId);
      if (!professional) {
        throw new Error('Beauty professional not found');
      }

      if (!professional.wallet_address) {
        throw new Error('Beauty professional has no wallet address configured');
      }

      // Get payment link details
      const paymentLink = await crossmintDB.getPaymentLink(request.paymentLinkId);
      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      console.log(`💰 Transferring ${request.originalAmount} USDC to ${professional.wallet_address}`);

      // Initiate transfer via Crossmint
      const transferResult = await crossmintService.transferToProfessional(
        professional.wallet_address,
        request.originalAmount,
        request.sourceTransactionId
      );

      console.log(`✅ Transfer initiated:`, transferResult);

      // Record transfer transaction
      const transferTransaction = await crossmintDB.recordTransaction({
        user_id: request.beautyProfessionalId,
        payment_link_id: request.paymentLinkId,
        transaction_type: 'transfer_out',
        status: 'pending',
        amount_usdc: request.originalAmount,
        amount_aed: request.originalAmount, // Simplified - would need actual conversion rate
        crossmint_transaction_id: transferResult.id || `transfer_${Date.now()}`,
        metadata: {
          destination_wallet: professional.wallet_address,
          source_transaction_id: request.sourceTransactionId,
          payment_transaction_id: request.paymentTransactionId,
          transfer_type: 'professional_payout',
          professional_name: professional.full_name,
          service_title: paymentLink.title,
          client_name: paymentLink.client_name,
          initiated_at: new Date().toISOString()
        }
      });

      return {
        success: true,
        transferId: transferResult.id,
        transactionId: transferTransaction.id
      };

    } catch (error) {
      console.error('❌ Transfer processing failed:', error);
      
      // Record failed transfer
      try {
        await crossmintDB.recordTransaction({
          user_id: request.beautyProfessionalId,
          payment_link_id: request.paymentLinkId,
          transaction_type: 'transfer_out',
          status: 'failed',
          amount_usdc: request.originalAmount,
          amount_aed: request.originalAmount,
          metadata: {
            error: error instanceof Error ? error.message : 'Transfer failed',
            source_transaction_id: request.sourceTransactionId,
            payment_transaction_id: request.paymentTransactionId,
            requires_manual_intervention: true,
            failed_at: new Date().toISOString()
          }
        });
      } catch (recordError) {
        console.error('❌ Failed to record transfer failure:', recordError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }

  /**
   * Retry failed transfers
   */
  async retryFailedTransfer(transactionId: string): Promise<TransferResult> {
    try {
      console.log(`🔄 Retrying failed transfer: ${transactionId}`);

      // Get the failed transaction
      const { data: transaction, error } = await crossmintDB.supabase
        .from('wallet_transactions')
        .select(`
          *,
          payment_links (id, title, client_name),
          users (id, full_name, wallet_address)
        `)
        .eq('id', transactionId)
        .eq('status', 'failed')
        .eq('transaction_type', 'transfer_out')
        .single();

      if (error || !transaction) {
        throw new Error('Failed transaction not found');
      }

      const user = transaction.users;
      const paymentLink = transaction.payment_links;

      if (!user || !user.wallet_address) {
        throw new Error('User or wallet address not found');
      }

      // Retry the transfer
      const transferResult = await crossmintService.transferToProfessional(
        user.wallet_address,
        transaction.amount_usdc || 0,
        transaction.metadata?.source_transaction_id || transaction.id
      );

      // Update transaction status to pending
      await crossmintDB.updateTransactionStatus(transactionId, 'pending');

      // Record retry attempt in metadata
      await crossmintDB.supabase
        .from('wallet_transactions')
        .update({
          crossmint_transaction_id: transferResult.id,
          metadata: {
            ...transaction.metadata,
            retry_attempted_at: new Date().toISOString(),
            retry_crossmint_id: transferResult.id,
            retry_count: (transaction.metadata?.retry_count || 0) + 1
          }
        })
        .eq('id', transactionId);

      console.log(`✅ Transfer retry initiated successfully`);

      return {
        success: true,
        transferId: transferResult.id,
        transactionId: transactionId
      };

    } catch (error) {
      console.error('❌ Transfer retry failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer retry failed'
      };
    }
  }

  /**
   * Get pending transfers that need manual review
   */
  async getPendingTransfers(): Promise<any[]> {
    try {
      const { data: pendingTransfers, error } = await crossmintDB.supabase
        .from('wallet_transactions')
        .select(`
          *,
          payment_links (id, title, client_name, original_amount_aed),
          users (id, full_name, email, wallet_address)
        `)
        .eq('transaction_type', 'transfer_out')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get pending transfers: ${error.message}`);
      }

      return pendingTransfers || [];

    } catch (error) {
      console.error('❌ Error getting pending transfers:', error);
      throw error;
    }
  }

  /**
   * Get failed transfers that need manual intervention
   */
  async getFailedTransfers(): Promise<any[]> {
    try {
      const { data: failedTransfers, error } = await crossmintDB.supabase
        .from('wallet_transactions')
        .select(`
          *,
          payment_links (id, title, client_name, original_amount_aed),
          users (id, full_name, email, wallet_address)
        `)
        .eq('transaction_type', 'transfer_out')
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get failed transfers: ${error.message}`);
      }

      return failedTransfers || [];

    } catch (error) {
      console.error('❌ Error getting failed transfers:', error);
      throw error;
    }
  }

  /**
   * Manual transfer completion (for admin use)
   */
  async manuallyCompleteTransfer(
    transactionId: string, 
    crossmintTransactionId: string,
    adminUserId: string
  ): Promise<void> {
    try {
      console.log(`🔧 Manually completing transfer: ${transactionId}`);

      await crossmintDB.updateTransactionStatus(transactionId, 'completed', new Date());

      // Add admin completion metadata
      await crossmintDB.supabase
        .from('wallet_transactions')
        .update({
          crossmint_transaction_id: crossmintTransactionId,
          metadata: {
            manually_completed: true,
            completed_by_admin: adminUserId,
            manual_completion_date: new Date().toISOString(),
            completion_method: 'manual_admin_action'
          }
        })
        .eq('id', transactionId);

      console.log(`✅ Transfer manually completed by admin`);

    } catch (error) {
      console.error('❌ Manual transfer completion failed:', error);
      throw error;
    }
  }

  /**
   * Calculate total pending transfer amounts (for liquidity management)
   */
  async calculatePendingTransferAmounts(): Promise<{
    totalPendingUsdc: number;
    totalPendingAed: number;
    pendingCount: number;
  }> {
    try {
      const { data: pendingTransfers, error } = await crossmintDB.supabase
        .from('wallet_transactions')
        .select('amount_usdc, amount_aed')
        .eq('transaction_type', 'transfer_out')
        .eq('status', 'pending');

      if (error) {
        throw new Error(`Failed to calculate pending amounts: ${error.message}`);
      }

      const totalPendingUsdc = pendingTransfers?.reduce((sum, tx) => sum + (tx.amount_usdc || 0), 0) || 0;
      const totalPendingAed = pendingTransfers?.reduce((sum, tx) => sum + (tx.amount_aed || 0), 0) || 0;

      return {
        totalPendingUsdc,
        totalPendingAed,
        pendingCount: pendingTransfers?.length || 0
      };

    } catch (error) {
      console.error('❌ Error calculating pending transfer amounts:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const transferService = new TransferService();

// Export types for convenience
export type { TransferRequest, TransferResult };