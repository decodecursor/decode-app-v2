#!/usr/bin/env node

// Test Crossmint API with Solana payment method
// The wallet address format suggests it's a Solana wallet

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

async function testSolanaFormat() {
  console.log('🔬 Testing Crossmint API with Solana Payment Method\n');
  console.log('=' .repeat(60));

  const apiKey = process.env.CROSSMINT_API_KEY;
  const decodeWallet = process.env.DECODE_WALLET_ADDRESS;
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`💰 Wallet: ${decodeWallet}`);
  console.log(`🔍 Wallet Analysis: ${decodeWallet.length} chars, starts with ${decodeWallet.substring(0, 3)}... (Solana format)`);
  console.log('');

  // Test 1: Solana with USDC
  console.log('1️⃣ Testing Solana with USDC');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service'
      }
    ]
  });

  // Test 2: Solana with SOL
  console.log('\n2️⃣ Testing Solana with SOL');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'sol',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service'
      }
    ]
  });

  // Test 3: Solana with recipient as string
  console.log('\n3️⃣ Testing Solana with recipient as string');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'usdc',
      recipient: decodeWallet
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service'
      }
    ]
  });

  // Test 4: Add success/cancel URLs
  console.log('\n4️⃣ Testing with success/cancel URLs');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service',
        description: 'Test payment for beauty service'
      }
    ],
    successUrl: 'https://decode-app-v2.vercel.app/payment/success/test',
    cancelUrl: 'https://decode-app-v2.vercel.app/payment/cancel/test'
  });

  // Test 5: Complete format with metadata
  console.log('\n5️⃣ Testing complete format with metadata');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service',
        description: 'Professional beauty service payment'
      }
    ],
    successUrl: 'https://decode-app-v2.vercel.app/payment/success/test',
    cancelUrl: 'https://decode-app-v2.vercel.app/payment/cancel/test',
    metadata: {
      platform: 'DECODE_Beauty',
      test: 'true',
      original_amount: '9.00',
      fee_amount: '1.00'
    }
  });

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Solana format testing complete!');
}

async function testFormat(requestBody) {
  try {
    console.log('📤 Request:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://staging.crossmint.com/api/2022-06-09/orders', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.CROSSMINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    console.log(`📥 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ SUCCESS! This format works!');
      console.log('🎉 FOUND WORKING FORMAT - SOLANA!');
      return true;
    } else {
      console.log(`❌ Failed: ${data.message || 'Unknown error'}`);
      return false;
    }

  } catch (error) {
    console.error('💥 Network error:', error.message);
    return false;
  }
}

if (require.main === module) {
  testSolanaFormat().catch(console.error);
}

module.exports = { testSolanaFormat };