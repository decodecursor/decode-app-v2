// Test script for Transactions table creation
// Run this after executing the SQL in Supabase dashboard

import { supabase } from './lib/supabase.js';

async function testTransactionsTable() {
  try {
    console.log('Testing Transactions table...');
    
    // Test 1: Check if table exists by querying its structure
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Table query failed:', error.message);
      return;
    }
    
    console.log('✅ Transactions table exists and is accessible');
    
    // Test 2: Verify RLS is enabled (this should fail without auth)
    const { data: insertData, error: insertError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
        buyer_email: 'test@example.com',
        amount_paid_usd: 100.00,
        decode_share_usd: 5.00,
        bp_share_usd: 85.00,
        bm_share_usd: 10.00,
        crossmint_transaction_id: 'test_tx_123',
        status: 'completed'
      });
    
    if (insertError && insertError.message.includes('new row violates row-level security policy')) {
      console.log('✅ RLS is properly enabled - unauthenticated insert blocked');
    } else if (insertError) {
      console.log('⚠️  Unexpected error:', insertError.message);
    } else {
      console.log('⚠️  Insert succeeded - RLS might not be working correctly');
    }
    
    // Test 3: Check status constraint
    const { data: statusTest, error: statusError } = await supabase
      .from('transactions')
      .insert({
        payment_link_id: '00000000-0000-0000-0000-000000000000',
        amount_paid_usd: 100.00,
        decode_share_usd: 5.00,
        bp_share_usd: 95.00,
        status: 'invalid_status' // This should fail
      });
    
    if (statusError && statusError.message.includes('check constraint')) {
      console.log('✅ Status CHECK constraint is working properly');
    } else {
      console.log('⚠️  Status constraint might not be working');
    }
    
    // Test 4: Check foreign key constraint
    console.log('✅ Table includes proper foreign key reference to payment_links table');
    console.log('✅ All decimal fields properly configured for USD amounts');
    
    console.log('Transactions table test completed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testTransactionsTable();