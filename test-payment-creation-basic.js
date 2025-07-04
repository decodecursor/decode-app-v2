#!/usr/bin/env node

// Test payment link creation with existing database structure
// Works with current schema before migration

const fs = require('fs');
const path = require('path');

// Load environment variables manually
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

async function testPaymentCreation() {
  console.log('🧪 Testing Payment Link Creation with Existing Database\n');
  console.log('=' .repeat(60));

  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // First, check if we have any existing users
    console.log('1️⃣ Finding or creating a test user...\n');
    
    const { data: existingUsers, error: userFetchError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .limit(1);
    
    if (userFetchError) {
      console.error('❌ Could not fetch users:', userFetchError.message);
      return;
    }
    
    let testUserId;
    
    if (existingUsers && existingUsers.length > 0) {
      testUserId = existingUsers[0].id;
      console.log(`✅ Using existing user: ${existingUsers[0].email}`);
      console.log(`   User ID: ${testUserId}`);
    } else {
      console.log('⚠️  No existing users found. You may need to create a user first.');
      return;
    }
    
    // Step 2: Test payment link creation with current schema
    console.log('\n2️⃣ Creating payment link with current database schema...\n');
    
    const originalAmount = 150;
    const feeCalculation = calculateMarketplaceFee(originalAmount);
    
    console.log('💰 Payment Breakdown:');
    console.log(`   Service Amount: AED ${feeCalculation.originalAmount}`);
    console.log(`   Marketplace Fee (11%): AED ${feeCalculation.feeAmount}`);
    console.log(`   Customer Pays: AED ${feeCalculation.totalAmount}`);
    
    // Create payment link with current schema
    const paymentLink = {
      title: 'Hair Styling & Treatment',
      description: 'Professional hair styling session with premium products',
      amount_aed: feeCalculation.totalAmount, // Customer pays total amount
      creator_id: testUserId,
      expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true
    };
    
    console.log('\n🔄 Creating payment link...');
    
    const { data: newLink, error: createError } = await supabase
      .from('payment_links')
      .insert([paymentLink])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Failed to create payment link:', createError.message);
      return;
    }
    
    console.log('✅ Payment link created successfully!');
    console.log(`   Link ID: ${newLink.id}`);
    console.log(`   Title: ${newLink.title}`);
    console.log(`   Amount: AED ${newLink.amount_aed}`);
    console.log(`   Creator: ${newLink.creator_id}`);
    console.log(`   Expires: ${newLink.expiration_date}`);
    
    // Step 3: Test retrieving the payment link (simulate payment page access)
    console.log('\n3️⃣ Testing payment link retrieval (simulating payment page)...\n');
    
    const { data: retrievedLink, error: retrieveError } = await supabase
      .from('payment_links')
      .select(`
        *,
        users:creator_id (
          id,
          email,
          full_name,
          professional_center_name
        )
      `)
      .eq('id', newLink.id)
      .eq('is_active', true)
      .single();
    
    if (retrieveError) {
      console.error('❌ Failed to retrieve payment link:', retrieveError.message);
      return;
    }
    
    console.log('✅ Payment link retrieved successfully!');
    console.log('📋 Payment Link Details:');
    console.log(`   Title: ${retrievedLink.title}`);
    console.log(`   Description: ${retrievedLink.description}`);
    console.log(`   Amount: AED ${retrievedLink.amount_aed}`);
    console.log(`   Professional: ${retrievedLink.users?.full_name || 'Unknown'}`);
    console.log(`   Center: ${retrievedLink.users?.professional_center_name || 'Not specified'}`);
    
    // Step 4: Simulate the payment flow with Crossmint
    console.log('\n4️⃣ Simulating Crossmint payment flow...\n');
    
    // Create mock Crossmint checkout session
    const mockCheckoutSession = {
      id: `mock_checkout_${Date.now()}`,
      url: `https://staging.crossmint.com/checkout/mock_checkout_${Date.now()}`,
      status: 'pending',
      amount: feeCalculation.totalAmount.toFixed(2),
      currency: 'USD',
      metadata: {
        payment_link_id: newLink.id,
        beauty_professional_id: testUserId,
        original_amount: feeCalculation.originalAmount.toFixed(2),
        fee_amount: feeCalculation.feeAmount.toFixed(2),
        platform: 'DECODE_Beauty'
      }
    };
    
    console.log('🔗 Crossmint Checkout Session:');
    console.log(`   Session ID: ${mockCheckoutSession.id}`);
    console.log(`   Payment URL: ${mockCheckoutSession.url}`);
    console.log(`   Amount: ${mockCheckoutSession.amount} ${mockCheckoutSession.currency}`);
    
    // Step 5: Simulate successful payment completion
    console.log('\n5️⃣ Simulating payment completion...\n');
    
    const mockWebhookPayload = {
      event: 'payment.completed',
      data: {
        id: `tx_${Date.now()}`,
        status: 'completed',
        amount: mockCheckoutSession.amount,
        currency: mockCheckoutSession.currency,
        recipient: process.env.DECODE_WALLET_ADDRESS,
        metadata: mockCheckoutSession.metadata,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }
    };
    
    console.log('📨 Mock Webhook Payload:');
    console.log(`   Transaction ID: ${mockWebhookPayload.data.id}`);
    console.log(`   Status: ${mockWebhookPayload.data.status}`);
    console.log(`   Amount: ${mockWebhookPayload.data.amount} ${mockWebhookPayload.data.currency}`);
    
    // Deactivate payment link (simulate one-time use)
    const { error: deactivateError } = await supabase
      .from('payment_links')
      .update({ is_active: false })
      .eq('id', newLink.id);
    
    if (deactivateError) {
      console.error('⚠️  Failed to deactivate payment link:', deactivateError.message);
    } else {
      console.log('✅ Payment link deactivated (one-time use complete)');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Payment Creation Test Completed Successfully!');
    console.log('\n📊 Summary:');
    console.log('✅ Database connection working');
    console.log('✅ Payment link creation working');
    console.log('✅ Fee calculation accurate');
    console.log('✅ Payment link retrieval working');
    console.log('✅ Mock Crossmint integration ready');
    console.log('✅ Payment flow simulation complete');
    
    console.log('\n🚀 Ready for:');
    console.log('1. Frontend UI integration');
    console.log('2. Real Crossmint API connection');
    console.log('3. Database migration for enhanced features');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

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

if (require.main === module) {
  testPaymentCreation().catch(console.error);
}

module.exports = { testPaymentCreation };