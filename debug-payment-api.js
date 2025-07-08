// Debug the exact payment API error
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

async function debugPaymentAPI() {
  console.log('=== Debugging Payment API ===');
  
  const environment = process.env.CROSSMINT_ENVIRONMENT || 'staging';
  const apiKey = process.env.CROSSMINT_API_KEY;
  const baseUrl = environment === 'production' 
    ? 'https://www.crossmint.com/api/2022-06-09'
    : 'https://staging.crossmint.com/api/2022-06-09';

  console.log('Environment:', environment);
  console.log('Base URL:', baseUrl);
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING');

  // Try different product locator formats based on Crossmint docs
  const formats = [
    // Format 1: Basic lineItems with product info
    {
      name: "Basic LineItems",
      order: {
        payment: {
          method: 'polygon',
          currency: 'usdc'
        },
        lineItems: [
          {
            productLocator: 'https://decode-beauty.com/products/beauty-service',
            price: '1.00',
            currency: 'USD'
          }
        ],
        recipient: {
          email: 'payments@decode-beauty.com'
        }
      }
    },
    // Format 2: Custom product format
    {
      name: "Custom Product",
      order: {
        payment: {
          method: 'polygon',
          currency: 'usdc'
        },
        lineItems: [
          {
            productLocator: 'custom:beauty-service-payment',
            price: '1.00',
            currency: 'USD',
            metadata: {
              name: 'Beauty Service Payment',
              description: 'DECODE Beauty Platform Service'
            }
          }
        ],
        recipient: {
          email: 'payments@decode-beauty.com'
        }
      }
    },
    // Format 3: Shopify format with variant (as required by API)
    {
      name: "Shopify Format",
      order: {
        payment: {
          method: 'polygon',
          currency: 'usdc'
        },
        lineItems: [
          {
            productLocator: 'shopify:https://decode-beauty.myshopify.com/products/beauty-service:12345',
            price: '1.00',
            currency: 'USD'
          }
        ],
        recipient: {
          email: 'payments@decode-beauty.com'
        }
      }
    },
    // Format 4: Try creating custom payment (direct amount)
    {
      name: "Direct Payment",
      order: {
        payment: {
          method: 'polygon',
          currency: 'usdc',
          amount: '1.00'
        },
        recipient: {
          email: 'payments@decode-beauty.com'
        },
        metadata: {
          service: 'beauty',
          platform: 'DECODE_Beauty',
          description: 'Beauty service payment'
        }
      }
    }
  ];

  for (const format of formats) {
    console.log(`\n--- Testing: ${format.name} ---`);
    
    try {
      const response = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'DECODE-Beauty-Platform/1.0'
        },
        body: JSON.stringify(format.order)
      });

      const data = await response.json();
      
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));

      if (response.ok) {
        console.log('✅ SUCCESS: This format works!');
        console.log('Order ID:', data.id);
        break; // Stop testing if we find a working format
      } else {
        console.log('❌ Failed with this format');
      }

    } catch (error) {
      console.log('❌ Network error:', error.message);
    }
  }
}

debugPaymentAPI();