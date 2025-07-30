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
    
    const paymentLinkId = session.metadata?.payment_link_id;
    const beautyProfessionalId = session.metadata?.beauty_professional_id;

    if (!paymentLinkId || !beautyProfessionalId) {
      console.error('❌ Missing metadata in checkout session');
      return;
    }

    // Update transaction status in database
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        processor_payment_id: session.payment_intent as string,
        completed_at: new Date().toISOString(),
        customer_email: session.customer_email,
        updated_at: new Date().toISOString()
      })
      .eq('processor_session_id', session.id);

    if (updateError) {
      console.error('❌ Failed to update transaction:', updateError);
      return;
    }

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
      console.error('❌ Failed to update payment link status:', linkUpdateError);
    }

    // TODO: Trigger payout to beauty professional
    // TODO: Send confirmation emails
    // TODO: Update analytics

    console.log('✅ Transaction completed successfully for payment link:', paymentLinkId);

  } catch (error) {
    console.error('❌ Error handling checkout session completed:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('💳 Payment intent succeeded:', paymentIntent.id);
    
    const paymentLinkId = paymentIntent.metadata?.payment_link_id;
    
    if (!paymentLinkId) {
      console.error('❌ Missing payment_link_id in payment intent metadata');
      return;
    }

    // Update transaction with payment intent details
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        processor_payment_id: paymentIntent.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('payment_link_id', paymentLinkId)
      .eq('processor', 'stripe');

    if (updateError) {
      console.error('❌ Failed to update transaction from payment intent:', updateError);
    }

    console.log('✅ Payment intent processed successfully');

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