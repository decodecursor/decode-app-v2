/**
 * Stripe SetupIntent API
 * Creates a SetupIntent for preloading payment forms before bid creation
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { GuestBidderService } from '@/lib/services/GuestBidderService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      bidder_email,
      bidder_name,
      auction_id,
    } = body;

    if (!bidder_email || !bidder_name) {
      return NextResponse.json(
        { error: 'Bidder email and name are required' },
        { status: 400 }
      );
    }

    console.log('[SetupIntent API] Creating setup intent for preload:', {
      bidder_email,
      bidder_name,
      auction_id,
    });

    // Get or create guest bidder to get Stripe customer ID
    const guestService = new GuestBidderService();
    const guestResult = await guestService.getOrCreateGuestBidder({
      email: bidder_email,
      name: bidder_name,
    });

    if (!guestResult.success) {
      return NextResponse.json(
        { error: guestResult.error || 'Failed to create guest bidder' },
        { status: 500 }
      );
    }

    let customerId = guestResult.stripe_customer_id;

    // If no Stripe customer exists, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: bidder_email,
        name: bidder_name,
        metadata: {
          is_guest_bidder: 'true',
          auction_id: auction_id || '',
        },
      });
      customerId = customer.id;

      // Save customer ID to guest bidder profile
      if (guestResult.guest_bidder_id) {
        await guestService.updateStripeCustomerId(guestResult.guest_bidder_id, customerId);
      }

      console.log('[SetupIntent API] Created new Stripe customer:', customerId);
    }

    // Create SetupIntent for payment method collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        type: 'bid_preload',
        auction_id: auction_id || '',
        guest_bidder_id: guestResult.guest_bidder_id || '',
        bidder_email,
      },
    });

    const totalTime = Date.now() - startTime;
    console.log('[SetupIntent API] SetupIntent created successfully:', {
      setup_intent_id: setupIntent.id,
      customer_id: customerId,
      guest_bidder_id: guestResult.guest_bidder_id,
      total_time_ms: totalTime,
    });

    return NextResponse.json({
      success: true,
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id,
      customer_id: customerId,
      guest_bidder_id: guestResult.guest_bidder_id,
    });

  } catch (error) {
    console.error('[SetupIntent API] Error creating setup intent:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create setup intent',
        success: false,
      },
      { status: 500 }
    );
  }
}
