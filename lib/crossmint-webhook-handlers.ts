// Updated webhook handlers for Crossmint headless checkout
// Handles payment completion and marketplace fee distribution

import { crossmintService } from '@/lib/crossmint';
import { crossmintDB } from '@/lib/crossmint-db';

interface CrossmintHeadlessWebhookEvent {
  type: 'payment.completed' | 'payment.failed' | 'transfer.completed' | 'transfer.failed';
  data: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    recipient?: string;
    metadata?: {
      payment_link_id?: string;
      beauty_professional_id?: string;
      original_amount?: string;
      fee_amount?: string;
      marketplace_fee_percentage?: string;
      platform?: string;
      [key: string]: any;
    };
    created_at: string;
    completed_at?: string;
    failure_reason?: string;
  };
  timestamp: string;
}

export async function processHeadlessWebhookEvent(event: CrossmintHeadlessWebhookEvent): Promise<void> {
  console.log(`🔄 Processing headless webhook: ${event.type}`);

  switch (event.type) {
    case 'payment.completed':
      await handleHeadlessPaymentCompleted(event);
      break;
    
    case 'payment.failed':
      await handleHeadlessPaymentFailed(event);
      break;
    
    case 'transfer.completed':
      await handleHeadlessTransferCompleted(event);
      break;
    
    case 'transfer.failed':
      await handleHeadlessTransferFailed(event);
      break;
    
    default:
      console.log(`⚠️ Unhandled headless webhook event: ${event.type}`);
  }
}

async function handleHeadlessPaymentCompleted(event: CrossmintHeadlessWebhookEvent): Promise<void> {
  try {
    console.log('💰 Processing headless payment completion...');
    
    const { data } = event;
    const metadata = data.metadata || {};
    
    // Extract payment information
    const paymentLinkId = metadata.payment_link_id;
    const beautyProfessionalId = metadata.beauty_professional_id;
    const originalAmount = parseFloat(metadata.original_amount || '0');
    const feeAmount = parseFloat(metadata.fee_amount || '0');
    const totalAmount = parseFloat(data.amount || '0');

    if (!paymentLinkId || !beautyProfessionalId) {
      throw new Error('Missing required metadata in headless payment webhook');
    }

    console.log(`Payment details:`, {
      paymentLinkId,
      beautyProfessionalId,
      originalAmount,
      feeAmount,
      totalAmount
    });

    // Get payment link and user details
    const [paymentLink, beautyProfessional] = await Promise.all([
      crossmintDB.getPaymentLink(paymentLinkId),
      crossmintDB.getUserWithWallet(beautyProfessionalId)
    ]);

    if (!paymentLink) {
      throw new Error(`Payment link not found: ${paymentLinkId}`);
    }

    if (!beautyProfessional) {
      throw new Error(`Beauty professional not found: ${beautyProfessionalId}`);
    }

    // Record the customer payment transaction
    const paymentTransaction = await crossmintDB.recordTransaction({
      user_id: beautyProfessionalId,
      payment_link_id: paymentLinkId,
      transaction_type: 'payment_received',
      status: 'completed',
      amount_usdc: totalAmount, // Will be converted to USDC by Crossmint
      amount_aed: totalAmount,
      crossmint_transaction_id: data.id,
      completed_at: data.completed_at || new Date().toISOString(),
      metadata: {
        service_amount_aed: originalAmount,
        decode_amount_aed: feeAmount,
        customer_paid_aed: totalAmount,
        payment_method: 'crossmint_headless',
        service_title: paymentLink.title,
        client_name: paymentLink.client_name
      }
    });

    console.log(`✅ Payment transaction recorded: ${paymentTransaction.id}`);

    // Record the marketplace fee collection
    await crossmintDB.recordTransaction({
      user_id: beautyProfessionalId, // Associate with professional for tracking
      payment_link_id: paymentLinkId,
      transaction_type: 'fee_collected',
      status: 'completed',
      amount_usdc: feeAmount,
      amount_aed: feeAmount,
      crossmint_transaction_id: data.id,
      completed_at: data.completed_at || new Date().toISOString(),
      metadata: {
        fee_percentage: 9,
        original_transaction_id: paymentTransaction.id,
        marketplace_revenue: true,
        decode_commission: feeAmount
      }
    });

    console.log(`✅ Marketplace fee recorded: ${feeAmount} AED`);

    // Initiate transfer to beauty professional wallet
    if (beautyProfessional.wallet_address) {
      try {
        console.log(`🔄 Initiating transfer to professional: ${originalAmount} USDC`);
        
        const transferResult = await crossmintService.transferToProfessional(
          beautyProfessional.wallet_address,
          originalAmount, // Only transfer original amount (excluding marketplace fee)
          data.id
        );

        // Record transfer initiation
        await crossmintDB.recordTransaction({
          user_id: beautyProfessionalId,
          payment_link_id: paymentLinkId,
          transaction_type: 'transfer_out',
          status: 'pending',
          amount_usdc: originalAmount,
          amount_aed: originalAmount,
          crossmint_transaction_id: transferResult.id || `transfer_${Date.now()}`,
          metadata: {
            destination_wallet: beautyProfessional.wallet_address,
            source_transaction_id: paymentTransaction.id,
            transfer_type: 'professional_payout',
            professional_name: beautyProfessional.user_name
          }
        });

        console.log(`✅ Transfer initiated: ${originalAmount} USDC to ${beautyProfessional.wallet_address}`);
        
      } catch (transferError) {
        console.error('❌ Failed to initiate transfer to professional:', transferError);
        
        // Record failed transfer attempt but don't fail the whole process
        await crossmintDB.recordTransaction({
          user_id: beautyProfessionalId,
          payment_link_id: paymentLinkId,
          transaction_type: 'transfer_out',
          status: 'failed',
          amount_usdc: originalAmount,
          amount_aed: originalAmount,
          metadata: {
            error: transferError instanceof Error ? transferError.message : 'Transfer initiation failed',
            destination_wallet: beautyProfessional.wallet_address,
            source_transaction_id: paymentTransaction.id,
            requires_manual_intervention: true
          }
        });
      }
    } else {
      console.error('❌ Beauty professional has no wallet address - cannot transfer funds');
      
      // Record issue for manual resolution
      await crossmintDB.recordTransaction({
        user_id: beautyProfessionalId,
        payment_link_id: paymentLinkId,
        transaction_type: 'transfer_out',
        status: 'failed',
        amount_usdc: originalAmount,
        amount_aed: originalAmount,
        metadata: {
          error: 'No wallet address configured for beauty professional',
          requires_wallet_setup: true,
          requires_manual_intervention: true,
          source_transaction_id: paymentTransaction.id
        }
      });
    }

    // Deactivate payment link after successful payment (one-time use)
    await crossmintDB.updatePaymentLinkStatus(paymentLinkId, false);
    console.log(`✅ Payment link deactivated: ${paymentLinkId}`);

    console.log('🎉 Headless payment completion processing finished successfully');

  } catch (error) {
    console.error('❌ Error processing headless payment completion:', error);
    throw error;
  }
}

async function handleHeadlessPaymentFailed(event: CrossmintHeadlessWebhookEvent): Promise<void> {
  try {
    console.log('❌ Processing headless payment failure...');
    
    const { data } = event;
    const metadata = data.metadata || {};
    
    const paymentLinkId = metadata.payment_link_id;
    const beautyProfessionalId = metadata.beauty_professional_id;

    if (!paymentLinkId || !beautyProfessionalId) {
      console.log('⚠️ Missing metadata in headless payment failure webhook');
      return;
    }

    // Check if there's an existing pending transaction to update
    const existingTransaction = await crossmintDB.getTransactionByCrossmintId(data.id);
    
    if (existingTransaction) {
      await crossmintDB.updateTransactionStatus(existingTransaction.id, 'failed');
      console.log(`✅ Updated existing transaction to failed: ${existingTransaction.id}`);
    } else {
      // Record new failed payment transaction
      await crossmintDB.recordTransaction({
        user_id: beautyProfessionalId,
        payment_link_id: paymentLinkId,
        transaction_type: 'payment_received',
        status: 'failed',
        crossmint_transaction_id: data.id,
        metadata: {
          failure_reason: data.failure_reason || 'Payment processing failed',
          payment_method: 'crossmint_headless',
          failed_at: data.completed_at || new Date().toISOString()
        }
      });
      console.log('✅ Payment failure recorded');
    }

  } catch (error) {
    console.error('❌ Error processing headless payment failure:', error);
    throw error;
  }
}

async function handleHeadlessTransferCompleted(event: CrossmintHeadlessWebhookEvent): Promise<void> {
  try {
    console.log('✅ Processing headless transfer completion...');
    
    const { data } = event;
    
    // Find and update the corresponding transfer transaction
    const existingTransaction = await crossmintDB.getTransactionByCrossmintId(data.id);
    
    if (existingTransaction) {
      await crossmintDB.updateTransactionStatus(
        existingTransaction.id, 
        'completed',
        data.completed_at ? new Date(data.completed_at) : new Date()
      );
      
      console.log(`✅ Transfer completed successfully:`, {
        transactionId: existingTransaction.id,
        amount: data.amount,
        recipient: data.recipient
      });
    } else {
      console.log('⚠️ Transfer completion webhook for unknown transaction:', data.id);
    }

  } catch (error) {
    console.error('❌ Error processing headless transfer completion:', error);
    throw error;
  }
}

async function handleHeadlessTransferFailed(event: CrossmintHeadlessWebhookEvent): Promise<void> {
  try {
    console.log('❌ Processing headless transfer failure...');
    
    const { data } = event;
    
    // Find and update the corresponding transfer transaction
    const existingTransaction = await crossmintDB.getTransactionByCrossmintId(data.id);
    
    if (existingTransaction) {
      await crossmintDB.updateTransactionStatus(existingTransaction.id, 'failed');
      
      console.log(`❌ Transfer failed:`, {
        transactionId: existingTransaction.id,
        amount: data.amount,
        recipient: data.recipient,
        reason: data.failure_reason || 'Unknown'
      });
      
      // Add metadata about manual intervention needed
      await crossmintDB.recordTransaction({
        user_id: existingTransaction.user_id,
        payment_link_id: existingTransaction.payment_link_id,
        transaction_type: 'transfer_out',
        status: 'failed',
        amount_usdc: existingTransaction.amount_usdc,
        amount_aed: existingTransaction.amount_aed,
        metadata: {
          original_transfer_id: existingTransaction.id,
          failure_reason: data.failure_reason || 'Transfer failed',
          requires_manual_intervention: true,
          failed_at: data.completed_at || new Date().toISOString()
        }
      });
      
    } else {
      console.log('⚠️ Transfer failure webhook for unknown transaction:', data.id);
    }

  } catch (error) {
    console.error('❌ Error processing headless transfer failure:', error);
    throw error;
  }
}

// Export the main handler function (already exported above)

// Helper function to validate webhook event structure
export function validateHeadlessWebhookEvent(payload: any): payload is CrossmintHeadlessWebhookEvent {
  return (
    payload &&
    typeof payload.type === 'string' &&
    payload.data &&
    typeof payload.data.id === 'string' &&
    typeof payload.timestamp === 'string'
  );
}