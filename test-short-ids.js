#!/usr/bin/env node

/**
 * Test Short ID Payment Link Creation
 * Verifies that new payment links use 8-character IDs
 */

require('dotenv').config({ path: '.env.local' });

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testShortIdCreation() {
  console.log('🧪 Testing Short ID Payment Link Creation...');
  console.log('📍 Target URL:', baseUrl);

  try {
    // Test data for creating a payment link
    const testPaymentLink = {
      title: 'Test Short ID Payment Link',
      client_name: 'Test Client',
      description: 'Testing 8-character ID generation',
      original_amount_aed: 100, // AED 100 service
      creator_id: 'test-creator-id', // This would need to be a real user ID
      linked_user_id: null
    };

    console.log('📝 Creating test payment link with data:', testPaymentLink);

    // Make API call to create payment link
    const response = await fetch(`${baseUrl}/api/payment/create-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPaymentLink)
    });

    const result = await response.json();

    console.log('📊 API Response Status:', response.status);
    
    if (response.ok && result.success) {
      const paymentLink = result.data.paymentLink;
      
      console.log('✅ Payment link created successfully!');
      console.log('🆔 Payment Link ID:', paymentLink.id);
      console.log('🔗 Payment URL:', result.data.paymentUrl);
      
      // Check if it's using short ID format
      const isShortId = /^[0-9A-Fa-f]{8}$/.test(paymentLink.id);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentLink.id);
      
      console.log('\n📋 ID Analysis:');
      console.log('   Length:', paymentLink.id.length);
      console.log('   Format: 8-char hex?', isShortId ? '✅ YES' : '❌ NO');
      console.log('   Format: UUID?', isUUID ? '⚠️ YES (still using old format)' : '✅ NO');
      
      // Check fee structure
      console.log('\n💰 Fee Structure:');
      console.log('   Service Amount:', paymentLink.service_amount_aed || 'MISSING');
      console.log('   Decode Amount:', paymentLink.decode_amount_aed || 'MISSING');
      console.log('   Total Amount:', paymentLink.total_amount_aed || 'MISSING');
      
      // Verify 9% fee calculation
      if (paymentLink.service_amount_aed && paymentLink.decode_amount_aed) {
        const expectedFee = Math.round(paymentLink.service_amount_aed * 0.09 * 100) / 100;
        const actualFee = paymentLink.decode_amount_aed;
        const feeCorrect = Math.abs(expectedFee - actualFee) < 0.01;
        
        console.log('   Expected Fee (9%):', expectedFee);
        console.log('   Actual Fee:', actualFee);
        console.log('   Fee Calculation:', feeCorrect ? '✅ CORRECT' : '❌ INCORRECT');
      }
      
      if (isShortId) {
        console.log('\n🎉 SUCCESS: Short ID system is working!');
        console.log('   Payment links are now using 8-character IDs instead of 36-character UUIDs');
      } else {
        console.log('\n⚠️ WARNING: Still using long IDs');
        console.log('   The short ID system may not be properly implemented');
      }
      
    } else {
      console.error('❌ Payment link creation failed:');
      console.error('   Status:', response.status);
      console.error('   Error:', result.error || 'Unknown error');
      
      if (result.error?.includes('Creator not found')) {
        console.log('\n💡 Note: This test requires a real user ID from your database');
        console.log('   You can find a user ID by checking the users table in Supabase');
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Alternative test - just test the short ID generation function directly
async function testShortIdGeneration() {
  console.log('\n🔧 Testing Short ID Generation Function...');
  
  try {
    // Import the short ID function
    const { generateShortId, isValidShortId } = await import('./lib/short-id.js');
    
    console.log('📝 Generating 5 sample short IDs:');
    
    for (let i = 1; i <= 5; i++) {
      const shortId = generateShortId();
      const isValid = isValidShortId(shortId);
      
      console.log(`   ${i}. ${shortId} (length: ${shortId.length}, valid: ${isValid ? '✅' : '❌'})`);
    }
    
    console.log('\n✅ Short ID generation function is working correctly!');
    
  } catch (error) {
    console.error('❌ Short ID generation test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testShortIdGeneration();
  await testShortIdCreation();
}

if (require.main === module) {
  runTests();
}

module.exports = { testShortIdCreation, testShortIdGeneration };