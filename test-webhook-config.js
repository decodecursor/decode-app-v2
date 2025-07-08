// Test webhook configuration
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function testWebhookSignature() {
  console.log('=== Testing Webhook Configuration ===');
  
  const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET;
  console.log('Has webhook secret:', !!webhookSecret);
  
  if (webhookSecret) {
    console.log('Webhook secret format:', webhookSecret.substring(0, 10) + '...');
    
    // Test signature verification
    const testPayload = JSON.stringify({
      type: 'order.succeeded',
      data: {
        id: 'test-order-123',
        status: 'succeeded',
        amount: 100,
        currency: 'USD'
      },
      timestamp: new Date().toISOString()
    });
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(testPayload)
      .digest('hex');
    
    console.log('Test payload signature:', `sha256=${expectedSignature}`);
    console.log('Webhook verification setup: ✅ READY');
  } else {
    console.log('❌ No webhook secret configured');
  }
  
  // Check webhook URL structure
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    console.log('App URL:', appUrl);
    console.log('Webhook endpoint:', `${appUrl}/api/webhooks/crossmint`);
  } else {
    console.log('⚠️ NEXT_PUBLIC_APP_URL not set - webhook URL may not work in production');
  }
}

testWebhookSignature();