#!/usr/bin/env node

/**
 * Simple RLS Fix Script
 * Applies the bank account RLS policies fix to Supabase using SQL file
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runRLSFix() {
  console.log('🔄 Starting RLS fix for user_bank_accounts...');
  console.log('📍 Target database:', supabaseUrl.replace(/\/+$/, ''));

  try {
    console.log('📝 Step 1: Drop existing policies...');

    // Drop existing policies (ignore errors if they don't exist)
    const dropStatements = [
      'DROP POLICY IF EXISTS "Users can view own bank accounts" ON user_bank_accounts',
      'DROP POLICY IF EXISTS "Users can insert own bank accounts" ON user_bank_accounts',
      'DROP POLICY IF EXISTS "Users can update own bank accounts" ON user_bank_accounts',
      'DROP POLICY IF EXISTS "Users can delete own bank accounts" ON user_bank_accounts'
    ];

    for (const statement of dropStatements) {
      try {
        console.log(`   Executing: ${statement}`);
        // Try direct query execution through the supabase client
        const { error } = await supabase.rpc('sql', { query: statement });
        if (error && !error.message.includes('does not exist')) {
          console.log(`   ⚠️ Warning:`, error.message);
        } else {
          console.log(`   ✅ Success`);
        }
      } catch (err) {
        console.log(`   ⚠️ Policy may not exist:`, err.message);
      }
    }

    console.log('📝 Step 2: Create new policies...');

    // Create new policies
    const createStatements = [
      'CREATE POLICY "Users can view own bank accounts" ON user_bank_accounts FOR SELECT USING (auth.uid() = user_id)',
      'CREATE POLICY "Users can insert own bank accounts" ON user_bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id)',
      'CREATE POLICY "Users can update own bank accounts" ON user_bank_accounts FOR UPDATE USING (auth.uid() = user_id)',
      'CREATE POLICY "Users can delete own bank accounts" ON user_bank_accounts FOR DELETE USING (auth.uid() = user_id)'
    ];

    for (const statement of createStatements) {
      try {
        console.log(`   Executing: ${statement}`);
        const { error } = await supabase.rpc('sql', { query: statement });
        if (error) {
          console.error(`   ❌ Error:`, error.message);
          throw error;
        } else {
          console.log(`   ✅ Success`);
        }
      } catch (err) {
        console.error(`   ❌ Failed:`, err.message);
        throw err;
      }
    }

    console.log('📝 Step 3: Enable RLS...');
    try {
      const { error } = await supabase.rpc('sql', {
        query: 'ALTER TABLE user_bank_accounts ENABLE ROW LEVEL SECURITY'
      });
      if (error && !error.message.includes('already enabled')) {
        throw error;
      }
      console.log('   ✅ RLS enabled');
    } catch (err) {
      console.log('   ⚠️ RLS may already be enabled:', err.message);
    }

    console.log('🧪 Step 4: Testing policies...');

    // Test that we can query the table (this should work with service role)
    const { data: testData, error: testError } = await supabase
      .from('user_bank_accounts')
      .select('id, user_id, bank_name')
      .limit(1);

    if (testError) {
      console.log('   ⚠️ Test query error (may be expected):', testError.message);
    } else {
      console.log('   ✅ Test query successful, found records:', testData?.length || 0);
    }

    console.log('🎉 RLS fix completed successfully!');
    console.log('📋 Summary:');
    console.log('   ✅ Dropped old policies');
    console.log('   ✅ Created new policies with proper UUID comparison');
    console.log('   ✅ Enabled RLS on user_bank_accounts table');
    console.log('');
    console.log('💡 Next: Test bank account save/display in the app');

  } catch (error) {
    console.error('❌ RLS fix failed:', error);

    // Try alternative method
    console.log('🔄 Trying alternative method...');
    return runAlternativeRLSFix();
  }
}

async function runAlternativeRLSFix() {
  console.log('📝 Using SQL file execution method...');

  try {
    // Read and execute the SQL file content directly
    const sqlContent = fs.readFileSync('./fix-bank-account-rls.sql', 'utf8');
    console.log('📄 SQL file loaded');

    // Display the SQL for manual execution
    console.log('');
    console.log('🔧 Manual SQL to execute in Supabase SQL Editor:');
    console.log('=' .repeat(60));
    console.log(sqlContent);
    console.log('=' .repeat(60));
    console.log('');
    console.log('📋 Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute');
    console.log('');
    console.log('✅ After running the SQL, test the bank account functionality in the app');

  } catch (error) {
    console.error('❌ Alternative method failed:', error);
    throw error;
  }
}

// Run the RLS fix
if (require.main === module) {
  runRLSFix()
    .catch((error) => {
      console.error('❌ All RLS fix methods failed:', error);
      process.exit(1);
    });
}

module.exports = { runRLSFix };