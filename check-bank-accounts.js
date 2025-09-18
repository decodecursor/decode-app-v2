#!/usr/bin/env node

/**
 * Bank Account Data Verification Script
 * Check what bank account data exists in the database
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBankAccounts() {
  console.log('🔍 Checking bank account data...');
  console.log('📍 Database:', supabaseUrl.replace(/\/+$/, ''));

  try {
    // Get all bank accounts
    console.log('\n📊 All bank accounts in database:');
    const { data: allAccounts, error: allError } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching all accounts:', allError);
    } else {
      console.log(`   Found ${allAccounts?.length || 0} total bank accounts`);
      allAccounts?.forEach((account, index) => {
        console.log(`   ${index + 1}. User: ${account.user_id}, Bank: ${account.bank_name}, Primary: ${account.is_primary}, Verified: ${account.is_verified}`);
        console.log(`      IBAN: ${account.iban_number}, Created: ${account.created_at}`);
      });
    }

    // Check RLS policies
    console.log('\n🔒 Checking RLS policies:');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_bank_accounts');

    if (policiesError) {
      console.log('   ⚠️ Could not check policies (might need different approach):', policiesError.message);
    } else {
      console.log(`   Found ${policies?.length || 0} RLS policies`);
      policies?.forEach((policy, index) => {
        console.log(`   ${index + 1}. ${policy.policyname} (${policy.cmd})`);
      });
    }

    // Check table structure
    console.log('\n🏗️ Checking table structure:');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'user_bank_accounts')
      .order('ordinal_position');

    if (columnsError) {
      console.log('   ⚠️ Could not check table structure:', columnsError.message);
    } else {
      console.log('   Table columns:');
      columns?.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    }

    // Test authentication patterns
    console.log('\n🔐 Testing auth patterns:');

    // This should work with service role
    const { data: testService, error: testServiceError } = await supabase
      .from('user_bank_accounts')
      .select('user_id')
      .limit(1);

    if (testServiceError) {
      console.log('   ❌ Service role query failed:', testServiceError.message);
    } else {
      console.log('   ✅ Service role can query the table');
    }

    console.log('\n📋 Summary:');
    console.log('   1. Check if any bank accounts exist in the database');
    console.log('   2. Verify RLS policies are properly configured');
    console.log('   3. Test with actual user authentication in the app');
    console.log('\n💡 If RLS policies need to be fixed, execute the SQL from fix-bank-account-rls.sql in Supabase dashboard');

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
if (require.main === module) {
  checkBankAccounts()
    .catch((error) => {
      console.error('❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkBankAccounts };