// Test Crossmint Payment Links API (alternative to orders)
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

async function testPaymentLinks() {
  console.log('=== Testing Crossmint Payment Links API ===');
  
  const environment = process.env.CROSSMINT_ENVIRONMENT || 'staging';
  const apiKey = process.env.CROSSMINT_API_KEY;
  const baseUrl = environment === 'production' 
    ? 'https://www.crossmint.com/api/2022-06-09'
    : 'https://staging.crossmint.com/api/2022-06-09';

  console.log('Environment:', environment);
  console.log('Base URL:', baseUrl);

  // Test 1: Try to create a payment link (simpler than orders)
  const paymentLink = {
    paymentMethod: 'polygon',
    currency: 'USDC',
    amount: '1.00',
    recipientEmail: 'payments@decode-beauty.com',
    metadata: {
      service: 'beauty',
      platform: 'DECODE_Beauty',
      description: 'Beauty service payment',
      paymentLinkId: 'test-payment-123'
    }
  };

  try {
    console.log('\n--- Testing Payment Link Creation ---');
    const response = await fetch(`${baseUrl}/payment-links`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'DECODE-Beauty-Platform/1.0'
      },
      body: JSON.stringify(paymentLink)
    });

    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ SUCCESS: Payment link created!');
      console.log('Payment URL:', data.url);
    } else {
      console.log('❌ Payment link failed');
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }

  // Test 2: Try to check available endpoints
  try {
    console.log('\n--- Testing API Endpoints ---');
    const endpoints = ['/collections', '/payment-methods', '/checkout-sessions'];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'DECODE-Beauty-Platform/1.0'
        }
      });
      
      console.log(`${endpoint}: ${response.status}`);
      if (response.status === 200) {
        const data = await response.json();
        console.log(`  Data: ${JSON.stringify(data).substring(0, 100)}...`);
      }
    }
  } catch (error) {
    console.log('❌ Endpoint test error:', error.message);
  }
}

testPaymentLinks();