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
    console.log('🔍 DEBUG: Payment Intent API called');
    
    const body: CreatePaymentIntentRequest = await request.json();
    console.log('🔍 DEBUG: Request body:', JSON.stringify(body, null, 2));
    
    const { paymentLinkId, amount, currency, customerEmail, customerName } = body;

    console.log('🔍 DEBUG: Extracted parameters:', {
      paymentLinkId,
      amount,
      currency,
      customerEmail,
      customerName
    });

    if (!paymentLinkId || !amount || !currency) {
      console.log('❌ DEBUG: Missing required parameters');
      return NextResponse.json({
        error: 'Payment link ID, amount, and currency are required'
      }, { status: 400 });
    }

    console.log('🔄 Creating Stripe payment intent for payment link:', paymentLinkId);
    console.log('🔍 DEBUG: Environment check:');
    console.log('- STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING');
    console.log('- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'SET' : 'MISSING');

    // Fetch payment link details from Supabase (using correct schema from working Crossmint API)
    const { data: paymentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select(`
        id,
        title,
        amount_aed,
        client_name,
        expiration_date,
        is_active,
        creator:creator_id (
          full_name,
          email
        )
      `)
      .eq('id', paymentLinkId)
      .single();

    console.log('🔍 DEBUG: Supabase query result:');
    console.log('- Error:', fetchError);
    console.log('- Data:', paymentLink);

    if (fetchError) {
      console.error('❌ Payment link database error:', JSON.stringify(fetchError, null, 2));
      return NextResponse.json({
        error: 'Payment link not found',
        debug: {
          supabaseError: fetchError,
          paymentLinkId: paymentLinkId,
          errorCode: fetchError.code,
          errorMessage: fetchError.message,
          errorDetails: fetchError.details
        }
      }, { status: 404 });
    }

    if (!paymentLink) {
      console.error('❌ No payment link data returned');
      return NextResponse.json({
        error: 'Payment link not found',
        debug: {
          message: 'No data returned from query',
          paymentLinkId: paymentLinkId
        }
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

    // Calculate platform fee (5%)
    const feeCalculation = stripeService.calculatePlatformFee(amount);

    // Create Stripe payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: amount,
      currency: currency,
      paymentLinkId: paymentLinkId,
      beautyProfessionalId: paymentLink.creator?.email || 'unknown',
      customerEmail: customerEmail,
      customerName: customerName,
      description: paymentLink.title || 'Beauty service payment'
    });

    // Log transaction attempt in database - using correct field names
    const { error: logError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: paymentLinkId,
        amount_aed: paymentLink.amount_aed,
        payment_processor: 'stripe',
        processor_transaction_id: paymentIntent.paymentIntentId,
        status: 'pending',
        buyer_email: customerEmail,
        created_at: new Date().toISOString(),
        metadata: {
          customer_name: customerName,
          original_amount_aed: paymentLink.amount_aed,
          converted_amount_usd: amount / 100,
          fee_amount_usd: feeCalculation.feeAmount / 100,
          net_amount_usd: feeCalculation.netAmount / 100,
          beauty_professional_email: paymentLink.creator?.[0]?.email || 'unknown'
        }
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
        amount: paymentLink.amount_aed,
        currency: 'AED',
        convertedAmount: amount / 100,
        convertedCurrency: currency,
        description: paymentLink.title,
        professionalName: paymentLink.creator?.[0]?.full_name || paymentLink.creator?.[0]?.email?.split('@')[0] || 'Beauty Professional',
        clientName: paymentLink.client_name || 'Client'
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