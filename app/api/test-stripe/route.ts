import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    // Perform Stripe health check
    const healthCheck = await stripeService.healthCheck();
    
    // Get environment info
    const envInfo = stripeService.getEnvironmentInfo();
    
    return NextResponse.json({
      service: 'Stripe Integration Test',
      timestamp: new Date().toISOString(),
      ...healthCheck,
      configuration: envInfo,
      testCards: {
        success: '4242424242424242',
        declined: '4000000000000002',
        insufficientFunds: '4000000000009995'
      },
      nextSteps: [
        '1. Set up webhook endpoint in Stripe Dashboard',
        '2. Test payment flow with test cards',
        '3. Verify webhook processing in logs'
      ]
    });

  } catch (error) {
    return NextResponse.json({
      service: 'Stripe Integration Test',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount = 1000 } = body; // Default $10.00 in cents

    // Test creating a payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount,
      currency: 'usd',
      paymentLinkId: 'test-payment-link',
      beautyProfessionalId: 'test-professional',
      description: 'Test payment for Stripe integration',
      customerEmail: 'test@example.com'
    });

    return NextResponse.json({
      success: true,
      message: 'Test payment intent created successfully',
      paymentIntent: {
        id: paymentIntent.paymentIntentId,
        clientSecret: paymentIntent.clientSecret,
        amount: amount,
        currency: 'usd'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}