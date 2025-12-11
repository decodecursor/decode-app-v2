/**
 * Stripe PaymentIntent Preload API (User-Specific Preload - Fallback Path)
 *
 * IMPORTANT: This is now a FALLBACK path. The main path is the anonymous preload API
 * which is triggered on page load and provides instant Google Pay button loading.
 *
 * This endpoint creates a PaymentIntent with user identity (email/name) when available.
 * It includes guest bidder lookup which adds 100-300ms overhead, but allows checking
 * for saved payment methods.
 *
 * NOTE: Cannot parallelize guest bidder lookup and PaymentIntent creation because
 * PaymentIntent needs the guest_stripe_customer_id from the lookup. The anonymous
 * preload API skips this entirely for maximum speed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionStrategy } from '@/lib/payments/strategies/AuctionStrategy';
import { GuestBidderService } from '@/lib/services/GuestBidderService';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      auction_id,
      bidder_email,
      bidder_name,
      estimated_amount,
    } = body;

    if (!bidder_email || !bidder_name || !estimated_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: bidder_email, bidder_name, estimated_amount' },
        { status: 400 }
      );
    }

    if (estimated_amount <= 0) {
      return NextResponse.json(
        { error: 'estimated_amount must be greater than 0' },
        { status: 400 }
      );
    }

    console.log('[PaymentIntent Preload API] Creating PaymentIntent for preload:', {
      bidder_email,
      bidder_name,
      estimated_amount,
      auction_id,
    });

    // STEP 1: Get or create guest bidder (includes cache lookup + DB query)
    const guestStartTime = Date.now();
    const guestService = new GuestBidderService();
    const guestResult = await guestService.getOrCreateGuestBidder({
      email: bidder_email,
      name: bidder_name,
    });
    const guestTime = Date.now() - guestStartTime;

    if (!guestResult.success) {
      return NextResponse.json(
        { error: guestResult.error || 'Failed to create guest bidder' },
        { status: 500 }
      );
    }

    console.log('[PaymentIntent Preload API] ⏱️ GuestBidder lookup/create completed:', {
      time_ms: guestTime,
      guest_bidder_id: guestResult.guest_bidder_id,
      had_stripe_customer: !!guestResult.stripe_customer_id,
    });

    // STEP 2: Create PaymentIntent with Stripe API
    const stripeStartTime = Date.now();
    const strategy = new AuctionStrategy();
    const paymentResult = await strategy.createPayment({
      amount: estimated_amount,
      description: `Bid preload for auction ${auction_id || 'unknown'}`,
      auction_id: auction_id || 'preload',
      bid_id: 'preload', // Temporary - will be updated when bid is created
      bidder_email,
      bidder_name,
      is_guest: true,
      guest_stripe_customer_id: guestResult.stripe_customer_id,
      guest_bidder_id: guestResult.guest_bidder_id,
    } as any);
    const stripeTime = Date.now() - stripeStartTime;

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Failed to create PaymentIntent' },
        { status: 500 }
      );
    }

    console.log('[PaymentIntent Preload API] ⏱️ Stripe PaymentIntent creation completed:', {
      time_ms: stripeTime,
      payment_intent_id: paymentResult.payment_intent_id,
    });

    const totalTime = Date.now() - startTime;
    const overhead = totalTime - guestTime - stripeTime;

    console.log('[PaymentIntent Preload API] ✅ PaymentIntent created successfully:', {
      payment_intent_id: paymentResult.payment_intent_id,
      customer_id: guestResult.stripe_customer_id,
      guest_bidder_id: guestResult.guest_bidder_id,
      timing_breakdown: {
        guest_bidder_ms: guestTime,
        stripe_api_ms: stripeTime,
        overhead_ms: overhead,
        total_ms: totalTime,
      },
      performance_metrics: {
        guest_percentage: Math.round((guestTime / totalTime) * 100),
        stripe_percentage: Math.round((stripeTime / totalTime) * 100),
      },
    });

    return NextResponse.json({
      success: true,
      client_secret: paymentResult.metadata?.client_secret,
      payment_intent_id: paymentResult.payment_intent_id,
      customer_id: guestResult.stripe_customer_id,
      guest_bidder_id: guestResult.guest_bidder_id,
    });

  } catch (error) {
    console.error('[PaymentIntent Preload API] Error creating PaymentIntent:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create PaymentIntent',
        success: false,
      },
      { status: 500 }
    );
  }
}
