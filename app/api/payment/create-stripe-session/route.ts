import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripeService } from '@/lib/stripe';
import type { PaymentLinkWithCreator } from '@/types/database';

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
        amount_aed,
        title,
        description,
        creator_id,
        is_active,
        expiration_date,
        creator:users!creator_id (
          id,
          email,
          user_name
        )
      `)
      .eq('id', paymentLinkId)
      .single() as any;

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

    if (paymentLink.expiration_date && new Date(paymentLink.expiration_date) < new Date()) {
      return NextResponse.json({
        error: 'Payment link has expired'
      }, { status: 400 });
    }

    // Convert AED to fils for Stripe (1 AED = 100 fils)
    const amountInFils = stripeService.convertAedToFils(paymentLink.amount_aed);
    const currency = 'AED';

    // Calculate platform fee
    const feeCalculation = stripeService.calculatePlatformFee(amountInFils);

    // Create success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/pay/success?paymentLinkId=${paymentLinkId}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pay/failed?paymentLinkId=${paymentLinkId}`;

    // Create Stripe checkout session
    const sessionResponse = await stripeService.createCheckoutSession({
      amount: amountInFils,
      currency: currency,
      paymentLinkId: paymentLinkId,
      beautyProfessionalId: paymentLink.creator_id,
      customerEmail: customerEmail,
      customerName: customerName,
      description: paymentLink.description || 'Beauty service payment',
      successUrl: successUrl,
      cancelUrl: cancelUrl
    });

    // Create transaction record with proper field mapping for new schema
    const { error: logError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: paymentLinkId,
        buyer_email: customerEmail,
        buyer_name: customerName,
        amount_aed: paymentLink.amount_aed,
        amount_usd: null, // Not using USD anymore
        payment_processor: 'stripe',
        processor_session_id: sessionResponse.sessionId,
        // Note: processor_payment_id will be set when payment intent is created/updated
        status: 'pending',
        metadata: {
          customer_name: customerName,
          amount_aed: paymentLink.amount_aed,
          amount_fils: amountInFils,
          fee_calculation: feeCalculation,
          beauty_professional_id: paymentLink.creator_id,
          session_created_at: new Date().toISOString()
        }
      });

    if (logError) {
      console.error('❌ Failed to log transaction:', logError);
      // Don't fail the request, just log the error
    }

    console.log('✅ Stripe payment session created successfully:', sessionResponse.sessionId);

    // Transform creator data - Supabase relations are properly typed now
    const creator = paymentLink.creator;
    const creatorName = creator?.user_name || 'Beauty Professional';

    return NextResponse.json({
      success: true,
      sessionId: sessionResponse.sessionId,
      url: sessionResponse.url,
      publicKey: sessionResponse.publicKey,
      paymentDetails: {
        amount: paymentLink.amount_aed,
        currency: 'AED',
        amountInFils: amountInFils,
        description: paymentLink.description,
        professionalName: creatorName
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