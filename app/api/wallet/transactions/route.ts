// API endpoint for crypto wallet transactions (Crossmint)
// GET /api/wallet/transactions - Get user's crypto wallet transaction history

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, user_name, wallet_address, crossmint_wallet_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`🔄 Crypto wallet request for user: ${user.email}`);

    // For now, return empty crypto wallet data since crypto transactions
    // are handled separately from fiat payments (Stripe)
    // This endpoint is specifically for Crossmint crypto wallet transactions
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_name,
          walletAddress: user.wallet_address,
          crossmintWalletId: user.crossmint_wallet_id
        },
        transactions: [], // Crypto transactions would be fetched from Crossmint API
        summary: {
          totalTransactions: 0,
          totalReceived: {
            usdc: 0,
            display: '0.00 USDC'
          },
          totalTransferred: {
            usdc: 0,
            display: '0.00 USDC'
          },
          totalFees: {
            usdc: 0,
            display: '0.00 USDC'
          },
          lastTransactionAt: null
        },
        message: 'Crypto wallet transactions will be implemented via Crossmint API'
      }
    });

  } catch (error) {
    console.error('❌ Get crypto wallet transactions error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get crypto wallet transactions'
    }, { status: 500 });
  }
}