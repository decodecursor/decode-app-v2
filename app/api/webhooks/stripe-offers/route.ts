import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/lib/stripe'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { emailService } from '@/lib/email-service'
import type Stripe from 'stripe'

const LOG_PREFIX = '[BEAUTY-OFFER]'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      console.error(`${LOG_PREFIX} Missing Stripe signature header`)
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    const webhookSecret = process.env.STRIPE_OFFERS_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error(`${LOG_PREFIX} Missing STRIPE_OFFERS_WEBHOOK_SECRET`)
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    try {
      stripeService.ensureStripeInitialized()
      event = stripeService.stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error(`${LOG_PREFIX} Webhook signature verification failed:`, error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log(`${LOG_PREFIX} Webhook received: ${event.type} (${event.id})`)

    // Early-return if not a beauty_offer event
    const eventObject = event.data.object as any
    if (eventObject.metadata?.type !== 'beauty_offer') {
      console.log(`${LOG_PREFIX} Ignoring non-beauty_offer event`)
      return NextResponse.json({ received: true })
    }

    const adminClient = createServiceRoleClient()

    // Idempotency check
    const { data: existingEvent } = await adminClient
      .from('webhook_events')
      .select('id, status')
      .eq('event_id', event.id)
      .single()

    if (existingEvent && existingEvent.status === 'processed') {
      console.log(`${LOG_PREFIX} Event ${event.id} already processed, skipping`)
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Log webhook event
    await logWebhookEvent(adminClient, event, signature)

    // Handle checkout.session.completed (legacy Stripe-hosted checkout)
    if (event.type === 'checkout.session.completed') {
      try {
        const session = eventObject as Stripe.Checkout.Session
        await handleCheckoutCompleted(adminClient, session)
        await markWebhookStatus(adminClient, event.id, 'processed')
      } catch (error) {
        console.error(`${LOG_PREFIX} Error processing checkout:`, error)
        await markWebhookStatus(adminClient, event.id, 'failed', error instanceof Error ? error.message : 'Unknown error')
      }
    // Handle payment_intent.succeeded (embedded checkout)
    } else if (event.type === 'payment_intent.succeeded') {
      try {
        const paymentIntent = eventObject as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(adminClient, paymentIntent)
        await markWebhookStatus(adminClient, event.id, 'processed')
      } catch (error) {
        console.error(`${LOG_PREFIX} Error processing payment intent:`, error)
        await markWebhookStatus(adminClient, event.id, 'failed', error instanceof Error ? error.message : 'Unknown error')
      }
    } else {
      console.log(`${LOG_PREFIX} Unhandled event type: ${event.type}`)
      await markWebhookStatus(adminClient, event.id, 'unhandled')
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} Webhook processing failed:`, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(adminClient: any, session: Stripe.Checkout.Session) {
  const { offer_id, buyer_id, business_id } = session.metadata || {}

  if (!offer_id || !buyer_id || !business_id) {
    throw new Error('Missing metadata in checkout session')
  }

  // Re-validate offer
  const { data: offer, error: offerError } = await adminClient
    .from('beauty_offers')
    .select('*, beauty_businesses!inner(id, business_name, creator_id)')
    .eq('id', offer_id)
    .eq('is_active', true)
    .single()

  if (offerError || !offer) {
    console.error(`${LOG_PREFIX} Offer ${offer_id} not found or inactive — triggering refund`)
    await autoRefund(session, buyer_id, 'Offer no longer available')
    return
  }

  if (new Date(offer.expires_at) < new Date()) {
    console.error(`${LOG_PREFIX} Offer ${offer_id} expired — triggering refund`)
    await autoRefund(session, buyer_id, 'Offer has expired')
    return
  }

  // Atomic claim: increment quantity_sold only if slots remain
  const { data: claimResult, error: claimError } = await adminClient.rpc('claim_beauty_offer_slot', {
    p_offer_id: offer_id,
  })

  // If no RPC exists, fall back to a conditional update
  let claimed = false
  if (claimError) {
    console.warn(`${LOG_PREFIX} RPC not available, using conditional update`)
    const { data: updateResult, count } = await adminClient
      .from('beauty_offers')
      .update({ quantity_sold: offer.quantity_sold + 1, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .lt('quantity_sold', offer.quantity)
      .select('id')

    claimed = updateResult && updateResult.length > 0
  } else {
    claimed = claimResult === true || (typeof claimResult === 'number' && claimResult > 0)
  }

  if (!claimed) {
    console.error(`${LOG_PREFIX} Slot claim failed for offer ${offer_id} — sold out race condition`)
    await autoRefund(session, buyer_id, 'Offer sold out')
    return
  }

  // Get payment intent ID
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null

  // Create beauty_purchases row
  const { data: newPurchase, error: purchaseError } = await adminClient
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
    })
    .select('id')
    .single()

  if (purchaseError) {
    console.error(`${LOG_PREFIX} Failed to create purchase:`, purchaseError)
    throw purchaseError
  }

  console.log(`${LOG_PREFIX} Purchase ${newPurchase.id} created for offer ${offer_id}, buyer ${buyer_id}`)

  // Send emails (non-blocking)
  const business = offer.beauty_businesses as any
  const buyerEmail = session.customer_email || session.customer_details?.email

  // Get buyer name
  const { data: buyerUser } = await adminClient
    .from('users')
    .select('user_name, email')
    .eq('id', buyer_id)
    .single()

  // Get salon admin email
  const { data: salonAdmin } = await adminClient
    .from('users')
    .select('email, user_name')
    .eq('id', business.creator_id)
    .single()

  const emailTo = buyerEmail || buyerUser?.email
  if (emailTo) {
    emailService.send({
      to: emailTo,
      subject: `Purchase Confirmed — ${offer.title}`,
      html: `
        <h2>Your purchase is confirmed!</h2>
        <p><strong>${offer.title}</strong> at ${business.business_name}</p>
        <p>Amount paid: AED ${offer.price}</p>
        <p>You can view your deal and QR voucher in <a href="${process.env.NEXT_PUBLIC_SITE_URL}/offers/my-offers">My Offers</a>.</p>
      `,
    }).catch(err => console.error(`${LOG_PREFIX} Buyer email failed:`, err))
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
    }).catch(err => console.error(`${LOG_PREFIX} Salon email failed:`, err))
  }

  // Admin notification
  emailService.send({
    to: 'sebastian@welovedecode.com',
    subject: `Offer Purchase — ${offer.title} - ${newPurchase.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>New offer purchase!</h2>
      <p>${buyerUser?.user_name || emailTo || 'Unknown'} purchased "<strong>${offer.title}</strong>" from ${business.business_name}.</p>
      <p>Amount: AED ${offer.price}</p>
      <p>Purchase ID: <strong>${newPurchase.id.slice(0, 8).toUpperCase()}</strong></p>
      <p style="font-size:11px;color:#999;">Full ref: ${newPurchase.id}</p>
    `,
  }).catch(err => console.error(`${LOG_PREFIX} Admin email failed:`, err))
}

async function handlePaymentIntentSucceeded(adminClient: any, paymentIntent: Stripe.PaymentIntent) {
  const { offer_id, buyer_id, business_id } = paymentIntent.metadata || {}

  if (!offer_id || !buyer_id || !business_id) {
    throw new Error('Missing metadata in payment intent')
  }

  // Re-validate offer
  const { data: offer, error: offerError } = await adminClient
    .from('beauty_offers')
    .select('*, beauty_businesses!inner(id, business_name, creator_id)')
    .eq('id', offer_id)
    .eq('is_active', true)
    .single()

  if (offerError || !offer) {
    console.error(`${LOG_PREFIX} Offer ${offer_id} not found or inactive — triggering refund`)
    await autoRefundPaymentIntent(paymentIntent.id, buyer_id, 'Offer no longer available', paymentIntent.receipt_email)
    return
  }

  if (new Date(offer.expires_at) < new Date()) {
    console.error(`${LOG_PREFIX} Offer ${offer_id} expired — triggering refund`)
    await autoRefundPaymentIntent(paymentIntent.id, buyer_id, 'Offer has expired', paymentIntent.receipt_email)
    return
  }

  // Atomic claim
  const { data: claimResult, error: claimError } = await adminClient.rpc('claim_beauty_offer_slot', {
    p_offer_id: offer_id,
  })

  let claimed = false
  if (claimError) {
    console.warn(`${LOG_PREFIX} RPC not available, using conditional update`)
    const { data: updateResult } = await adminClient
      .from('beauty_offers')
      .update({ quantity_sold: offer.quantity_sold + 1, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .lt('quantity_sold', offer.quantity)
      .select('id')

    claimed = updateResult && updateResult.length > 0
  } else {
    claimed = claimResult === true || (typeof claimResult === 'number' && claimResult > 0)
  }

  if (!claimed) {
    console.error(`${LOG_PREFIX} Slot claim failed for offer ${offer_id} — sold out race condition`)
    await autoRefundPaymentIntent(paymentIntent.id, buyer_id, 'Offer sold out', paymentIntent.receipt_email)
    return
  }

  // Create beauty_purchases row
  const { data: newPurchase, error: purchaseError } = await adminClient
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
    })
    .select('id')
    .single()

  if (purchaseError) {
    console.error(`${LOG_PREFIX} Failed to create purchase:`, purchaseError)
    throw purchaseError
  }

  console.log(`${LOG_PREFIX} Purchase ${newPurchase.id} created for offer ${offer_id}, buyer ${buyer_id} (via PaymentIntent)`)

  // Send emails (non-blocking)
  const business = offer.beauty_businesses as any
  const buyerEmail = paymentIntent.receipt_email

  const { data: buyerUser } = await adminClient
    .from('users')
    .select('user_name, email')
    .eq('id', buyer_id)
    .single()

  const { data: salonAdmin } = await adminClient
    .from('users')
    .select('email, user_name')
    .eq('id', business.creator_id)
    .single()

  const emailTo = buyerEmail || buyerUser?.email
  if (emailTo) {
    emailService.send({
      to: emailTo,
      subject: `Purchase Confirmed — ${offer.title}`,
      html: `
        <h2>Your purchase is confirmed!</h2>
        <p><strong>${offer.title}</strong> at ${business.business_name}</p>
        <p>Amount paid: AED ${offer.price}</p>
        <p>You can view your deal and QR voucher in <a href="${process.env.NEXT_PUBLIC_SITE_URL}/offers/my-offers">My Offers</a>.</p>
      `,
    }).catch(err => console.error(`${LOG_PREFIX} Buyer email failed:`, err))
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
    }).catch(err => console.error(`${LOG_PREFIX} Salon email failed:`, err))
  }

  // Admin notification
  emailService.send({
    to: 'sebastian@welovedecode.com',
    subject: `Offer Purchase — ${offer.title} - ${newPurchase.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>New offer purchase!</h2>
      <p>${buyerUser?.user_name || emailTo || 'Unknown'} purchased "<strong>${offer.title}</strong>" from ${business.business_name}.</p>
      <p>Amount: AED ${offer.price}</p>
      <p>Purchase ID: <strong>${newPurchase.id.slice(0, 8).toUpperCase()}</strong></p>
      <p style="font-size:11px;color:#999;">Full ref: ${newPurchase.id}</p>
    `,
  }).catch(err => console.error(`${LOG_PREFIX} Admin email failed:`, err))
}

async function autoRefundPaymentIntent(paymentIntentId: string, buyerId: string, reason: string, email?: string | null) {
  try {
    stripeService.ensureStripeInitialized()
    await stripeService.stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
    })

    console.log(`${LOG_PREFIX} Auto-refund issued for ${paymentIntentId}: ${reason}`)

    if (email) {
      emailService.send({
        to: email,
        subject: 'Refund Processed — Offer No Longer Available',
        html: `
          <h2>Your refund has been processed</h2>
          <p>Unfortunately, ${reason.toLowerCase()}. Your payment has been fully refunded.</p>
          <p>The refund will appear in your account within 5–10 business days.</p>
        `,
      }).catch(err => console.error(`${LOG_PREFIX} Refund email failed:`, err))
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Auto-refund failed:`, error)
  }
}

async function autoRefund(session: Stripe.Checkout.Session, buyerId: string, reason: string) {
  try {
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

    if (!paymentIntentId) {
      console.error(`${LOG_PREFIX} Cannot refund — no payment_intent on session`)
      return
    }

    stripeService.ensureStripeInitialized()
    await stripeService.stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
    })

    console.log(`${LOG_PREFIX} Auto-refund issued for ${paymentIntentId}: ${reason}`)

    // Email the buyer about the refund
    const buyerEmail = session.customer_email || session.customer_details?.email
    if (buyerEmail) {
      emailService.send({
        to: buyerEmail,
        subject: 'Refund Processed — Offer No Longer Available',
        html: `
          <h2>Your refund has been processed</h2>
          <p>Unfortunately, ${reason.toLowerCase()}. Your payment has been fully refunded.</p>
          <p>The refund will appear in your account within 5–10 business days.</p>
        `,
      }).catch(err => console.error(`${LOG_PREFIX} Refund email failed:`, err))
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Auto-refund failed:`, error)
  }
}

async function logWebhookEvent(adminClient: any, event: Stripe.Event, signature: string) {
  try {
    const eventData = event.data.object as any
    await adminClient.from('webhook_events').upsert({
      event_id: event.id,
      event_type: event.type,
      event_data: eventData,
      payment_link_id: eventData.metadata?.offer_id || null,
      signature,
      timestamp: new Date(event.created * 1000).toISOString(),
      status: 'received',
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'event_id',
      ignoreDuplicates: false,
    })
    console.log(`${LOG_PREFIX} Event logged: ${event.type} (${event.id})`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to log webhook event:`, error)
  }
}

async function markWebhookStatus(adminClient: any, eventId: string, status: string, errorMessage?: string) {
  try {
    await adminClient
      .from('webhook_events')
      .update({
        status,
        error_message: errorMessage || null,
        processed_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
    console.log(`${LOG_PREFIX} Event ${eventId} marked as ${status}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to update event status:`, error)
  }
}
