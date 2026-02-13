import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/stripe';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripeTransferService } from '@/lib/stripe-transfer-service';
import { emailService } from '@/lib/email-service';
import { AuctionStrategy } from '@/lib/payments/strategies/AuctionStrategy';
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
      
      // Check if this is due to placeholder webhook secret
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('No webhook endpoint signing secret') || 
          process.env.STRIPE_WEBHOOK_SECRET?.includes('your_stripe')) {
        console.warn('⚠️ Webhook verification skipped - using placeholder webhook secret');
        console.warn('   For production, set up a real webhook endpoint at: https://dashboard.stripe.com/webhooks');
        
        // Parse the event manually for development/testing
        try {
          event = JSON.parse(body) as Stripe.Event;
          console.log('📋 Parsed webhook event manually:', event.type);
        } catch (parseError) {
          return NextResponse.json({ error: 'Invalid webhook body' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    console.log(`🔔 Stripe webhook received: ${event.type} (${event.id})`);
    
    // Check for duplicate webhook processing (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('webhook_events')
      .select('id, status')
      .eq('event_id', event.id)
      .single();

    if (existingEvent && existingEvent.status === 'processed') {
      console.log(`⏭️ Webhook ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Log webhook event to database for debugging and idempotency
    await logWebhookEvent(event, signature);

    // Handle different event types with proper error handling
    try {
      // Determine event routing based on metadata.type
      const eventObject = event.data.object as any;
      const metadataType = eventObject?.metadata?.type;

      if (metadataType === 'auction_bid') {
        // Route to auction strategy
        await handleAuctionEvent(event);
      } else if (metadataType === 'beauty_offer') {
        // Route to beauty offer handler
        const adminClient = createServiceRoleClient();
        await handleBeautyOfferEvent(adminClient, event);
      } else {
        // Handle regular payment link events
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

/**
 * Handle auction-related webhook events
 */
async function handleAuctionEvent(event: Stripe.Event) {
  try {
    console.log(`🎯 Auction webhook event: ${event.type}`);

    const auctionStrategy = new AuctionStrategy();
    await auctionStrategy.handleWebhook(event);

    console.log(`✅ Auction webhook event processed: ${event.type}`);
  } catch (error) {
    console.error('❌ Error handling auction webhook event:', error);
    throw error;
  }
}

/**
 * Handle beauty offer webhook events (embedded checkout)
 */
async function handleBeautyOfferEvent(adminClient: any, event: Stripe.Event) {
  const LOG = '[BEAUTY-OFFER]';
  console.log(`${LOG} Routing event: ${event.type}`);

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await handleBeautyOfferPaymentSucceeded(adminClient, paymentIntent);
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleBeautyOfferCheckoutCompleted(adminClient, session);
  } else {
    console.log(`${LOG} Unhandled beauty_offer event type: ${event.type}`);
  }
}

async function handleBeautyOfferPaymentSucceeded(adminClient: any, paymentIntent: Stripe.PaymentIntent) {
  const LOG = '[BEAUTY-OFFER]';
  const { offer_id, buyer_id, business_id } = paymentIntent.metadata || {};

  if (!offer_id || !buyer_id || !business_id) {
    throw new Error(`${LOG} Missing metadata in payment intent`);
  }

  // Re-validate offer
  const { data: offer, error: offerError } = await adminClient
    .from('beauty_offers')
    .select('*, beauty_businesses!inner(id, business_name, creator_id)')
    .eq('id', offer_id)
    .eq('is_active', true)
    .single();

  if (offerError || !offer) {
    console.error(`${LOG} Offer ${offer_id} not found or inactive — triggering refund`);
    await beautyOfferAutoRefund(paymentIntent.id, paymentIntent.receipt_email, 'Offer no longer available');
    return;
  }

  if (new Date(offer.expires_at) < new Date()) {
    console.error(`${LOG} Offer ${offer_id} expired — triggering refund`);
    await beautyOfferAutoRefund(paymentIntent.id, paymentIntent.receipt_email, 'Offer has expired');
    return;
  }

  // Atomic claim: increment quantity_sold only if slots remain
  const { data: claimResult, error: claimError } = await adminClient.rpc('claim_beauty_offer_slot', {
    p_offer_id: offer_id,
  });

  let claimed = false;
  if (claimError) {
    console.warn(`${LOG} RPC not available, using conditional update`);
    const { data: updateResult } = await adminClient
      .from('beauty_offers')
      .update({ quantity_sold: offer.quantity_sold + 1, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .lt('quantity_sold', offer.quantity)
      .select('id');

    claimed = updateResult && updateResult.length > 0;
  } else {
    claimed = claimResult === true || (typeof claimResult === 'number' && claimResult > 0);
  }

  if (!claimed) {
    console.error(`${LOG} Slot claim failed for offer ${offer_id} — sold out`);
    await beautyOfferAutoRefund(paymentIntent.id, paymentIntent.receipt_email, 'Offer sold out');
    return;
  }

  // Create beauty_purchases row
  const { error: purchaseError } = await adminClient
    .from('beauty_purchases')
    .insert({
      offer_id,
      buyer_id,
      business_id,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_session_id: null,
      amount_paid: offer.price,
      currency: 'aed',
      status: 'active',
    });

  if (purchaseError) {
    console.error(`${LOG} Failed to create purchase:`, purchaseError);
    throw purchaseError;
  }

  console.log(`${LOG} Purchase created for offer ${offer_id}, buyer ${buyer_id}`);

  // Send emails (non-blocking)
  const business = offer.beauty_businesses as any;
  const buyerEmail = paymentIntent.receipt_email;

  const { data: buyerUser } = await adminClient
    .from('users')
    .select('user_name, email')
    .eq('id', buyer_id)
    .single();

  const { data: salonAdmin } = await adminClient
    .from('users')
    .select('email, user_name')
    .eq('id', business.creator_id)
    .single();

  const emailTo = buyerEmail || buyerUser?.email;
  if (emailTo) {
    emailService.send({
      to: emailTo,
      subject: `Purchase Confirmed — ${offer.title}`,
      html: `
        <h2>Your purchase is confirmed!</h2>
        <p><strong>${offer.title}</strong> at ${business.business_name}</p>
        <p>Amount paid: AED ${offer.price}</p>
        <p>You can view your deal and QR voucher in <a href="${process.env.NEXT_PUBLIC_SITE_URL}/offers/my-deals">My Offers</a>.</p>
      `,
    }).catch((err: any) => console.error(`${LOG} Buyer email failed:`, err));
  }

  if (salonAdmin?.email) {
    emailService.send({
      to: salonAdmin.email,
      subject: `New Purchase — ${offer.title}`,
      html: `
        <h2>New offer purchase!</h2>
        <p><strong>${offer.title}</strong></p>
        <p>Buyer: ${buyerUser?.user_name || emailTo || 'Unknown'}</p>
        <p>Amount: AED ${offer.price}</p>
        <p>Remaining slots: ${offer.quantity - offer.quantity_sold - 1}</p>
      `,
    }).catch((err: any) => console.error(`${LOG} Salon email failed:`, err));
  }
}

async function handleBeautyOfferCheckoutCompleted(adminClient: any, session: Stripe.Checkout.Session) {
  const LOG = '[BEAUTY-OFFER]';
  const { offer_id, buyer_id, business_id } = session.metadata || {};

  if (!offer_id || !buyer_id || !business_id) {
    throw new Error(`${LOG} Missing metadata in checkout session`);
  }

  const { data: offer, error: offerError } = await adminClient
    .from('beauty_offers')
    .select('*, beauty_businesses!inner(id, business_name, creator_id)')
    .eq('id', offer_id)
    .eq('is_active', true)
    .single();

  if (offerError || !offer) {
    console.error(`${LOG} Offer ${offer_id} not found or inactive — triggering refund`);
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (piId) await beautyOfferAutoRefund(piId, session.customer_email, 'Offer no longer available');
    return;
  }

  if (new Date(offer.expires_at) < new Date()) {
    console.error(`${LOG} Offer ${offer_id} expired — triggering refund`);
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (piId) await beautyOfferAutoRefund(piId, session.customer_email, 'Offer has expired');
    return;
  }

  // Atomic claim
  const { data: claimResult, error: claimError } = await adminClient.rpc('claim_beauty_offer_slot', {
    p_offer_id: offer_id,
  });

  let claimed = false;
  if (claimError) {
    console.warn(`${LOG} RPC not available, using conditional update`);
    const { data: updateResult } = await adminClient
      .from('beauty_offers')
      .update({ quantity_sold: offer.quantity_sold + 1, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .lt('quantity_sold', offer.quantity)
      .select('id');

    claimed = updateResult && updateResult.length > 0;
  } else {
    claimed = claimResult === true || (typeof claimResult === 'number' && claimResult > 0);
  }

  if (!claimed) {
    console.error(`${LOG} Slot claim failed for offer ${offer_id} — sold out`);
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (piId) await beautyOfferAutoRefund(piId, session.customer_email, 'Offer sold out');
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;

  const { error: purchaseError } = await adminClient
    .from('beauty_purchases')
    .insert({
      offer_id,
      buyer_id,
      business_id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_session_id: session.id,
      amount_paid: offer.price,
      currency: 'aed',
      status: 'active',
    });

  if (purchaseError) {
    console.error(`${LOG} Failed to create purchase:`, purchaseError);
    throw purchaseError;
  }

  console.log(`${LOG} Purchase created for offer ${offer_id}, buyer ${buyer_id}`);

  // Send emails (non-blocking)
  const business = offer.beauty_businesses as any;
  const buyerEmail = session.customer_email || session.customer_details?.email;

  const { data: buyerUser } = await adminClient
    .from('users')
    .select('user_name, email')
    .eq('id', buyer_id)
    .single();

  const { data: salonAdmin } = await adminClient
    .from('users')
    .select('email, user_name')
    .eq('id', business.creator_id)
    .single();

  const emailTo = buyerEmail || buyerUser?.email;
  if (emailTo) {
    emailService.send({
      to: emailTo,
      subject: `Purchase Confirmed — ${offer.title}`,
      html: `
        <h2>Your purchase is confirmed!</h2>
        <p><strong>${offer.title}</strong> at ${business.business_name}</p>
        <p>Amount paid: AED ${offer.price}</p>
        <p>You can view your deal and QR voucher in <a href="${process.env.NEXT_PUBLIC_SITE_URL}/offers/my-deals">My Offers</a>.</p>
      `,
    }).catch((err: any) => console.error(`${LOG} Buyer email failed:`, err));
  }

  if (salonAdmin?.email) {
    emailService.send({
      to: salonAdmin.email,
      subject: `New Purchase — ${offer.title}`,
      html: `
        <h2>New offer purchase!</h2>
        <p><strong>${offer.title}</strong></p>
        <p>Buyer: ${buyerUser?.user_name || emailTo || 'Unknown'}</p>
        <p>Amount: AED ${offer.price}</p>
        <p>Remaining slots: ${offer.quantity - offer.quantity_sold - 1}</p>
      `,
    }).catch((err: any) => console.error(`${LOG} Salon email failed:`, err));
  }
}

async function beautyOfferAutoRefund(paymentIntentId: string, email: string | null | undefined, reason: string) {
  const LOG = '[BEAUTY-OFFER]';
  try {
    stripeService.ensureStripeInitialized();
    await stripeService.stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
    });

    console.log(`${LOG} Auto-refund issued for ${paymentIntentId}: ${reason}`);

    if (email) {
      emailService.send({
        to: email,
        subject: 'Refund Processed — Offer No Longer Available',
        html: `
          <h2>Your refund has been processed</h2>
          <p>Unfortunately, ${reason.toLowerCase()}. Your payment has been fully refunded.</p>
          <p>The refund will appear in your account within 5–10 business days.</p>
        `,
      }).catch((err: any) => console.error(`${LOG} Refund email failed:`, err));
    }
  } catch (error) {
    console.error(`${LOG} Auto-refund failed:`, error);
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
  // Find the most recent transaction for this payment link (regardless of status)
  // Note: payment_intent.succeeded may process before checkout.session.completed
  const { data: transaction, error: findError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('payment_link_id', paymentLinkId)
    .eq('payment_processor', 'stripe')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (findError || !transaction) {
    throw new Error(`No transaction found for session ${session.id} and payment link ${paymentLinkId}`);
  }

  // Update transaction to completed status
  const { error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({
      status: 'completed',
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

  // Mark payment link as paid for real-time updates
  const { error: linkUpdateError } = await (supabaseAdmin as any)
    .from('payment_links')
    .update({ is_paid: true })
    .eq('id', paymentLinkId);

  if (linkUpdateError) {
    console.error('❌ Failed to mark payment link as paid:', linkUpdateError);
  } else {
    console.log('✅ Payment link marked as paid - real-time update triggered');
  }

  console.log('✅ Payment marked as completed in transactions table');

  // Get full payment link details for emails
  const { data: paymentLink } = await supabaseAdmin
    .from('payment_links')
    .select('*')
    .eq('id', paymentLinkId)
    .single();

  if (!paymentLink) {
    console.error('❌ Payment link not found for emails');
    return;
  }

  // Send email notifications
  try {
    console.log('📧 Sending payment email notifications...');

    // Get creator details for the emails
    const { data: creator } = await supabaseAdmin
      .from('users')
      .select('user_name, email, company_name, branch_name')
      .eq('id', paymentLink.creator_id)
      .single();

    // 1. Send admin notification to sebastian@welovedecode.com
    try {
      const adminEmailResult = await emailService.sendAdminPaymentNotification({
        payment_link_id: paymentLink.id,
        paymentlink_request_id: paymentLink.paymentlink_request_id,
        transaction_id: transaction.id,
        service_amount_aed: paymentLink.service_amount_aed || 0,
        decode_amount_aed: paymentLink.decode_amount_aed || 0,
        total_amount_aed: paymentLink.total_amount_aed || session.amount_total! / 100,
        platform_fee: paymentLink.decode_amount_aed || 0,
        company_name: creator?.company_name || 'Unknown Company',
        staff_name: creator?.user_name || 'Unknown Staff',
        branch_name: creator?.branch_name,
        client_name: paymentLink.client_name || session.customer_details?.name || 'Unknown Client',
        client_email: paymentLink.client_email || session.customer_email || '',
        client_phone: paymentLink.client_phone || session.customer_details?.phone || '',
        service_name: paymentLink.title || 'Service Payment',
        service_description: paymentLink.description,
        payment_method: 'Card',
        payment_processor: 'stripe',
        processor_transaction_id: session.payment_intent as string,
        completed_at: new Date().toISOString()
      });
      console.log('✅ Admin payment notification sent:', adminEmailResult.success ? 'SUCCESS' : 'FAILED');
    } catch (adminEmailError) {
      console.error('⚠️ Failed to send admin payment notification:', adminEmailError);
    }

    // Customer and creator emails are disabled - only admin notifications are sent

    console.log('✅ All payment email notifications processed');
  } catch (emailError) {
    console.error('❌ Error sending payment emails:', emailError);
    // Don't fail the webhook if emails fail
  }

  // Create transfer to connected account
  try {
    if (paymentLink?.creator_id) {
      // Get the service amount (before platform fee)
      const serviceAmount = paymentLink.amount_aed;

      // Create transfer for the full service amount
      await stripeTransferService.createTransfer({
        paymentIntentId: session.payment_intent as string,
        connectedAccountId: '', // Will be fetched in the service
        amountAed: serviceAmount,
        paymentId: transaction.id,
        userId: paymentLink.creator_id
      });

      console.log('✅ Transfer created for beauty professional');
    }
  } catch (transferError) {
    console.error('❌ Failed to create transfer:', transferError);
    // Don't fail the webhook, payment was successful
  }

  console.log('✅ Transaction completed manually with email notifications:', transaction.id);
}

// Helper function to update transaction to completed status
async function updateTransactionToCompleted(transaction: any, paymentIntent: Stripe.PaymentIntent) {
  const { error: updateError } = await supabaseAdmin
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

  // Mark payment link as paid for real-time updates
  const { error: linkUpdateError } = await (supabaseAdmin as any)
    .from('payment_links')
    .update({ is_paid: true })
    .eq('id', transaction.payment_link_id);

  if (linkUpdateError) {
    console.error('❌ Failed to mark payment link as paid:', linkUpdateError);
  } else {
    console.log('✅ Payment link marked as paid - real-time update triggered');
  }

  console.log('✅ Payment marked as completed in transactions table');
  console.log('✅ Payment intent processed successfully:', transaction.id);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('💳 Payment intent succeeded:', paymentIntent.id);
    console.log('💳 Payment intent metadata:', paymentIntent.metadata);
    
    const paymentLinkId = paymentIntent.metadata?.payment_link_id;
    if (!paymentLinkId) {
      console.warn('⚠️ No payment_link_id in metadata, attempting to find by payment intent ID');
      
      // Try to find transaction by payment intent ID alone
      const { data: transactionByIntent, error: intentError } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('processor_transaction_id', paymentIntent.id)
        .single();
        
      if (transactionByIntent) {
        console.log('✅ Found transaction by payment intent ID');
        await updateTransactionToCompleted(transactionByIntent, paymentIntent);
        return;
      }
      
      throw new Error('Missing payment_link_id in payment intent metadata and no matching transaction found');
    }

    // Find transaction by payment intent ID (most reliable)
    console.log('🔍 Looking for transaction with:');
    console.log('   - payment_link_id:', paymentLinkId);
    console.log('   - processor_transaction_id:', paymentIntent.id);
    
    const { data: transaction, error: findError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId)
      .eq('processor_transaction_id', paymentIntent.id)
      .eq('payment_processor', 'stripe')
      .single();

    if (findError || !transaction) {
      console.error('❌ Transaction not found, checking all transactions for this payment link');
      
      // List all transactions for debugging
      const { data: allTx, error: allError } = await supabaseAdmin
        .from('transactions')
        .select('id, payment_link_id, processor_transaction_id, status')
        .eq('payment_link_id', paymentLinkId);
        
      console.log('📋 All transactions for payment link:', allTx?.length || 0);
      if (allTx) {
        allTx.forEach(tx => {
          console.log(`   - ${tx.id}: intent=${tx.processor_transaction_id}, status=${tx.status}`);
        });
      }
      
      throw new Error(`No transaction found for payment intent ${paymentIntent.id} and payment link ${paymentLinkId}`);
    }

    await updateTransactionToCompleted(transaction, paymentIntent);

    // Send admin email notification (since checkout.session.completed may not fire)
    try {
      const { data: paymentLink } = await supabaseAdmin
        .from('payment_links')
        .select('*')
        .eq('id', paymentLinkId)
        .single();

      if (paymentLink) {
        const { data: creator } = await supabaseAdmin
          .from('users')
          .select('user_name, email, company_name, branch_name')
          .eq('id', paymentLink.creator_id)
          .single();

        const adminEmailResult = await emailService.sendAdminPaymentNotification({
          payment_link_id: paymentLink.id,
          paymentlink_request_id: paymentLink.paymentlink_request_id,
          transaction_id: transaction.id,
          service_amount_aed: paymentLink.service_amount_aed || 0,
          decode_amount_aed: paymentLink.decode_amount_aed || 0,
          total_amount_aed: paymentLink.total_amount_aed || paymentIntent.amount / 100,
          platform_fee: paymentLink.decode_amount_aed || 0,
          company_name: creator?.company_name || 'Unknown Company',
          staff_name: creator?.user_name || 'Unknown Staff',
          branch_name: creator?.branch_name,
          client_name: paymentLink.client_name || 'Unknown Client',
          client_email: paymentLink.client_email || '',
          client_phone: paymentLink.client_phone || '',
          service_name: paymentLink.title || 'Service Payment',
          service_description: paymentLink.description,
          payment_method: 'Card',
          payment_processor: 'stripe',
          processor_transaction_id: paymentIntent.id,
          completed_at: new Date().toISOString()
        });
        console.log('✅ Admin payment notification sent from payment_intent.succeeded:', adminEmailResult.success ? 'SUCCESS' : 'FAILED');
      } else {
        console.error('❌ Payment link not found for admin email');
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send admin email from payment_intent.succeeded:', emailError);
      // Don't fail the webhook if email fails
    }

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
    const { data: transaction, error: findError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId)
      .eq('processor_transaction_id', paymentIntent.id)
      .eq('payment_processor', 'stripe')
      .single();

    if (findError || !transaction) {
      console.warn(`No transaction found for failed payment intent ${paymentIntent.id}`);
      return;
    }

    // Update transaction status to failed
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        metadata: {
          ...(transaction.metadata && typeof transaction.metadata === 'object' ? transaction.metadata : {}),
          payment_intent_failed_at: new Date().toISOString(),
          failure_data: {
            last_payment_error: paymentIntent.last_payment_error ? JSON.parse(JSON.stringify(paymentIntent.last_payment_error)) : null,
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
async function logWebhookEvent(event: Stripe.Event, signature: string): Promise<void> {
  try {
    const eventData = event.data.object as any;
    const paymentLinkId = eventData.metadata?.payment_link_id;
    
    // Log webhook event to database with all required fields
    await supabaseAdmin.from('webhook_events').upsert({
      event_id: event.id,
      event_type: event.type,
      event_data: eventData,
      payment_link_id: paymentLinkId,
      signature: signature,
      timestamp: new Date(event.created * 1000).toISOString(), // Convert Unix timestamp to ISO
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
    await supabaseAdmin
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