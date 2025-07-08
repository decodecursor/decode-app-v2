// Test Crossmint checkout URL generation
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

function testCheckoutURL() {
  console.log('=== Testing Crossmint Checkout URL Generation ===');
  
  const environment = process.env.CROSSMINT_ENVIRONMENT || 'staging';
  const projectId = process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID;
  const clientKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY;

  console.log('Environment:', environment);
  console.log('Project ID:', projectId);
  console.log('Client Key:', clientKey ? `${clientKey.substring(0, 15)}...` : 'MISSING');

  if (!projectId || !clientKey) {
    console.log('❌ Missing required client-side configuration');
    return;
  }

  // Generate checkout URL using Crossmint widget approach
  const baseUrl = environment === 'production' 
    ? 'https://crossmint.com'
    : 'https://staging.crossmint.com';

  // Method 1: Widget-style URL
  const widgetParams = new URLSearchParams({
    clientId: projectId,
    mintConfig: JSON.stringify({
      type: 'credit-card',
      totalPrice: '1.00',
      currency: 'USD',
      metadata: {
        service: 'beauty',
        platform: 'DECODE_Beauty',
        description: 'Beauty service payment'
      }
    })
  });

  const widgetUrl = `${baseUrl}/checkout?${widgetParams.toString()}`;
  
  console.log('\n=== Generated URLs ===');
  console.log('Widget URL:', widgetUrl);
  
  // Method 2: Direct payment link generation
  console.log('\n✅ Solution: Use Crossmint widget instead of API orders');
  console.log('1. Embed Crossmint checkout widget in your payment page');
  console.log('2. Widget will handle credit cards, crypto, Apple Pay automatically');
  console.log('3. No need for pre-created collections or complex API calls');
  
  return {
    widgetUrl,
    projectId,
    environment
  };
}

testCheckoutURL();