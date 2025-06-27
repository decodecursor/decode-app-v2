// Test script for Users table creation
// Run this after executing the SQL in Supabase dashboard

import { supabase } from './lib/supabase.js';

async function testUsersTable() {
  try {
    console.log('Testing Users table...');
    
    // Test 1: Check if table exists by querying its structure
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Table query failed:', error.message);
      return;
    }
    
    console.log('✅ Users table exists and is accessible');
    
    // Test 2: Verify RLS is enabled (this should fail without auth)
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Beauty Professional'
      });
    
    if (insertError && insertError.message.includes('new row violates row-level security policy')) {
      console.log('✅ RLS is properly enabled - unauthenticated insert blocked');
    } else if (insertError) {
      console.log('⚠️  Unexpected error:', insertError.message);
    } else {
      console.log('⚠️  Insert succeeded - RLS might not be working correctly');
    }
    
    console.log('Table test completed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testUsersTable();