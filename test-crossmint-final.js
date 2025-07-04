#!/usr/bin/env node

// Final attempt to fix Crossmint API format
// Trying additional required fields and variations

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

async function testFinalAttempts() {
  console.log('🎯 Final Attempts to Fix Crossmint API\n');
  console.log('=' .repeat(60));

  const apiKey = process.env.CROSSMINT_API_KEY;
  const decodeWallet = process.env.DECODE_WALLET_ADDRESS;
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  console.log('');

  // Test 1: Try with totalAmount field
  console.log('1️⃣ Testing with totalAmount field');
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
    ],
    totalAmount: '10.00'
  });

  // Test 2: Try with different case (line_items)
  console.log('\n2️⃣ Testing with line_items (snake_case)');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    line_items: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service'
      }
    ]
  });

  // Test 3: Try with items instead of lineItems
  console.log('\n3️⃣ Testing with "items" field');
  await testFormat({
    payment: {
      method: 'solana',
      currency: 'usdc',
      recipient: {
        walletAddress: decodeWallet
      }
    },
    items: [
      {
        price: '10.00',
        quantity: 1,
        name: 'Test Beauty Service'
      }
    ]
  });

  // Test 4: Try minimal GET request to see what endpoints exist
  console.log('\n4️⃣ Testing GET request to see available endpoints');
  await testGet('https://staging.crossmint.com/api/2022-06-09');

  // Test 5: Try POST without any body to see what error we get
  console.log('\n5️⃣ Testing empty POST to see required fields');
  await testFormat({});

  // Test 6: See if there's a different orders endpoint
  console.log('\n6️⃣ Testing GET on orders endpoint');
  await testGet('https://staging.crossmint.com/api/2022-06-09/orders');

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Final testing complete!');
  console.log('\n💡 If none of these work, the issue might be:');
  console.log('   1. API key permissions');
  console.log('   2. Staging environment limitations');
  console.log('   3. Different API version needed');
  console.log('   4. Account configuration issue');
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
      console.log('✅ SUCCESS! Found working format!');
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

async function testGet(url) {
  try {
    console.log(`📤 GET: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'X-API-Key': process.env.CROSSMINT_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log(`📥 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('💥 Network error:', error.message);
  }
}

if (require.main === module) {
  testFinalAttempts().catch(console.error);
}

module.exports = { testFinalAttempts };