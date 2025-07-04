// Test script for Crossmint wallet creation
// Run with: node test-wallet-creation.js

require('dotenv').config({ path: '.env.local' });

const { crossmintService } = require('./lib/crossmint.ts');
const { crossmintDB } = require('./lib/crossmint-db.ts');
const { walletCreationService } = require('./lib/wallet-creation.ts');

async function testCrossmintConnection() {
  console.log('🔄 Testing Crossmint API connection...\n');
  
  try {
    // Test environment info
    const envInfo = crossmintService.getEnvironmentInfo();
    console.log('📋 Environment Configuration:');
    console.log(`  - Environment: ${envInfo.environment}`);
    console.log(`  - Base URL: ${envInfo.baseUrl}`);
    console.log(`  - Has API Key: ${envInfo.hasApiKey}`);
    console.log(`  - Has Webhook Secret: ${envInfo.hasWebhookSecret}`);
    console.log(`  - Has DECODE Wallet: ${envInfo.hasDecodeWallet}`);
    console.log('');

    // Test API connectivity
    console.log('🔄 Testing API connectivity...');
    const healthCheck = await crossmintService.healthCheck();
    
    if (healthCheck.status === 'ok') {
      console.log('✅ Crossmint API connection successful!\n');
    } else {
      console.log('❌ Crossmint API connection failed:');
      console.log(healthCheck.details);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

async function testWalletCreation() {
  console.log('🔄 Testing wallet creation...\n');
  
  try {
    // Test with a dummy email
    const testEmail = `test-${Date.now()}@decode.beauty`;
    
    console.log(`📧 Creating wallet for test email: ${testEmail}`);
    
    const wallet = await crossmintService.createWallet(testEmail);
    
    console.log('✅ Wallet created successfully:');
    console.log(`  - Wallet ID: ${wallet.id}`);
    console.log(`  - Wallet Address: ${wallet.address}`);
    console.log(`  - Linked User: ${wallet.linkedUser}`);
    console.log('');

    // Test getting the wallet back
    console.log('🔄 Testing wallet retrieval...');
    const retrievedWallet = await crossmintService.getWallet(wallet.id);
    
    if (retrievedWallet.address === wallet.address) {
      console.log('✅ Wallet retrieval successful!\n');
    } else {
      console.log('❌ Wallet retrieval mismatch\n');
    }

    return wallet;
  } catch (error) {
    console.error('❌ Wallet creation test failed:', error.message);
    return null;
  }
}

async function testFeeCalculation() {
  console.log('🔄 Testing marketplace fee calculation...\n');
  
  const { calculateMarketplaceFee } = require('./types/crossmint.ts');
  
  const testAmounts = [100, 250, 500, 1000];
  
  testAmounts.forEach(amount => {
    const calculation = calculateMarketplaceFee(amount);
    console.log(`💰 AED ${amount}:`);
    console.log(`  - Original: AED ${calculation.originalAmount}`);
    console.log(`  - Fee (11%): AED ${calculation.feeAmount}`);
    console.log(`  - Total: AED ${calculation.totalAmount}`);
    console.log('');
  });
}

async function testDatabaseConnection() {
  console.log('🔄 Testing database connection...\n');
  
  try {
    // Test database query
    const { supabase } = require('./lib/supabase.ts');
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('✅ Database connection successful!\n');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 DECODE Crossmint Integration Tests\n');
  console.log('=' .repeat(50));
  console.log('');

  // Test 1: Environment and connection
  const connectionOk = await testCrossmintConnection();
  if (!connectionOk) {
    console.log('❌ Stopping tests due to connection failure');
    return;
  }

  // Test 2: Database connection
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log('❌ Stopping tests due to database failure');
    return;
  }

  // Test 3: Fee calculation
  testFeeCalculation();

  // Test 4: Wallet creation (only if API is working)
  if (process.env.CROSSMINT_API_KEY) {
    await testWalletCreation();
  } else {
    console.log('⚠️  Skipping wallet creation test - no API key provided\n');
  }

  console.log('=' .repeat(50));
  console.log('🎉 Tests completed!\n');
  
  console.log('Next steps:');
  console.log('1. Set up your Crossmint staging API key');
  console.log('2. Run the database migration: node setup-crossmint-database.js setup');
  console.log('3. Test wallet creation in the signup flow');
  console.log('4. Implement headless checkout UI');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testCrossmintConnection,
  testWalletCreation,
  testFeeCalculation,
  testDatabaseConnection,
  runAllTests
};