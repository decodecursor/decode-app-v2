#!/usr/bin/env node

// Test different Crossmint API endpoints and versions
// Goal: Find the correct endpoint for creating checkout sessions

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

async function testEndpointVariations() {
  console.log('🔬 Testing Different Crossmint API Endpoints\n');
  console.log('=' .repeat(60));

  const apiKey = process.env.CROSSMINT_API_KEY;
  const decodeWallet = process.env.DECODE_WALLET_ADDRESS;
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`💰 Wallet: ${decodeWallet}`);
  console.log('');

  // Standard request body that should work
  const requestBody = {
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
  };

  console.log('📤 Standard Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  // Test different endpoints
  const endpoints = [
    'https://staging.crossmint.com/api/2022-06-09/orders',
    'https://staging.crossmint.com/api/orders', 
    'https://staging.crossmint.com/api/v1/orders',
    'https://staging.crossmint.com/api/2022-06-09/checkout',
    'https://staging.crossmint.com/api/checkout',
    'https://staging.crossmint.com/api/v1/checkout',
    'https://staging.crossmint.com/api/2022-06-09/checkout-sessions',
    'https://staging.crossmint.com/api/checkout-sessions',
    'https://staging.crossmint.com/api/2022-06-09/payment-intents',
    'https://staging.crossmint.com/api/payment-intents'
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`${i + 1}️⃣ Testing: ${endpoint}`);
    
    const success = await testEndpoint(endpoint, requestBody);
    if (success) {
      console.log('🎉 FOUND WORKING ENDPOINT!');
      break;
    }
    console.log(''); // Add spacing between tests
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Endpoint testing complete!');
}

async function testEndpoint(url, requestBody) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.CROSSMINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    console.log(`   📥 Status: ${response.status}`);
    
    if (response.ok) {
      console.log('   ✅ SUCCESS!');
      console.log('   📋 Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`   ❌ Failed: ${data.message || 'Unknown error'}`);
      
      // Show more details for interesting errors
      if (response.status === 404) {
        console.log('   🔍 Endpoint not found');
      } else if (response.status === 400 && data.message !== 'Line items are required') {
        console.log('   🔍 Different error - might be progress!');
        console.log('   📋 Details:', JSON.stringify(data, null, 2));
      }
      
      return false;
    }

  } catch (error) {
    console.log(`   💥 Network error: ${error.message}`);
    return false;
  }
}

if (require.main === module) {
  testEndpointVariations().catch(console.error);
}

module.exports = { testEndpointVariations };