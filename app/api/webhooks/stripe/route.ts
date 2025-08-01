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

    console.log(`🔔 Stripe webhook received: ${event.type} (${event.id})`);
    
    // Check for duplicate webhook processing (idempotency)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, status')
      .eq('event_id', event.id)
      .single();

    if (existingEvent && existingEvent.status === 'processed') {
      console.log(`⏭️ Webhook ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Log webhook event to database for debugging and idempotency
    await logWebhookEvent(event);

    // Handle different event types with proper error handling
    try {
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
          await markWebhookEventStatus(event.id, 'unhandled');
          return NextResponse.json({ received: true, unhandled: true });
      }

      // Mark webhook as successfully processed
      await markWebhookEventStatus(event.id, 'processed');
      
    } catch (eventError) {
      console.error(`❌ Error processing webhook event ${event.type}:`, eventError);
      await markWebhookEventStatus(event.id, 'failed', eventError instanceof Error ? eventError.message : 'Unknown error');
      throw eventError;
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
    
    const paymentLinkId = session.metadata?.payment_link_id;
    if (!paymentLinkId) {
      throw new Error('Missing payment_link_id in checkout session metadata');
    }

    // Handle payment completion manually (no RPC functions in current schema)
    await handleCheckoutSessionManually(session, paymentLinkId);
    console.log('✅ Payment completed manually');

  } catch (error) {
    console.error('❌ Error handling checkout session completed:', error);
    throw error;
  }
}

// Fallback manual transaction handling
async function handleCheckoutSessionManually(session: Stripe.Checkout.Session, paymentLinkId: string) {
  // Find the transaction by session ID (most reliable method)
  const { data: transaction, error: findError } = await supabase
    .from('transactions')
    .select('*')
    .eq('payment_link_id', paymentLinkId)
    .eq('processor_session_id', session.id)
    .eq('payment_processor', 'stripe')
    .single();

  if (findError || !transaction) {
    throw new Error(`No transaction found for session ${session.id} and payment link ${paymentLinkId}`);
  }

  // Update transaction to completed status
  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      status: 'completed',
      processor_payment_id: session.payment_intent as string,
      processor_transaction_id: session.payment_intent as string,
      completed_at: new Date().toISOString(),
      buyer_email: session.customer_email,
      amount_aed: session.amount_total ? session.amount_total / 100 : transaction.amount_aed,
      metadata: {
        ...(transaction.metadata && typeof transaction.metadata === 'object' ? transaction.metadata : {}),
        session_completed_at: new Date().toISOString(),
        session_data: {
          id: session.id,
          payment_status: session.payment_status,
          customer_email: session.customer_email
        }
      }
    })
    .eq('id', transaction.id);

  if (updateError) {
    throw new Error(`Failed to update transaction ${transaction.id}: ${updateError.message}`);
  }

  console.log('✅ Transaction completed manually:', transaction.id);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('💳 Payment intent succeeded:', paymentIntent.id);
    
    const paymentLinkId = paymentIntent.metadata?.payment_link_id;
    if (!paymentLinkId) {
      throw new Error('Missing payment_link_id in payment intent metadata');
    }

    // Find transaction by payment intent ID (most reliable)
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId)
      .eq('processor_payment_id', paymentIntent.id)
      .eq('payment_processor', 'stripe')
      .single();

    if (findError || !transaction) {
      throw new Error(`No transaction found for payment intent ${paymentIntent.id} and payment link ${paymentLinkId}`);
    }

    // Update transaction to completed status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        processor_transaction_id: paymentIntent.id,
        completed_at: new Date().toISOString(),
        amount_aed: paymentIntent.amount / 100,
        metadata: {
          ...(transaction.metadata && typeof transaction.metadata === 'object' ? transaction.metadata : {}),
          payment_intent_succeeded_at: new Date().toISOString(),
          payment_intent_data: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency
          }
        }
      })
      .eq('id', transaction.id);

    if (updateError) {
      throw new Error(`Failed to update transaction ${transaction.id}: ${updateError.message}`);
    }

    console.log('✅ Payment intent processed successfully:', transaction.id);

  } catch (error) {
    console.error('❌ Error handling payment intent succeeded:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('❌ Payment intent failed:', paymentIntent.id);
    
    const paymentLinkId = paymentIntent.metadata?.payment_link_id;
    if (!paymentLinkId) {
      throw new Error('Missing payment_link_id in failed payment intent metadata');
    }

    // Find the specific transaction
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId)
      .eq('processor_payment_id', paymentIntent.id)
      .eq('payment_processor', 'stripe')
      .single();

    if (findError || !transaction) {
      console.warn(`No transaction found for failed payment intent ${paymentIntent.id}`);
      return;
    }

    // Update transaction status to failed
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        metadata: {
          ...transaction.metadata,
          payment_intent_failed_at: new Date().toISOString(),
          failure_data: {
            last_payment_error: paymentIntent.last_payment_error,
            cancellation_reason: paymentIntent.cancellation_reason
          }
        }
      })
      .eq('id', transaction.id);

    if (updateError) {
      throw new Error(`Failed to update failed transaction ${transaction.id}: ${updateError.message}`);
    }

    console.log('⚠️ Payment failure recorded for transaction:', transaction.id);

  } catch (error) {
    console.error('❌ Error handling payment intent failed:', error);
    throw error;
  }
}

// Log webhook events for debugging and idempotency
async function logWebhookEvent(event: Stripe.Event): Promise<void> {
  try {
    const eventData = event.data.object as any;
    const paymentLinkId = eventData.metadata?.payment_link_id;
    
    // Use upsert to handle potential duplicates
    await supabase.from('webhook_events').upsert({
      event_id: event.id,
      event_type: event.type,
      event_data: eventData,
      payment_link_id: paymentLinkId,
      status: 'received',
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }, {
      onConflict: 'event_id',
      ignoreDuplicates: false
    });
    
    console.log(`📝 Webhook event logged: ${event.type} (${event.id}) for payment link: ${paymentLinkId || 'none'}`);
  } catch (error) {
    console.error('❌ Failed to log webhook event:', error);
    // Don't throw here to avoid breaking webhook processing
  }
}

// Mark webhook event processing status
async function markWebhookEventStatus(eventId: string, status: string, errorMessage?: string): Promise<void> {
  try {
    await supabase
      .from('webhook_events')
      .update({
        status: status,
        error_message: errorMessage || null,
        processed_at: new Date().toISOString()
      })
      .eq('event_id', eventId);
    
    console.log(`📝 Webhook event ${eventId} marked as ${status}`);
  } catch (error) {
    console.error('❌ Failed to update webhook event status:', error);
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