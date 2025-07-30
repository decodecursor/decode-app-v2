import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripeService } from '@/lib/stripe';

interface CreatePaymentIntentRequest {
  paymentLinkId: string;
  amount: number; // in cents
  currency: string;
  customerEmail?: string;
  customerName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentIntentRequest = await request.json();
    const { paymentLinkId, amount, currency, customerEmail, customerName } = body;

    if (!paymentLinkId || !amount || !currency) {
      return NextResponse.json({
        error: 'Payment link ID, amount, and currency are required'
      }, { status: 400 });
    }

    console.log('🔄 Creating Stripe payment intent for payment link:', paymentLinkId);

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

    // Calculate platform fee (5%)
    const feeCalculation = stripeService.calculatePlatformFee(amount);

    // Create Stripe payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: amount,
      currency: currency,
      paymentLinkId: paymentLinkId,
      beautyProfessionalId: paymentLink.beauty_professional_id,
      customerEmail: customerEmail,
      customerName: customerName,
      description: paymentLink.description || 'Beauty service payment'
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
        converted_amount_usd: amount / 100,
        fee_amount: feeCalculation.feeAmount / 100,
        net_amount: feeCalculation.netAmount / 100,
        processor: 'stripe',
        processor_payment_id: paymentIntent.paymentIntentId,
        status: 'pending',
        customer_email: customerEmail,
        customer_name: customerName,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('❌ Failed to log transaction:', logError);
      // Don't fail the request, just log the error
    }

    console.log('✅ Stripe payment intent created successfully:', paymentIntent.paymentIntentId);

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      paymentDetails: {
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        convertedAmount: amount / 100,
        convertedCurrency: currency,
        description: paymentLink.description,
        professionalName: paymentLink.users && paymentLink.users[0] ? 
          `${paymentLink.users[0].first_name} ${paymentLink.users[0].last_name}` : 
          'Beauty Professional'
      }
    });

  } catch (error) {
    console.error('❌ Stripe payment intent creation failed:', error);
    
    return NextResponse.json({
      error: 'Failed to create payment intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get('paymentIntentId');

  if (!paymentIntentId) {
    return NextResponse.json({
      error: 'Payment Intent ID is required'
    }, { status: 400 });
  }

  try {
    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);
    
    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        client_secret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata
      }
    });

  } catch (error) {
    console.error('❌ Failed to retrieve Stripe payment intent:', error);
    
    return NextResponse.json({
      error: 'Failed to retrieve payment intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}