import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  console.log('🧪 DEBUG: Webhook testing endpoint called');
  
  try {
    const { searchParams } = new URL(request.url);
    const paymentLinkId = searchParams.get('paymentLinkId');
    
    if (!paymentLinkId) {
      return NextResponse.json({
        error: 'Missing paymentLinkId parameter',
        usage: 'GET /api/debug/webhook-test?paymentLinkId=your-payment-link-id'
      }, { status: 400 });
    }

    // Check if payment link exists
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('id, title, amount_aed, creator_id')
      .eq('id', paymentLinkId)
      .single();

    if (linkError || !paymentLink) {
      return NextResponse.json({
        error: 'Payment link not found',
        paymentLinkId,
        linkError
      }, { status: 404 });
    }

    // Check all transactions for this payment link
    const { data: allTransactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId);

    console.log('🔍 WEBHOOK TEST: Found transactions:', allTransactions?.length || 0);

    // Test webhook transaction matching logic
    let transactionToUpdate = null;
    let updateMethod = 'none';

    if (allTransactions && allTransactions.length > 0) {
      // Method 1: Find any pending stripe transaction
      transactionToUpdate = allTransactions.find(t => t.payment_processor === 'stripe' && t.status === 'pending');
      if (transactionToUpdate) {
        updateMethod = 'pending_stripe_transaction';
      }

      // Method 2: Find any stripe transaction (fallback)
      if (!transactionToUpdate) {
        transactionToUpdate = allTransactions.find(t => t.payment_processor === 'stripe');
        if (transactionToUpdate) {
          updateMethod = 'any_stripe_transaction';
        }
      }
    }

    // Simulate webhook processing
    let simulationResult = null;
    if (transactionToUpdate) {
      console.log(`🔄 WEBHOOK TEST: Would update transaction ${transactionToUpdate.id} using method: ${updateMethod}`);
      
      // Don't actually update, just simulate
      simulationResult = {
        transactionId: transactionToUpdate.id,
        currentStatus: transactionToUpdate.status,
        updateMethod,
        wouldUpdate: {
          status: 'completed',
          processor_transaction_id: 'test_payment_intent_id',
          completed_at: new Date().toISOString()
        }
      };
    }

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        title: paymentLink.title,
        amount_aed: paymentLink.amount_aed
      },
      transactions: {
        total: allTransactions?.length || 0,
        details: allTransactions?.map(t => ({
          id: t.id,
          status: t.status,
          payment_processor: t.payment_processor,
          processor_transaction_id: t.processor_transaction_id,
          created_at: t.created_at
        })) || []
      },
      webhookSimulation: simulationResult,
      debug: {
        paymentLinkExists: true,
        transactionsFound: allTransactions?.length || 0,
        matchingTransaction: !!transactionToUpdate,
        updateMethod,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ WEBHOOK TEST: Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook test failed',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('🧪 DEBUG: Webhook simulation endpoint called');
  
  try {
    const body = await request.json();
    const { paymentLinkId, paymentIntentId } = body;
    
    if (!paymentLinkId || !paymentIntentId) {
      return NextResponse.json({
        error: 'Missing required fields: paymentLinkId, paymentIntentId'
      }, { status: 400 });
    }

    console.log(`🔄 WEBHOOK SIMULATION: Processing payment for link ${paymentLinkId}`);

    // Find transactions to update
    const { data: allTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId);

    if (fetchError) {
      throw new Error(`Failed to fetch transactions: ${fetchError.message}`);
    }

    console.log('🔍 WEBHOOK SIMULATION: Found transactions:', allTransactions?.length || 0);

    if (!allTransactions || allTransactions.length === 0) {
      return NextResponse.json({
        error: 'No transactions found for payment link',
        paymentLinkId
      }, { status: 404 });
    }

    // Find transaction to update
    let transactionToUpdate = allTransactions.find(t => t.payment_processor === 'stripe' && t.status === 'pending');
    
    if (!transactionToUpdate) {
      transactionToUpdate = allTransactions.find(t => t.payment_processor === 'stripe');
    }

    if (!transactionToUpdate) {
      return NextResponse.json({
        error: 'No Stripe transaction found to update',
        availableTransactions: allTransactions.map(t => ({
          id: t.id,
          status: t.status,
          payment_processor: t.payment_processor
        }))
      }, { status: 404 });
    }

    // Update the transaction (simulate webhook processing)
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        processor_transaction_id: paymentIntentId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionToUpdate.id)
      .select();

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    console.log('✅ WEBHOOK SIMULATION: Transaction updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Webhook simulation completed',
      originalTransaction: {
        id: transactionToUpdate.id,
        status: transactionToUpdate.status
      },
      updatedTransaction: updatedTransaction?.[0],
      debug: {
        paymentLinkId,
        paymentIntentId,
        transactionsFound: allTransactions.length,
        updateMethod: 'webhook_simulation',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ WEBHOOK SIMULATION: Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook simulation failed',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}