// Simple test to create the missing payment link
const fs = require('fs');

// Load environment variables manually
function loadEnv() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  } catch (error) {
    console.error('Could not load .env.local:', error.message);
  }
}

loadEnv();

console.log('🔧 Payment Link Creation Test');
console.log('📋 Environment Variables Check:');
console.log('- Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('- Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
console.log('- Supabase Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
console.log('- Crossmint Project ID:', process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID);
console.log('- Crossmint API Key:', process.env.NEXT_PUBLIC_CROSSMINT_API_KEY ? '✅ Set' : '❌ Missing');
console.log('');

// Manual SQL for the payment link
const paymentLinkData = {
  id: '93ddfdd7-a3eb-46fc-97ac-ee57da861e50',
  creator_id: 'manual-creator-id',
  title: 'Beauty Professional Service',
  description: 'Professional beauty service payment - value@fromdecode.com',
  amount_usd: 180.00,
  currency: 'USD',
  is_active: true,
  expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

console.log('💳 Payment Link Data to Insert:');
console.log(JSON.stringify(paymentLinkData, null, 2));
console.log('');
console.log('📝 Manual SQL Insert Statement:');
console.log(`INSERT INTO payment_links (
  id, creator_id, title, description, amount_usd, currency, 
  is_active, expiration_date, created_at, updated_at
) VALUES (
  '${paymentLinkData.id}',
  '${paymentLinkData.creator_id}',
  '${paymentLinkData.title}',
  '${paymentLinkData.description}',
  ${paymentLinkData.amount_usd},
  '${paymentLinkData.currency}',
  ${paymentLinkData.is_active},
  '${paymentLinkData.expiration_date}',
  '${paymentLinkData.created_at}',
  '${paymentLinkData.updated_at}'
);`);

console.log('');
console.log('🔗 Expected Result: https://decode-app-v2.vercel.app/pay/93ddfdd7-a3eb-46fc-97ac-ee57da861e50');