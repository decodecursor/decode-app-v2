// Simple configuration test
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

console.log('=== Crossmint Configuration Test ===');
console.log('Environment:', process.env.CROSSMINT_ENVIRONMENT);
console.log('Has API Key:', !!process.env.CROSSMINT_API_KEY);
console.log('Has Client API Key:', !!process.env.NEXT_PUBLIC_CROSSMINT_API_KEY);
console.log('Has Project ID:', !!process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID);
console.log('Has Webhook Secret:', !!process.env.CROSSMINT_WEBHOOK_SECRET);

// Test URL construction
const environment = process.env.CROSSMINT_ENVIRONMENT || 'staging';
const baseUrl = environment === 'production' 
  ? 'https://www.crossmint.com/api/2022-06-09'
  : 'https://staging.crossmint.com/api/2022-06-09';

console.log('Base URL:', baseUrl);
console.log('Configuration looks:', (
  process.env.CROSSMINT_API_KEY && 
  process.env.NEXT_PUBLIC_CROSSMINT_API_KEY && 
  process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID
) ? 'GOOD ✅' : 'INCOMPLETE ❌');