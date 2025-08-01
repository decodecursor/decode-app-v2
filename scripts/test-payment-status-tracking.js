#!/usr/bin/env node

/**
 * Test script for validating Stripe payment status tracking solution
 * This script tests the end-to-end flow of payment status tracking
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'; // Replace with actual test user ID
const TEST_PAYMENT_LINK_ID = '00000000-0000-0000-0000-000000000002'; // Replace with actual test payment link ID

async function runTests() {
  console.log('🚀 Starting Payment Status Tracking Tests\n');

  try {
    // Test 1: Database Schema Validation
    await testDatabaseSchema();
    
    // Test 2: Payment Link Status Detection
    await testPaymentLinkStatusDetection();
    
    // Test 3: Transaction Creation
    await testTransactionCreation();
    
    // Test 4: Payment Completion Flow
    await testPaymentCompletion();
    
    // Test 5: Webhook Idempotency
    await testWebhookIdempotency();
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

async function testDatabaseSchema() {
  console.log('📋 Test 1: Database Schema Validation');
  
  try {
    // Check if new transactions table exists with required columns
    const { data, error } = await supabase
      .from('transactions')
      .select('id, payment_link_id, amount_aed, amount_usd, payment_processor, processor_session_id, processor_payment_id, status, created_at, completed_at')
      .limit(1);
    
    if (error && error.code === '42P01') {
      throw new Error('transactions table does not exist - run migrations first');
    }
    
    if (error) {
      throw new Error(`Database schema error: ${error.message}`);
    }
    
    // Check if payment_links table has payment_status column
    const { data: paymentLinkData, error: paymentLinkError } = await supabase
      .from('payment_links')
      .select('id, payment_status, paid_at')
      .limit(1);
    
    if (paymentLinkError && paymentLinkError.message.includes('payment_status')) {
      throw new Error('payment_links table missing payment_status column - run migrations first');
    }
    
    console.log('   ✅ Database schema is correct');
    
  } catch (error) {
    console.log('   ❌ Database schema test failed:', error.message);
    throw error;
  }
}

async function testPaymentLinkStatusDetection() {
  console.log('📋 Test 2: Payment Link Status Detection');
  
  try {
    // Create a test payment link
    const { data: paymentLink, error: createError } = await supabase
      .from('payment_links')
      .insert({
        title: 'Test Payment Link',
        amount_aed: 100.00,
        expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: TEST_USER_ID,
        is_active: true,
        payment_status: 'unpaid'
      })
      .select()
      .single();
    
    if (createError) {
      throw new Error(`Failed to create test payment link: ${createError.message}`);
    }
    
    // Test status detection
    const { data: fetchedPaymentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select('id, payment_status, paid_at')
      .eq('id', paymentLink.id)
      .single();
    
    if (fetchError) {
      throw new Error(`Failed to fetch payment link: ${fetchError.message}`);
    }
    
    if (fetchedPaymentLink.payment_status !== 'unpaid') {
      throw new Error(`Expected status 'unpaid', got '${fetchedPaymentLink.payment_status}'`);
    }
    
    // Clean up
    await supabase.from('payment_links').delete().eq('id', paymentLink.id);
    
    console.log('   ✅ Payment link status detection works correctly');
    
  } catch (error) {
    console.log('   ❌ Payment link status test failed:', error.message);
    throw error;
  }
}

async function testTransactionCreation() {
  console.log('📋 Test 3: Transaction Creation');
  
  try {
    // Create test payment link first
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .insert({
        title: 'Test Transaction Creation',
        amount_aed: 150.00,
        expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: TEST_USER_ID,
        is_active: true,
        payment_status: 'unpaid'
      })
      .select()
      .single();
    
    if (linkError) {
      throw new Error(`Failed to create test payment link: ${linkError.message}`);
    }
    
    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: paymentLink.id,
        buyer_email: 'test@example.com',
        buyer_name: 'Test User',
        amount_aed: 150.00,
        amount_usd: 40.82, // Approximate conversion
        payment_processor: 'stripe',
        processor_session_id: 'cs_test_12345',
        status: 'pending',
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (transactionError) {
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }
    
    // Verify transaction was created correctly
    if (transaction.status !== 'pending') {
      throw new Error(`Expected transaction status 'pending', got '${transaction.status}'`);
    }
    
    if (transaction.amount_aed !== 150.00) {
      throw new Error(`Expected amount_aed 150.00, got ${transaction.amount_aed}`);
    }
    
    // Clean up
    await supabase.from('transactions').delete().eq('id', transaction.id);
    await supabase.from('payment_links').delete().eq('id', paymentLink.id);
    
    console.log('   ✅ Transaction creation works correctly');
    
  } catch (error) {
    console.log('   ❌ Transaction creation test failed:', error.message);
    throw error;
  }
}

async function testPaymentCompletion() {
  console.log('📋 Test 4: Payment Completion Flow');
  
  try {
    // Create test payment link
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .insert({
        title: 'Test Payment Completion',
        amount_aed: 200.00,
        expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: TEST_USER_ID,
        is_active: true,
        payment_status: 'unpaid'
      })
      .select()
      .single();
    
    if (linkError) {
      throw new Error(`Failed to create test payment link: ${linkError.message}`);
    }
    
    // Create pending transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: paymentLink.id,
        buyer_email: 'completion@example.com',
        amount_aed: 200.00,
        amount_usd: 54.42,
        payment_processor: 'stripe',
        processor_session_id: 'cs_test_completion',
        processor_payment_id: 'pi_test_completion',
        status: 'pending'
      })
      .select()
      .single();
    
    if (transactionError) {
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }
    
    // Complete the transaction
    const { error: completionError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processor_transaction_id: 'pi_test_completion'
      })
      .eq('id', transaction.id);
    
    if (completionError) {
      throw new Error(`Failed to complete transaction: ${completionError.message}`);
    }
    
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if payment link status was updated by trigger
    const { data: updatedPaymentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select('payment_status, paid_at')
      .eq('id', paymentLink.id)
      .single();
    
    if (fetchError) {
      throw new Error(`Failed to fetch updated payment link: ${fetchError.message}`);
    }
    
    if (updatedPaymentLink.payment_status !== 'paid') {
      throw new Error(`Expected payment_status 'paid', got '${updatedPaymentLink.payment_status}'`);
    }
    
    if (!updatedPaymentLink.paid_at) {
      throw new Error('Expected paid_at to be set, but it was null');
    }
    
    // Clean up
    await supabase.from('transactions').delete().eq('id', transaction.id);
    await supabase.from('payment_links').delete().eq('id', paymentLink.id);
    
    console.log('   ✅ Payment completion flow works correctly');
    
  } catch (error) {
    console.log('   ❌ Payment completion test failed:', error.message);
    throw error;
  }
}

async function testWebhookIdempotency() {
  console.log('📋 Test 5: Webhook Idempotency');
  
  try {
    const testEventId = 'evt_test_idempotency_' + Date.now();
    
    // Insert webhook event
    const { data: webhookEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: testEventId,
        event_type: 'checkout.session.completed',
        event_data: { test: true },
        status: 'received'
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to insert webhook event: ${insertError.message}`);
    }
    
    // Try to insert the same event again (should handle duplicate)
    const { data: duplicateEvent, error: duplicateError } = await supabase
      .from('webhook_events')
      .upsert({
        event_id: testEventId,
        event_type: 'checkout.session.completed',
        event_data: { test: true, updated: true },
        status: 'processed'
      }, {
        onConflict: 'event_id'
      })
      .select()
      .single();
    
    if (duplicateError) {
      throw new Error(`Failed to handle duplicate webhook event: ${duplicateError.message}`);
    }
    
    // Check that the event was updated, not duplicated
    const { data: events, error: fetchError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('event_id', testEventId);
    
    if (fetchError) {
      throw new Error(`Failed to fetch webhook events: ${fetchError.message}`);
    }
    
    if (events.length !== 1) {
      throw new Error(`Expected 1 webhook event, found ${events.length}`);
    }
    
    if (events[0].status !== 'processed') {
      throw new Error(`Expected webhook status 'processed', got '${events[0].status}'`);
    }
    
    // Clean up
    await supabase.from('webhook_events').delete().eq('event_id', testEventId);
    
    console.log('   ✅ Webhook idempotency works correctly');
    
  } catch (error) {
    console.log('   ❌ Webhook idempotency test failed:', error.message);
    throw error;
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testDatabaseSchema,
  testPaymentLinkStatusDetection,
  testTransactionCreation,
  testPaymentCompletion,
  testWebhookIdempotency
};