import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripeService } from '@/lib/stripe';

interface CreateStripeSessionRequest {
  paymentLinkId: string;
  customerEmail?: string;
  customerName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateStripeSessionRequest = await request.json();
    const { paymentLinkId, customerEmail, customerName } = body;

    if (!paymentLinkId) {
      return NextResponse.json({
        error: 'Payment link ID is required'
      }, { status: 400 });
    }

    console.log('🔄 Creating Stripe payment session for payment link:', paymentLinkId);

    // Fetch payment link details from Supabase
    const { data: paymentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select(`
        id,
        amount,
        currency,
        description,
        beauty_professional_id,
        is_active,
        expires_at,
        users!beauty_professional_id (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', paymentLinkId)
      .single();

    if (fetchError || !paymentLink) {
      console.error('❌ Payment link not found:', fetchError);
      return NextResponse.json({
        error: 'Payment link not found'
      }, { status: 404 });
    }

    // Validate payment link
    if (!paymentLink.is_active) {
      return NextResponse.json({
        error: 'Payment link is not active'
      }, { status: 400 });
    }

    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      return NextResponse.json({
        error: 'Payment link has expired'
      }, { status: 400 });
    }

    // Convert AED to USD for Stripe (Stripe doesn't support AED directly)
    const amountInCents = paymentLink.currency === 'AED' 
      ? stripeService.convertAedToUsd(paymentLink.amount)
      : Math.round(paymentLink.amount * 100); // Convert to cents

    const currency = paymentLink.currency === 'AED' ? 'USD' : paymentLink.currency;

    // Calculate platform fee
    const feeCalculation = stripeService.calculatePlatformFee(amountInCents);

    // Create success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/pay/success?paymentLinkId=${paymentLinkId}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pay/failed?paymentLinkId=${paymentLinkId}`;

    // Create Stripe checkout session
    const sessionResponse = await stripeService.createCheckoutSession({
      amount: amountInCents,
      currency: currency,
      paymentLinkId: paymentLinkId,
      beautyProfessionalId: paymentLink.beauty_professional_id,
      customerEmail: customerEmail,
      customerName: customerName,
      description: paymentLink.description || 'Beauty service payment',
      successUrl: successUrl,
      cancelUrl: cancelUrl
    });

    // Log transaction attempt in database
    const { error: logError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: paymentLinkId,
        beauty_professional_id: paymentLink.beauty_professional_id,
        amount: paymentLink.amount,
        original_amount: paymentLink.amount,
        currency: paymentLink.currency,
        converted_amount_usd: amountInCents / 100,
        fee_amount: feeCalculation.feeAmount / 100,
        net_amount: feeCalculation.netAmount / 100,
        processor: 'stripe',
        processor_session_id: sessionResponse.sessionId,
        status: 'pending',
        customer_email: customerEmail,
        customer_name: customerName,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('❌ Failed to log transaction:', logError);
      // Don't fail the request, just log the error
    }

    console.log('✅ Stripe payment session created successfully:', sessionResponse.sessionId);

    return NextResponse.json({
      success: true,
      sessionId: sessionResponse.sessionId,
      url: sessionResponse.url,
      publicKey: sessionResponse.publicKey,
      paymentDetails: {
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        convertedAmount: amountInCents / 100,
        convertedCurrency: currency,
        description: paymentLink.description,
        professionalName: paymentLink.users && paymentLink.users[0] ? 
          `${paymentLink.users[0].first_name} ${paymentLink.users[0].last_name}` : 
          'Beauty Professional'
      }
    });

  } catch (error) {
    console.error('❌ Stripe session creation failed:', error);
    
    return NextResponse.json({
      error: 'Failed to create payment session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({
      error: 'Session ID is required'
    }, { status: 400 });
  }

  try {
    const session = await stripeService.getCheckoutSession(sessionId);
    
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_email,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('❌ Failed to retrieve Stripe session:', error);
    
    return NextResponse.json({
      error: 'Failed to retrieve payment session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}