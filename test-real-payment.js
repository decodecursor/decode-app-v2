// Test real Crossmint API call
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

async function testCrossmintAPI() {
  console.log('=== Testing Crossmint API Call ===');
  
  const environment = process.env.CROSSMINT_ENVIRONMENT || 'staging';
  const apiKey = process.env.CROSSMINT_API_KEY;
  const baseUrl = environment === 'production' 
    ? 'https://www.crossmint.com/api/2022-06-09'
    : 'https://staging.crossmint.com/api/2022-06-09';

  console.log('Environment:', environment);
  console.log('Base URL:', baseUrl);
  console.log('Using API Key:', apiKey.substring(0, 20) + '...');

  // Test creating a checkout session (small amount)
  const testOrder = {
    type: 'donation',
    amount: '1.00',
    currency: 'usd',
    payment: {
      method: 'polygon',
      currency: 'usdc'
    },
    recipient: {
      email: 'payments@decode-beauty.com'
    },
    metadata: {
      service: 'beauty',
      original_amount: '0.90',
      fee_amount: '0.10',
      beauty_professional_id: 'test-professional',
      payment_link_id: 'test-payment-link',
      platform: 'DECODE_Beauty',
      description: 'Test Beauty service payment',
      test_mode: true
    }
  };

  try {
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'DECODE-Beauty-Platform/1.0'
      },
      body: JSON.stringify(testOrder)
    });

    const data = await response.json();
    
    console.log('\n=== API Response ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS: Crossmint API is working!');
      console.log('Order ID:', data.id);
      console.log('Order URL:', data.url || 'Not provided');
    } else {
      console.log('\n❌ ERROR: API call failed');
      console.log('Error code:', data.code || 'Unknown');
      console.log('Error message:', data.message || data.error || 'Unknown error');
    }

  } catch (error) {
    console.log('\n❌ NETWORK ERROR:', error.message);
  }
}

testCrossmintAPI();