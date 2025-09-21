// API endpoint for creating payment links with marketplace fees
// POST /api/payment/create-link

import { NextRequest, NextResponse } from 'next/server';
import { crossmintDB } from '@/lib/crossmint-db';
import { calculateMarketplaceFee } from '@/types/crossmint';
import { USER_ROLES, normalizeRole } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const { 
      client_name, 
      title, 
      description, 
      original_amount_aed, 
      creator_id,
      linked_user_id,
      branch_name 
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

    // Verify creator exists and is a Beauty Professional using crossmintDB
    console.log('🔍 Looking for creator with ID:', creator_id);

    const creator = await crossmintDB.getUserWithWallet(creator_id);

    if (!creator) {
      console.log('❌ Creator not found');
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Normalize and validate user role
    const normalizedRole = normalizeRole(creator.role);
    if (!normalizedRole || ![USER_ROLES.STAFF, USER_ROLES.ADMIN].includes(normalizedRole)) {
      return NextResponse.json(
        { error: 'Only authenticated users can create payment links' },
        { status: 403 }
      );
    }

    // Verify branch assignment - user must be assigned to at least one branch
    if (!creator.branch_name) {
      console.log('❌ Creator has no branch assignment');
      return NextResponse.json(
        { error: 'You are not assigned to any branch. Please contact your administrator to get branch access before creating payment links.' },
        { status: 403 }
      );
    }

    // If a specific branch is requested, verify the user has access to it
    if (branch_name) {
      const userBranches = creator.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b !== '');
      if (!userBranches.includes(branch_name)) {
        console.log(`❌ Creator does not have access to branch: ${branch_name}. Available branches: ${userBranches.join(', ')}`);
        return NextResponse.json(
          { error: `You do not have access to the branch "${branch_name}". Please select a valid branch.` },
          { status: 403 }
        );
      }
    }

    // Wallet creation removed - not needed for beauty business payment links
    // if (!creator.wallet_address) {
    //   console.log(`🔄 Creator ${creator.email} doesn't have a wallet. Creating one...`);
    //   
    //   try {
    //     // Create wallet for the beauty professional
    //     const walletResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/wallet/create`, {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json'
    //       },
    //       body: JSON.stringify({
    //         userId: creator.id,
    //         email: creator.email
    //       })
    //     });

    //     if (!walletResponse.ok) {
    //       const walletError = await walletResponse.json();
    //       console.error('❌ Failed to create wallet:', walletError);
    //       return NextResponse.json(
    //         { 
    //           error: 'Failed to set up crypto wallet for creator. Please try again or contact support.',
    //           details: walletError.error 
    //         },
    //         { status: 500 }
    //       );
    //     }

    //     const walletData = await walletResponse.json();
    //     console.log(`✅ Wallet created for ${creator.email}: ${walletData.walletAddress}`);
        
    //     // Update creator object with new wallet address
    //     creator.wallet_address = walletData.walletAddress;
        
    //   } catch (error) {
    //     console.error('❌ Wallet creation error:', error);
    //     return NextResponse.json(
    //       { error: 'Failed to set up crypto wallet. Please try again later.' },
    //       { status: 500 }
    //     );
    //   }
    // }

    console.log(`🔄 Creating payment link for ${creator.user_name} (${creator.email})`);

    // Debug logging for field population
    console.log('🔍 [API-CREATE-LINK] Creator data:', {
      user_name: creator.user_name,
      branch_name: creator.branch_name,
      email: creator.email
    });

    console.log('🔍 [API-CREATE-LINK] Request branch_name:', branch_name);
    console.log('🔍 [API-CREATE-LINK] Final branch_name:', branch_name || creator.branch_name);

    // Create payment link with marketplace fee calculation
    const paymentLink = await crossmintDB.createPaymentLink({
      client_name,
      title,
      description,
      original_amount_aed,
      creator_id,
      linked_user_id,
      branch_name: branch_name || creator.branch_name, // Use selected branch or fallback to creator's branch
      creator_name: creator.user_name,
      company_name: creator.company_name
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
        original_amount: paymentLink.service_amount_aed,
        fee_amount: paymentLink.decode_amount_aed,
        total_amount: paymentLink.total_amount_aed,
        expires_at: paymentLink.expiration_date,
        client_name: paymentLink.client_name,
        service_title: paymentLink.title
      }
    });

    // Generate payment URL
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.welovedecode.com'}/pay/${paymentLink.id}`;

    return NextResponse.json({
      success: true,
      data: {
        paymentLink: {
          id: paymentLink.id,
          title: paymentLink.title,
          client_name: paymentLink.client_name,
          description: paymentLink.description,
          service_amount_aed: paymentLink.service_amount_aed,
          decode_amount_aed: paymentLink.decode_amount_aed,
          total_amount_aed: paymentLink.total_amount_aed,
          expiration_date: paymentLink.expiration_date,
          is_active: paymentLink.is_active,
          created_at: paymentLink.created_at
        },
        feeCalculation: paymentLink.fee_calculation,
        paymentUrl,
        creator: {
          id: creator.id,
          name: creator.user_name,
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
    
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.welovedecode.com'}/pay/${paymentLink.id}`;

    return NextResponse.json({
      success: true,
      data: {
        paymentLink,
        paymentUrl,
        creator: creator ? {
          id: creator.id,
          name: creator.user_name,
          email: creator.email,
          professionalCenter: creator.professional_center_name,
          company_name: creator.company_name || creator.professional_center_name // Prioritize company_name over professional_center_name
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