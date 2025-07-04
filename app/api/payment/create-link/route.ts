// API endpoint for creating payment links with marketplace fees
// POST /api/payment/create-link

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { crossmintDB } from '@/lib/crossmint-db';
import { calculateMarketplaceFee } from '@/types/crossmint';

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { 
      client_name, 
      title, 
      description, 
      original_amount_aed, 
      creator_id,
      linked_user_id 
    } = await request.json();

    // Validate required fields
    if (!title || !original_amount_aed || !creator_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title, original_amount_aed, creator_id' },
        { status: 400 }
      );
    }

    // Validate amount
    if (original_amount_aed <= 0 || original_amount_aed > 10000) {
      return NextResponse.json(
        { error: 'Amount must be between AED 0.01 and AED 10,000' },
        { status: 400 }
      );
    }

    // Verify creator exists and is a Beauty Professional
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, email, full_name, role, wallet_address')
      .eq('id', creator_id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    if (creator.role !== 'Beauty Professional') {
      return NextResponse.json(
        { error: 'Only Beauty Professionals can create payment links' },
        { status: 403 }
      );
    }

    // Check if creator has a wallet (required for payments)
    if (!creator.wallet_address) {
      return NextResponse.json(
        { error: 'Creator must have a crypto wallet set up before creating payment links. Please contact support.' },
        { status: 400 }
      );
    }

    console.log(`🔄 Creating payment link for ${creator.full_name} (${creator.email})`);

    // Create payment link with marketplace fee calculation
    const paymentLink = await crossmintDB.createPaymentLink({
      client_name,
      title,
      description,
      original_amount_aed,
      creator_id,
      linked_user_id
    });

    console.log(`✅ Payment link created: ${paymentLink.id}`);

    // Record creation transaction for tracking
    await crossmintDB.recordTransaction({
      user_id: creator_id,
      payment_link_id: paymentLink.id,
      transaction_type: 'wallet_created', // Using this as closest match for "link_created"
      status: 'completed',
      metadata: {
        action: 'payment_link_created',
        original_amount: paymentLink.original_amount_aed,
        fee_amount: paymentLink.fee_amount_aed,
        total_amount: paymentLink.total_amount_aed,
        expires_at: paymentLink.expiration_date,
        client_name: paymentLink.client_name,
        service_title: paymentLink.title
      }
    });

    // Generate payment URL
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentLink.id}`;

    return NextResponse.json({
      success: true,
      data: {
        paymentLink: {
          id: paymentLink.id,
          title: paymentLink.title,
          client_name: paymentLink.client_name,
          description: paymentLink.description,
          original_amount_aed: paymentLink.original_amount_aed,
          fee_amount_aed: paymentLink.fee_amount_aed,
          total_amount_aed: paymentLink.total_amount_aed,
          expiration_date: paymentLink.expiration_date,
          is_active: paymentLink.is_active,
          created_at: paymentLink.created_at
        },
        feeCalculation: paymentLink.fee_calculation,
        paymentUrl,
        creator: {
          id: creator.id,
          name: creator.full_name,
          email: creator.email
        },
        qrCodeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/qr?url=${encodeURIComponent(paymentUrl)}`
      }
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Create payment link error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment link'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve payment link details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');
    const creatorId = searchParams.get('creatorId');

    if (!linkId) {
      return NextResponse.json(
        { error: 'Missing linkId parameter' },
        { status: 400 }
      );
    }

    // Get payment link
    const paymentLink = await crossmintDB.getPaymentLink(linkId);
    
    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this link
    if (creatorId && paymentLink.creator_id !== creatorId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get creator details
    const creator = await crossmintDB.getUserWithWallet(paymentLink.creator_id);
    
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentLink.id}`;

    return NextResponse.json({
      success: true,
      data: {
        paymentLink,
        paymentUrl,
        creator: creator ? {
          id: creator.id,
          name: creator.full_name,
          professionalCenter: creator.professional_center_name
        } : null,
        qrCodeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/qr?url=${encodeURIComponent(paymentUrl)}`
      }
    });

  } catch (error) {
    console.error('❌ Get payment link error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get payment link'
    }, { status: 500 });
  }
}