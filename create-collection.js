// Create DECODE Beauty Service Collection
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.join(__dirname, '.env.local');
const envData = fs.readFileSync(envPath, 'utf8');
const env = {};
envData.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key] = value;
  }
});

const API_KEY = env.NEXT_PUBLIC_CROSSMINT_API_KEY;
const ENVIRONMENT = env.CROSSMINT_ENVIRONMENT || 'staging';

console.log('🔧 Creating DECODE Beauty Service Collection...');
console.log('Environment:', ENVIRONMENT);
console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 20)}...` : 'MISSING');

const COLLECTION_API_URL = ENVIRONMENT === 'staging' 
  ? 'https://staging.crossmint.com/api/v1-alpha1/collections'
  : 'https://www.crossmint.com/api/v1-alpha1/collections';

async function createCollection() {
  const collectionData = {
    chain: "ethereum",
    contractType: "erc-721",
    metadata: {
      title: "DECODE Beauty Services",
      description: "Professional beauty and wellness services marketplace - hair, makeup, skincare, and wellness treatments",
      imageUrl: "https://decode-app-v2.vercel.app/logo.png"
    },
    category: "other",
    scopes: ["payments:cross-chain", "payments:credit-card"]
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY
  };

  console.log('\n📤 Creating collection...');
  console.log('URL:', COLLECTION_API_URL);
  console.log('Headers:', { ...headers, 'X-API-KEY': headers['X-API-KEY'] ? `${headers['X-API-KEY'].substring(0, 20)}...` : 'MISSING' });
  console.log('Body:', JSON.stringify(collectionData, null, 2));

  try {
    const response = await fetch(COLLECTION_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(collectionData)
    });

    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (response.ok) {
      console.log('\n✅ Collection Created Successfully!');
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('Collection ID:', jsonResponse.id || jsonResponse.collectionId);
        console.log('\n🔗 Add this to your .env.local:');
        console.log(`CROSSMINT_COLLECTION_ID=${jsonResponse.id || jsonResponse.collectionId}`);
      } catch (e) {
        console.log('Response is not JSON format');
      }
    } else {
      console.log('\n❌ Collection Creation Failed!');
      console.log('Error details:', responseText);
    }

  } catch (error) {
    console.log('\n❌ Network Error:');
    console.log('Error:', error.message);
  }
}

createCollection();