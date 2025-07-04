#!/usr/bin/env node

// Test Crossmint API Connection
// This script tests the basic connectivity and configuration

// Load environment variables manually
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });
}

const { crossmintService } = require('./lib/crossmint');

async function testCrossmintConnection() {
  console.log('🔧 Testing Crossmint API Connection...\n');

  try {
    // Test 1: Environment Configuration
    console.log('1️⃣ Testing Environment Configuration:');
    const envInfo = crossmintService.getEnvironmentInfo();
    console.log('   Environment:', envInfo.environment);
    console.log('   Base URL:', envInfo.baseUrl);
    console.log('   Has API Key:', envInfo.hasApiKey);
    console.log('   Has Webhook Secret:', envInfo.hasWebhookSecret);
    console.log('   Has DECODE Wallet:', envInfo.hasDecodeWallet);
    
    if (!envInfo.hasApiKey) {
      throw new Error('❌ CROSSMINT_API_KEY not configured');
    }
    if (!envInfo.hasWebhookSecret) {
      throw new Error('❌ CROSSMINT_WEBHOOK_SECRET not configured');
    }
    if (!envInfo.hasDecodeWallet) {
      throw new Error('❌ DECODE_WALLET_ADDRESS not configured');
    }
    
    console.log('   ✅ Environment configuration looks good!\n');

    // Test 2: API Health Check
    console.log('2️⃣ Testing API Connectivity:');
    const healthCheck = await crossmintService.healthCheck();
    
    if (healthCheck.status === 'ok') {
      console.log('   ✅ Crossmint API is accessible');
      console.log('   📊 Connection details:', healthCheck.details);
    } else {
      console.log('   ❌ Crossmint API health check failed');
      console.log('   🔍 Error details:', healthCheck.details);
      throw new Error('API health check failed');
    }

    console.log('\n🎉 Crossmint connection test completed successfully!');
    console.log('✅ Ready to test wallet creation and checkout functionality');

  } catch (error) {
    console.error('\n❌ Crossmint connection test failed:');
    console.error('🔍 Error:', error.message);
    
    if (error.details) {
      console.error('📋 Details:', error.details);
    }
    
    console.log('\n🛠️ Troubleshooting:');
    console.log('1. Check environment variables in .env.local');
    console.log('2. Verify Crossmint API keys are correct');
    console.log('3. Ensure staging environment is accessible');
    
    process.exit(1);
  }
}

// Run the test
testCrossmintConnection();