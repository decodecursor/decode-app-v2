// TEST FILE - Crossmint Headless Checkout API Test
// This file tests the Crossmint API without affecting existing code

// Load environment variables manually from .env.local
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '.env.local');
const envData = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
const env = {};
envData.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key] = value;
  }
});

const API_KEY = env.NEXT_PUBLIC_CROSSMINT_API_KEY;
const ENVIRONMENT = env.CROSSMINT_ENVIRONMENT || 'staging';

console.log('🔧 Crossmint API Test Starting...');
console.log('Environment:', ENVIRONMENT);
console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 20)}...` : 'MISSING');

const CROSSMINT_BASE_URL = ENVIRONMENT === 'staging' 
  ? 'https://staging.crossmint.com' 
  : 'https://www.crossmint.com';

const API_ENDPOINT = `${CROSSMINT_BASE_URL}/api/2022-06-09/orders`;

console.log('API Endpoint:', API_ENDPOINT);

// Test API call function
async function testCrossmintAPI() {
  // Try NFT-style order format for custom services
  const testOrder = {
    payment: {
      method: "stripe-payment-element",
      currency: "usd"
    },
    lineItems: {
      collectionLocator: "crossmint:" + API_KEY.split('_')[2], // Use part of API key as collection ID
      callData: {
        totalPrice: "1.00",
        description: "Test Beauty Service",
        serviceProvider: "value@fromdecode.com"
      }
    },
    recipient: {
      email: "test@example.com"
    }
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY
  };

  console.log('\n📤 Sending test request...');
  console.log('Headers:', { ...headers, 'x-api-key': headers['x-api-key'] ? `${headers['x-api-key'].substring(0, 20)}...` : 'MISSING' });
  console.log('Body:', JSON.stringify(testOrder, null, 2));

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testOrder)
    });

    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (response.ok) {
      console.log('\n✅ API Test SUCCESSFUL!');
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('Parsed Response:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('Response is not JSON format');
      }
    } else {
      console.log('\n❌ API Test FAILED!');
      console.log('Error details:', responseText);
    }

  } catch (error) {
    console.log('\n❌ Network Error:');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
  }
}

// Run the test
testCrossmintAPI();