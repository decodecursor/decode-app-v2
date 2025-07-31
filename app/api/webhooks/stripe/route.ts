import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('❌ Missing Stripe signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripeService.verifyWebhookSignature(body, signature);
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`🔔 Stripe webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'invoice.payment_succeeded':
        console.log('💰 Invoice payment succeeded');
        break;
      
      default:
        console.log(`⚠️ Unhandled Stripe webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ Stripe webhook processing failed:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log('✅ Checkout session completed:', session.id);
    console.log('🔍 WEBHOOK DEBUG: Checkout session metadata:', session.metadata);
    
    const paymentLinkId = session.metadata?.payment_link_id;
    const beautyProfessionalId = session.metadata?.beauty_professional_id;

    if (!paymentLinkId) {
      console.error('❌ Missing payment_link_id in checkout session metadata');
      return;
    }

    console.log('🔍 WEBHOOK DEBUG: Looking for transactions to update for checkout session:', paymentLinkId);

    // First, find all transactions for this payment link for debugging
    const { data: allTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId);

    console.log('🔍 WEBHOOK DEBUG: All transactions found for checkout:', allTransactions?.length || 0);
    console.log('🔍 WEBHOOK DEBUG: Checkout transaction details:', allTransactions);

    if (!allTransactions || allTransactions.length === 0) {
      console.error('❌ WEBHOOK DEBUG: No transactions found for checkout session payment link:', paymentLinkId);
      return;
    }

    // Try to find the correct transaction to update
    let transactionToUpdate = null;
    let updateMethod = 'none';

    // Method 1: Find by processor_session_id (if we have it)
    transactionToUpdate = allTransactions.find(t => t.processor_session_id === session.id);
    if (transactionToUpdate) {
      updateMethod = 'processor_session_id_match';
      console.log('✅ WEBHOOK DEBUG: Found transaction by processor_session_id:', transactionToUpdate.id);
    }

    // Method 2: Find by payment_intent_id match
    if (!transactionToUpdate && session.payment_intent) {
      transactionToUpdate = allTransactions.find(t => t.processor_payment_id === session.payment_intent);
      if (transactionToUpdate) {
        updateMethod = 'payment_intent_match';
        console.log('✅ WEBHOOK DEBUG: Found transaction by payment_intent match:', transactionToUpdate.id);
      }
    }

    // Method 3: Find any pending stripe transaction (most likely candidate)
    if (!transactionToUpdate) {
      transactionToUpdate = allTransactions.find(t => t.processor === 'stripe' && t.status === 'pending');
      if (transactionToUpdate) {
        updateMethod = 'pending_stripe_transaction';
        console.log('✅ WEBHOOK DEBUG: Found transaction by pending stripe status:', transactionToUpdate.id);
      }
    }

    if (!transactionToUpdate) {
      console.error('❌ WEBHOOK DEBUG: No suitable transaction found for checkout session');
      console.error('❌ WEBHOOK DEBUG: Session ID:', session.id);
      console.error('❌ WEBHOOK DEBUG: Payment Intent:', session.payment_intent);
      return;
    }

    console.log(`🔄 WEBHOOK DEBUG: Updating checkout transaction ${transactionToUpdate.id} using method: ${updateMethod}`);

    // Update transaction status in database
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        processor_payment_id: session.payment_intent as string,
        processor_session_id: session.id,
        completed_at: new Date().toISOString(),
        customer_email: session.customer_email,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionToUpdate.id)
      .select();

    if (updateError) {
      console.error('❌ WEBHOOK DEBUG: Failed to update checkout transaction:', updateError);
      return;
    }

    console.log('✅ WEBHOOK DEBUG: Checkout transaction updated successfully:', updatedTransaction);

    // Mark payment link as paid
    const { error: linkUpdateError } = await supabase
      .from('payment_links')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentLinkId);

    if (linkUpdateError) {
      console.error('❌ WEBHOOK DEBUG: Failed to update payment link status:', linkUpdateError);
    } else {
      console.log('✅ WEBHOOK DEBUG: Payment link marked as paid via checkout:', paymentLinkId);
    }

    console.log('✅ Transaction completed successfully for payment link:', paymentLinkId);

  } catch (error) {
    console.error('❌ Error handling checkout session completed:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('💳 Payment intent succeeded:', paymentIntent.id);
    console.log('🔍 WEBHOOK DEBUG: PaymentIntent metadata:', paymentIntent.metadata);
    
    const paymentLinkId = paymentIntent.metadata?.payment_link_id;
    
    if (!paymentLinkId) {
      console.error('❌ Missing payment_link_id in payment intent metadata');
      return;
    }

    console.log('🔍 WEBHOOK DEBUG: Looking for transactions to update for payment link:', paymentLinkId);

    // First, find all transactions for this payment link for debugging
    const { data: allTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId);

    console.log('🔍 WEBHOOK DEBUG: All transactions found:', allTransactions?.length || 0);
    console.log('🔍 WEBHOOK DEBUG: Transaction details:', allTransactions);
    console.log('🔍 WEBHOOK DEBUG: Fetch error:', fetchError);

    if (!allTransactions || allTransactions.length === 0) {
      console.error('❌ WEBHOOK DEBUG: No transactions found for payment link:', paymentLinkId);
      return;
    }

    // Try multiple methods to find the correct transaction to update
    let transactionToUpdate = null;
    let updateMethod = 'none';

    // Method 1: Find by processor_payment_id (exact match)
    transactionToUpdate = allTransactions.find(t => t.processor_payment_id === paymentIntent.id);
    if (transactionToUpdate) {
      updateMethod = 'processor_payment_id_match';
      console.log('✅ WEBHOOK DEBUG: Found transaction by processor_payment_id:', transactionToUpdate.id);
    }

    // Method 2: Find by payment_link_id + processor + status='pending' (most likely candidate)
    if (!transactionToUpdate) {
      transactionToUpdate = allTransactions.find(t => t.processor === 'stripe' && t.status === 'pending');
      if (transactionToUpdate) {
        updateMethod = 'pending_stripe_transaction';
        console.log('✅ WEBHOOK DEBUG: Found transaction by pending stripe status:', transactionToUpdate.id);
      }
    }

    // Method 3: Find any stripe transaction for this payment link (fallback)
    if (!transactionToUpdate) {
      transactionToUpdate = allTransactions.find(t => t.processor === 'stripe');
      if (transactionToUpdate) {
        updateMethod = 'any_stripe_transaction';
        console.log('✅ WEBHOOK DEBUG: Found transaction by any stripe match:', transactionToUpdate.id);
      }
    }

    if (!transactionToUpdate) {
      console.error('❌ WEBHOOK DEBUG: No suitable transaction found to update');
      console.error('❌ WEBHOOK DEBUG: PaymentIntent ID:', paymentIntent.id);
      console.error('❌ WEBHOOK DEBUG: Available transactions:', allTransactions.map(t => ({
        id: t.id,
        processor: t.processor,
        processor_payment_id: t.processor_payment_id,
        status: t.status
      })));
      return;
    }

    console.log(`🔄 WEBHOOK DEBUG: Updating transaction ${transactionToUpdate.id} using method: ${updateMethod}`);

    // Update the specific transaction
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        processor_payment_id: paymentIntent.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionToUpdate.id)
      .select();

    if (updateError) {
      console.error('❌ WEBHOOK DEBUG: Failed to update transaction:', updateError);
      console.error('❌ WEBHOOK DEBUG: Update error details:', JSON.stringify(updateError, null, 2));
      return;
    }

    console.log('✅ WEBHOOK DEBUG: Transaction updated successfully:', updatedTransaction);

    // Also mark the payment link as paid
    const { error: linkUpdateError } = await supabase
      .from('payment_links')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentLinkId);

    if (linkUpdateError) {
      console.error('❌ WEBHOOK DEBUG: Failed to update payment link status:', linkUpdateError);
    } else {
      console.log('✅ WEBHOOK DEBUG: Payment link marked as paid:', paymentLinkId);
    }

    console.log('✅ Payment intent processed successfully with method:', updateMethod);

  } catch (error) {
    console.error('❌ Error handling payment intent succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('❌ Payment intent failed:', paymentIntent.id);
    
    const paymentLinkId = paymentIntent.metadata?.payment_link_id;
    
    if (!paymentLinkId) {
      console.error('❌ Missing payment_link_id in failed payment intent metadata');
      return;
    }

    // Update transaction status to failed
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'failed',
        failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_link_id', paymentLinkId)
      .eq('processor', 'stripe');

    if (updateError) {
      console.error('❌ Failed to update failed transaction:', updateError);
    }

    console.log('⚠️ Payment failure recorded for payment link:', paymentLinkId);

  } catch (error) {
    console.error('❌ Error handling payment intent failed:', error);
  }
}

// Health check endpoint
export async function GET() {
  const healthCheck = await stripeService.healthCheck();
  
  return NextResponse.json({
    service: 'Stripe Webhooks',
    ...healthCheck,
    timestamp: new Date().toISOString()
  });
}