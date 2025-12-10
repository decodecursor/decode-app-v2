// API endpoint for wallet creation
// POST /api/wallet/create

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { walletCreationService } from '@/lib/wallet-creation';

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json();

    // Validate input
    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and userEmail' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    console.log(`🔄 API: Creating wallet for user ${userId} (${userEmail})`);

    // Verify user exists in database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create wallet
    const result = await walletCreationService.createWalletForUser(userId, userEmail);

    if (result.success) {
      console.log(`✅ API: Wallet created successfully for user ${userId}`);
      
      return NextResponse.json({
        success: true,
        data: {
          walletAddress: result.walletAddress,
          walletId: result.walletId,
          userId: userId,
          email: userEmail
        }
      }, { status: 201 });
    } else {
      console.error(`❌ API: Wallet creation failed for user ${userId}:`, result.error);
      
      return NextResponse.json({
        success: false,
        error: result.error || 'Wallet creation failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ API: Wallet creation endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// GET endpoint to check wallet status
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

    const status = await walletCreationService.checkWalletStatus(userId);

    return NextResponse.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('❌ API: Wallet status check error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}