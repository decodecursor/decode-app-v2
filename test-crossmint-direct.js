#!/usr/bin/env node

// Direct test of Crossmint API to debug line items issue

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });
}

async function testCrossmintDirect() {
  console.log('🔬 Direct Crossmint API Test\n');

  const apiKey = process.env.CROSSMINT_API_KEY;
  const decodeWallet = process.env.DECODE_WALLET_ADDRESS;
  
  if (!apiKey || !decodeWallet) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Test 1: Simple checkout request
  console.log('1️⃣ Testing Simple Checkout Request');
  
  const checkoutRequest = {
    payment: {
      method: 'polygon-amoy',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '111.00',
        quantity: 1,
        name: 'Test Beauty Service',
        description: 'Test payment for beauty service'
      }
    ],
    successUrl: 'https://decode-app-v2.vercel.app/payment/success/test',
    cancelUrl: 'https://decode-app-v2.vercel.app/payment/cancel/test',
    metadata: {
      test: 'true',
      platform: 'DECODE_Beauty'
    }
  };

  try {
    console.log('📤 Request:', JSON.stringify(checkoutRequest, null, 2));
    
    const response = await fetch('https://staging.crossmint.com/api/2022-06-09/orders', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutRequest)
    });

    const data = await response.json();
    
    console.log(`📥 Response Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Checkout request successful!');
    } else {
      console.log('❌ Checkout request failed');
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }

  // Test 2: Check available payment methods
  console.log('\n2️⃣ Checking Available Payment Methods');
  
  try {
    const response = await fetch('https://staging.crossmint.com/api/2022-06-09/payment-methods', {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const methods = await response.json();
      console.log('✅ Available payment methods:', JSON.stringify(methods, null, 2));
    } else {
      console.log(`⚠️  Payment methods endpoint returned ${response.status}`);
    }
  } catch (error) {
    console.log('⚠️  Could not fetch payment methods:', error.message);
  }
}

if (require.main === module) {
  testCrossmintDirect().catch(console.error);
}

module.exports = { testCrossmintDirect };