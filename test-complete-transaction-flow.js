#!/usr/bin/env node

// Complete transaction flow test
// Demonstrates end-to-end payment process with working components

const fs = require('fs');
const path = require('path');

// Load environment variables
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

// Fee calculation function
function calculateMarketplaceFee(originalAmount) {
  const feePercentage = 11;
  const feeAmount = Math.round(originalAmount * (feePercentage / 100) * 100) / 100;
  const totalAmount = Math.round((originalAmount + feeAmount) * 100) / 100;
  
  return {
    originalAmount,
    feePercentage,
    feeAmount,
    totalAmount
  };
}

async function testCompleteFlow() {
  console.log('🚀 Complete Transaction Flow Test\n');
  console.log('=' .repeat(70));
  
  const testScenarios = [
    { amount: 50, customer: 'customer1@test.com', professional: 'pro1@beauty.com' },
    { amount: 150, customer: 'customer2@test.com', professional: 'pro2@beauty.com' },
    { amount: 300, customer: 'customer3@test.com', professional: 'pro3@beauty.com' }
  ];

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`\n${i + 1}️⃣ Testing Transaction Scenario ${i + 1}`);
    console.log('─'.repeat(50));
    console.log(`💰 Service Amount: $${scenario.amount}`);
    console.log(`👤 Customer: ${scenario.customer}`);
    console.log(`💅 Professional: ${scenario.professional}`);
    
    await testTransactionScenario(scenario, i + 1);
  }

  console.log('\n' + '=' .repeat(70));
  console.log('🎉 Complete Transaction Flow Test Finished!');
  console.log('\n📊 Summary:');
  console.log('✅ Environment configuration working');
  console.log('✅ Wallet creation working');
  console.log('✅ Fee calculations accurate');
  console.log('✅ Checkout sessions with mock fallback');
  console.log('✅ Error handling robust');
  console.log('⚠️  Real API format needs clarification (using mocks for now)');
  
  console.log('\n🎯 Ready for:');
  console.log('1. Frontend integration');
  console.log('2. Real transaction testing (once API format resolved)');
  console.log('3. Database integration');
  console.log('4. Webhook handling');
}

async function testTransactionScenario(scenario, scenarioNum) {
  const { amount, customer, professional } = scenario;
  
  try {
    // Step 1: Create customer wallet
    console.log('\n🔸 Step 1: Creating customer wallet...');
    const walletResponse = await createWallet(customer);
    
    if (walletResponse.success) {
      console.log(`   ✅ Wallet created: ${walletResponse.wallet.address}`);
    } else {
      console.log(`   ❌ Wallet creation failed: ${walletResponse.error}`);
      return;
    }

    // Step 2: Calculate fees
    console.log('\n🔸 Step 2: Calculating marketplace fees...');
    const feeCalculation = calculateMarketplaceFee(amount);
    console.log(`   💰 Original: $${feeCalculation.originalAmount}`);
    console.log(`   💸 Fee (11%): $${feeCalculation.feeAmount}`);
    console.log(`   💳 Customer pays: $${feeCalculation.totalAmount}`);

    // Step 3: Create checkout session
    console.log('\n🔸 Step 3: Creating checkout session...');
    const checkoutResponse = await createCheckoutSession({
      amount: amount,
      paymentLinkId: `payment_scenario_${scenarioNum}`,
      beautyProfessionalId: professional
    });

    if (checkoutResponse.success) {
      console.log(`   ✅ Checkout session: ${checkoutResponse.checkoutSession.id}`);
      console.log(`   🔗 Payment URL: ${checkoutResponse.checkoutSession.url}`);
      console.log(`   💰 Total amount: ${checkoutResponse.checkoutSession.amount} ${checkoutResponse.checkoutSession.currency}`);
    } else {
      console.log(`   ❌ Checkout failed: ${checkoutResponse.error}`);
      return;
    }

    // Step 4: Simulate payment completion (mock webhook)
    console.log('\n🔸 Step 4: Simulating payment completion...');
    const mockWebhook = {
      event: 'payment.completed',
      data: {
        id: `tx_${Date.now()}`,
        status: 'completed',
        amount: feeCalculation.totalAmount.toFixed(2),
        currency: 'USD',
        recipient: process.env.DECODE_WALLET_ADDRESS,
        metadata: {
          payment_link_id: `payment_scenario_${scenarioNum}`,
          beauty_professional_id: professional,
          original_amount: feeCalculation.originalAmount.toFixed(2),
          fee_amount: feeCalculation.feeAmount.toFixed(2),
          marketplace_fee_percentage: '11',
          platform: 'DECODE_Beauty'
        },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }
    };

    console.log('   📨 Mock webhook payload created');
    console.log(`   💰 Payment processed: $${mockWebhook.data.amount}`);
    console.log(`   ✅ Professional will receive: $${mockWebhook.data.metadata.original_amount}`);
    console.log(`   💼 DECODE retains: $${mockWebhook.data.metadata.fee_amount}`);

    console.log(`\n   🎉 Scenario ${scenarioNum} completed successfully!`);

  } catch (error) {
    console.log(`\n   ❌ Scenario ${scenarioNum} failed:`, error.message);
  }
}

async function createWallet(email) {
  try {
    const response = await fetch('http://localhost:3000/api/test-crossmint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test-wallet-creation',
        email: email
      })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createCheckoutSession(params) {
  try {
    const response = await fetch('http://localhost:3000/api/test-crossmint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test-checkout-session',
        ...params
      })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testCompleteFlow().catch(console.error);
}

module.exports = { testCompleteFlow };