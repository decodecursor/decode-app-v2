import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
    console.log('🔍 DEBUG: Payment Intent API called at:', new Date().toISOString());
    console.log('🔍 DEBUG: Request URL:', request.url);
    console.log('🔍 DEBUG: Request method:', request.method);
    console.log('🔍 DEBUG: Request headers:', Object.fromEntries(request.headers.entries()));

    const body: CreatePaymentIntentRequest = await request.json();
    console.log('🔍 DEBUG: Request body received:', JSON.stringify(body, null, 2));

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
      console.log('❌ DEBUG: Validation failed - received:', { paymentLinkId, amount, currency });
      return NextResponse.json({
        error: 'Payment link ID, amount, and currency are required',
        debug: {
          received: { paymentLinkId, amount, currency },
          missing: {
            paymentLinkId: !paymentLinkId,
            amount: !amount,
            currency: !currency
          }
        }
      }, { status: 400 });
    }

    console.log('🔄 Creating Stripe payment intent for payment link:', paymentLinkId);
    console.log('🔍 DEBUG: Environment check:');
    console.log('- STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING');
    console.log('- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'SET' : 'MISSING');

    const supabase = await createClient();

    // Fetch payment link details from Supabase (using correct schema from working Crossmint API)
    const { data: paymentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select(`
        id,
        title,
        service_amount_aed,
        total_amount_aed,
        client_name,
        expiration_date,
        is_active,
        creator:users!creator_id (
          user_name,
          email
        )
      `)
      .eq('id', paymentLinkId)
      .single() as any;

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

    // Use the amounts from the database
    const serviceAmount = paymentLink.service_amount_aed;
    const totalAmount = paymentLink.total_amount_aed;

    // FORCE AED CURRENCY - Convert AED to USD for Stripe (3.67 AED = 1 USD)
    const AED_TO_USD_RATE = 3.67;
    const amountInUSD = Math.round((totalAmount / AED_TO_USD_RATE) * 100); // Convert to cents
    
    // Create Stripe payment intent (Stripe doesn't support AED directly, so we use USD)
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: amountInUSD,
      currency: 'usd', // Force USD for Stripe processing
      paymentLinkId: paymentLinkId,
      beautyProfessionalId: paymentLink.creator?.email || 'unknown',
      customerEmail: customerEmail,
      customerName: customerName,
      description: `${paymentLink.title || 'Beauty service payment'} (AED ${totalAmount})`
    });

    // Log transaction attempt in database - using admin client to bypass RLS
    const { error: logError } = await supabaseAdmin
      .from('transactions')
      .insert({
        payment_link_id: paymentLinkId,
        amount_aed: totalAmount,
        payment_processor: 'stripe',
        processor_transaction_id: paymentIntent.paymentIntentId,
        status: 'pending',
        buyer_email: customerEmail,
        created_at: new Date().toISOString(),
        metadata: {
          customer_name: customerName,
          service_amount_aed: serviceAmount,
          total_amount_aed: totalAmount,
          converted_amount_usd: amountInUSD / 100,
          beauty_professional_email: paymentLink.creator?.email || 'unknown'
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
        convertedAmount: amountInUSD / 100,
        convertedCurrency: 'USD',
        description: paymentLink.title,
        professionalName: paymentLink.creator?.user_name || paymentLink.creator?.email?.split('@')[0] || 'Beauty Professional',
        clientName: paymentLink.client_name || 'Client'
      }
    });

  } catch (error) {
    console.error('❌ Stripe payment intent creation failed:', error);
    
    // Check if this is a Stripe API key error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isApiKeyError = errorMessage.includes('Invalid API Key') || 
                         errorMessage.includes('api_key') ||
                         errorMessage.includes('No API key');
    
    if (isApiKeyError) {
      return NextResponse.json({
        error: 'Stripe configuration error',
        details: 'Invalid or missing Stripe API keys. Please configure valid Stripe keys in your environment variables.',
        setupInstructions: {
          message: 'To fix this issue:',
          steps: [
            '1. Go to https://dashboard.stripe.com/apikeys',
            '2. Copy your Secret key (starts with sk_test_ or sk_live_)',
            '3. Update STRIPE_SECRET_KEY in your .env file',
            '4. Copy your Publishable key (starts with pk_test_ or pk_live_)',
            '5. Update NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env file',
            '6. Restart your application'
          ]
        }
      }, { status: 503 });
    }
    
    return NextResponse.json({
      error: 'Failed to create payment intent',
      details: errorMessage
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get('paymentIntentId');

  // If no paymentIntentId provided, return API status (for debugging)
  if (!paymentIntentId) {
    return NextResponse.json({
      status: 'API endpoint accessible',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      stripeConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      availableEndpoints: ['GET', 'POST'],
      message: 'Payment Intent API is accessible. Add ?paymentIntentId=xxx to retrieve a specific payment intent.'
    });
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