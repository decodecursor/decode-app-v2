#!/usr/bin/env node

// Systematic testing of different Crossmint API formats
// Goal: Fix the "Line items are required" error

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

async function testDifferentFormats() {
  console.log('🔬 Testing Different Crossmint API Formats\n');
  console.log('=' .repeat(60));

  const apiKey = process.env.CROSSMINT_API_KEY;
  const decodeWallet = process.env.DECODE_WALLET_ADDRESS;
  
  if (!apiKey || !decodeWallet) {
    console.error('❌ Missing required environment variables');
    return;
  }

  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`💰 Wallet: ${decodeWallet}`);
  console.log('');

  // Test 1: Minimal line items (no currency field)
  console.log('1️⃣ Testing Minimal Line Items (no currency)');
  await testFormat({
    payment: {
      method: 'polygon-amoy',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Item'
      }
    ]
  });

  // Test 2: Line items with description
  console.log('\n2️⃣ Testing Line Items with Description');
  await testFormat({
    payment: {
      method: 'polygon-amoy',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Item',
        description: 'Test description'
      }
    ]
  });

  // Test 3: Different field name (amount instead of price)
  console.log('\n3️⃣ Testing "amount" instead of "price"');
  await testFormat({
    payment: {
      method: 'polygon-amoy',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        amount: '10.00',
        quantity: 1,
        name: 'Test Item'
      }
    ]
  });

  // Test 4: Different payment method
  console.log('\n4️⃣ Testing different payment method (eth)');
  await testFormat({
    payment: {
      method: 'ethereum',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Item'
      }
    ]
  });

  // Test 5: No payment method specified
  console.log('\n5️⃣ Testing without payment method');
  await testFormat({
    payment: {
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Item'
      }
    ]
  });

  // Test 6: Using "recipient" as string instead of object
  console.log('\n6️⃣ Testing recipient as string');
  await testFormat({
    payment: {
      method: 'polygon-amoy',
      currency: 'usdc',
      recipient: decodeWallet
    },
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Item'
      }
    ]
  });

  // Test 7: Completely minimal request
  console.log('\n7️⃣ Testing absolutely minimal request');
  await testFormat({
    lineItems: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Item'
      }
    ]
  });

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Format testing complete!');
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
      console.log('🎉 FOUND WORKING FORMAT:');
      console.log(JSON.stringify(requestBody, null, 2));
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
  testDifferentFormats().catch(console.error);
}

module.exports = { testDifferentFormats };