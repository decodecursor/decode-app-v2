// API endpoint for creating Crossmint checkout sessions
// POST /api/payment/create-session

import { NextRequest, NextResponse } from 'next/server';
import { crossmintService } from '@/lib/crossmint';
import { crossmintDB } from '@/lib/crossmint-db';
import { calculateMarketplaceFee } from '@/types/crossmint';

export async function POST(request: NextRequest) {
  try {
    const { paymentLinkId } = await request.json();

    // Validate input
    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentLinkId' },
        { status: 400 }
      );
    }

    console.log(`🔄 Creating checkout session for payment link: ${paymentLinkId}`);

    // Get payment link details
    const paymentLink = await crossmintDB.getPaymentLink(paymentLinkId);
    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check if payment link is active and not expired
    if (!paymentLink.is_active) {
      return NextResponse.json(
        { error: 'Payment link is deactivated' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expirationDate = new Date(paymentLink.expiration_date);
    if (now > expirationDate) {
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      );
    }

    // Get creator (beauty professional) details
    const creator = await crossmintDB.getUserWithWallet(paymentLink.creator_id);
    if (!creator) {
      return NextResponse.json(
        { error: 'Payment link creator not found' },
        { status: 404 }
      );
    }

    // Ensure creator has a wallet
    if (!creator.wallet_address) {
      return NextResponse.json(
        { error: 'Beauty professional wallet not set up. Please contact support.' },
        { status: 400 }
      );
    }

    // Calculate fees (works with current database schema)
    // Note: amount_aed currently stores the total amount customer pays
    const totalAmount = paymentLink.amount_aed;
    
    // Extract fee information from description if available, otherwise calculate
    let originalAmount: number;
    let feeAmount: number;
    
    if (paymentLink.description && paymentLink.description.includes('Original:')) {
      // Parse fee info from description
      const matches = paymentLink.description.match(/Original: AED ([\d.]+)/);
      if (matches && matches[1]) {
        originalAmount = parseFloat(matches[1]);
        feeAmount = totalAmount - originalAmount;
      } else {
        // Fallback: reverse-calculate original amount from total
        originalAmount = Math.round((totalAmount / 1.11) * 100) / 100;
        feeAmount = totalAmount - originalAmount;
      }
    } else {
      // Fallback: reverse-calculate original amount from total  
      originalAmount = Math.round((totalAmount / 1.11) * 100) / 100;
      feeAmount = totalAmount - originalAmount;
    }

    // Generate Crossmint widget checkout URL (no API call needed)
    const environment = process.env.CROSSMINT_ENVIRONMENT || 'production';
    const projectId = process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID;
    
    // DEBUG: Log environment variables
    console.log('🔧 DEBUG Environment Variables:');
    console.log('CROSSMINT_ENVIRONMENT:', process.env.CROSSMINT_ENVIRONMENT);
    console.log('NEXT_PUBLIC_CROSSMINT_PROJECT_ID:', process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID);
    console.log('Environment being used:', environment);
    console.log('Project ID being used:', projectId);
    
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Crossmint project ID not configured'
      }, { status: 500 });
    }

    // Create checkout session using widget approach
    const sessionId = `decode_${paymentLinkId.substring(0, 8)}_${Date.now()}`;
    const baseUrl = environment === 'production' 
      ? 'https://crossmint.com' 
      : 'https://staging.crossmint.com';

    const mintConfig = {
      lineItems: [{
        collectionLocator: `crossmint:${projectId}:beauty-services`,
        callData: {
          totalPrice: totalAmount.toFixed(2),
          currency: 'AED',
          paymentLinkId: paymentLinkId,
          beautyProfessionalId: creator.id,
          originalAmount: originalAmount.toFixed(2),
          feeAmount: feeAmount.toFixed(2),
          service: 'beauty',
          platform: 'DECODE_Beauty',
          creatorEmail: creator.email,
          timestamp: new Date().toISOString()
        }
      }],
      payment: {
        method: 'fiat',
        currency: 'AED'
      }
    };

    const widgetParams = new URLSearchParams({
      clientId: projectId,
      mintConfig: JSON.stringify(mintConfig)
    });

    const checkoutSession = {
      id: sessionId,
      url: `${baseUrl}/checkout?${widgetParams.toString()}`,
      status: 'pending',
      amount: totalAmount.toFixed(2),
      currency: 'AED',
      metadata: mintConfig.lineItems[0].callData
    };

    console.log(`✅ Checkout session created: ${checkoutSession.id}`);

    // Record payment session creation (compatible with current schema)
    console.log(`📋 Payment session created - Session ID: ${checkoutSession.id}`);
    console.log(`💰 Amount breakdown - Original: AED ${originalAmount}, Fee: AED ${feeAmount}, Total: AED ${totalAmount}`);
    
    // Note: Transaction recording will be implemented when wallet_transactions table is available
    // For now, we log the session creation for debugging

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id, // Frontend expects this at root level
      checkoutUrl: checkoutSession.url,
      amount: {
        original: originalAmount,
        fee: feeAmount,
        total: totalAmount,
        currency: 'AED'
      },
      paymentLink: {
        id: paymentLink.id,
        title: paymentLink.title,
        clientName: paymentLink.client_name,
        expiresAt: paymentLink.expiration_date
      },
      creator: {
        name: creator.full_name,
        professionalCenter: creator.professional_center_name
      }
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Create checkout session error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    }, { status: 500 });
  }
}

// GET endpoint to check session status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const session = await crossmintService.getCheckoutSession(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('❌ Get checkout session error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get checkout session'
    }, { status: 500 });
  }
}