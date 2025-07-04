// Test Wallet Creation with Crossmint API
// This endpoint tests the wallet creation functionality

import { NextRequest, NextResponse } from 'next/server';
import { crossmintService } from '@/lib/crossmint';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required for wallet creation test'
      }, { status: 400 });
    }

    console.log(`🔧 Testing wallet creation for email: ${email}`);

    // Test wallet creation
    const walletResponse = await crossmintService.createWallet(email);
    
    console.log('✅ Wallet creation successful:', walletResponse);

    return NextResponse.json({
      success: true,
      message: 'Wallet creation test completed successfully',
      wallet: walletResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Wallet creation test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Wallet creation test endpoint. Send POST request with { "email": "test@example.com" }',
    usage: 'curl -X POST http://localhost:3001/api/test-wallet-creation -H "Content-Type: application/json" -d \'{"email":"test@example.com"}\''
  });
}