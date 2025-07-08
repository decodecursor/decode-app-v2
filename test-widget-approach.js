// Test the new widget-based checkout approach
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

async function testWidgetApproach() {
  console.log('=== Testing Widget-Based Checkout ===');
  
  // Simulate the create-session API call
  const testPayload = {
    paymentLinkId: 'test-payment-123',
    clientEmail: 'customer@example.com',
    currency: 'USD'
  };

  try {
    const response = await fetch('http://localhost:3000/api/payment/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      console.log('❌ Server not running or API error');
      console.log('Status:', response.status);
      return;
    }

    const data = await response.json();
    console.log('📊 API Response:', JSON.stringify(data, null, 2));

    if (data.success && data.checkoutUrl) {
      console.log('✅ SUCCESS: Widget checkout URL generated!');
      console.log('🔗 Checkout URL:', data.checkoutUrl);
      console.log('💡 This URL will show:');
      console.log('  - Credit card payments');
      console.log('  - Apple Pay / Google Pay');
      console.log('  - Crypto wallet connections');
      console.log('  - All handled automatically by Crossmint');
    } else {
      console.log('❌ Widget generation failed');
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
    console.log('Make sure the development server is running with: npm run dev');
  }

  // Also test the configuration
  console.log('\n=== Configuration Check ===');
  const projectId = process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID;
  const environment = process.env.CROSSMINT_ENVIRONMENT;
  
  console.log('Project ID:', projectId ? '✅ Configured' : '❌ Missing');
  console.log('Environment:', environment);
  console.log('Widget will work:', projectId ? '✅ Yes' : '❌ No - missing project ID');
}

testWidgetApproach();