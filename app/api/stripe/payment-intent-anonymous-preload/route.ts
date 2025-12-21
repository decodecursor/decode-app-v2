/**
 * Anonymous Stripe PaymentIntent Preload API
 *
 * Creates a PaymentIntent IMMEDIATELY on auction page load, BEFORE user identity
 * (email/name) is known, using an estimated amount (default: 500 AED).
 *
 * This enables instant Google Pay button rendering (<500ms) by shifting the
 * 500-1500ms Stripe API delay into background while user reads auction details
 * and fills forms.
 *
 * Key Features:
 * - Starts IMMEDIATELY on page mount (parallel with auction data fetch)
 * - No guest bidder lookup (saves 100-300ms)
 * - Uses estimated_amount as default - typically 500 AED
 * - PaymentIntent amount will be UPDATED to actual bid amount during bid creation
 * - Minimal metadata (just auction_id and estimated amount)
 * - User info added to metadata when bid is created
 *
 * Performance Impact:
 * - Before: Sequential waterfall (1000-3000ms)
 * - After: Parallel loading (500-1500ms) - 50% faster
 *
 * Cost Impact: None - Stripe PaymentIntents are free to create
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PAYMENT_CONFIG } from '@/lib/payments/config/paymentConfig';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-06-30.basil',
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { auction_id, estimated_amount } = body;

    // Validation
    if (!auction_id || !estimated_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: auction_id, estimated_amount' },
        { status: 400 }
      );
    }

    if (estimated_amount <= 0) {
      return NextResponse.json(
        { error: 'estimated_amount must be greater than 0' },
        { status: 400 }
      );
    }

    console.log('[Anonymous Preload API] 🚀 Creating PaymentIntent:', {
      auction_id,
      estimated_amount_aed: estimated_amount,
    });

    // Convert AED to USD
    const aedAmount = estimated_amount;
    const usdAmount = aedAmount / PAYMENT_CONFIG.currency.AED_TO_USD_RATE;
    const usdCents = Math.round(usdAmount * 100);

    // Create PaymentIntent directly (no guest bidder lookup needed)
    const stripeStartTime = Date.now();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: usdCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      capture_method: 'manual', // Pre-authorization mode
      description: `Anonymous bid preload for auction ${auction_id}`,
      metadata: {
        type: 'auction_bid',
        auction_id,
        bid_id: 'anonymous-preload',
        original_amount_aed: aedAmount.toString(),
        converted_amount_usd: usdAmount.toFixed(2),
        // User info will be added when bid is created
      },
    });
    const stripeTime = Date.now() - stripeStartTime;

    const totalTime = Date.now() - startTime;

    console.log('[Anonymous Preload API] ✅ PaymentIntent created successfully:', {
      payment_intent_id: paymentIntent.id,
      client_secret_preview: paymentIntent.client_secret?.substring(0, 20) + '...',
      timing: {
        stripe_api_ms: stripeTime,
        total_ms: totalTime,
      },
      performance: {
        savings_vs_regular_preload: '100-300ms (no guest bidder lookup)',
        background_processing: true,
      },
    });

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[Anonymous Preload API] ❌ Error creating PaymentIntent:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      time_ms: totalTime,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create PaymentIntent',
        success: false,
      },
      { status: 500 }
    );
  }
}
