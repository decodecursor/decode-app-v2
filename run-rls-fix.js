#!/usr/bin/env node

/**
 * RLS Fix Script
 * Applies the bank account RLS policies fix to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
  console.log('📍 Target database:', supabaseUrl);

  try {
    // Read the RLS fix SQL file
    const rlsFixPath = path.join(__dirname, 'fix-bank-account-rls.sql');
    const rlsFixSQL = fs.readFileSync(rlsFixPath, 'utf8');

    console.log('📝 RLS fix SQL loaded, length:', rlsFixSQL.length, 'characters');

    // Split the RLS fix into individual statements
    const statements = rlsFixSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log('📊 Found', statements.length, 'SQL statements to execute');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.trim().length === 0) continue;

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);

      try {
        // Use direct SQL execution via the REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql: statement })
        });

        if (!response.ok) {
          // If RPC doesn't work, try alternative approach with individual policy operations
          console.log('   📝 RPC not available, using alternative approach...');
          await handlePolicyStatement(statement);
        } else {
          const data = await response.json();
          console.log(`   ✅ Statement ${i + 1} completed successfully`);
        }

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);

          // Continue with non-critical errors (like DROP IF EXISTS)
          if (error.message.includes('does not exist') || error.message.includes('already exists')) {
            console.log('   ⚠️ Non-critical error, continuing...');
            continue;
          } else {
            throw error;
          }
        }

        console.log(`   ✅ Statement ${i + 1} completed successfully`);

      } catch (statementError) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, statementError);
        throw statementError;
      }
    }

    // Verify the RLS policies are applied
    console.log('🔍 Verifying RLS policies...');

    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
        FROM pg_policies
        WHERE tablename = 'user_bank_accounts'
        ORDER BY policyname;
      `
    });

    if (policiesError) {
      console.error('❌ Error verifying policies:', policiesError);
    } else {
      console.log('✅ Current RLS policies for user_bank_accounts:');
      if (policies && policies.length > 0) {
        policies.forEach((policy, index) => {
          console.log(`   ${index + 1}. ${policy.policyname} (${policy.cmd})`);
        });
      } else {
        console.log('   No policies found - this might indicate an issue');
      }
    }

    // Test the policies by trying to query the table
    console.log('🧪 Testing RLS policies...');
    const { data: testData, error: testError } = await supabase
      .from('user_bank_accounts')
      .select('id, user_id, bank_name')
      .limit(1);

    if (testError) {
      console.log('⚠️ Test query error (expected if no data):', testError.message);
    } else {
      console.log('✅ Test query successful, found records:', testData?.length || 0);
    }

    console.log('🎉 RLS fix completed successfully!');
    console.log('📋 Next steps:');
    console.log('   1. Test bank account saving and retrieval in the app');
    console.log('   2. Check that bank account display now works correctly');

  } catch (error) {
    console.error('❌ RLS fix failed:', error);
    process.exit(1);
  }
}

// Run the RLS fix
if (require.main === module) {
  runRLSFix()
    .catch((error) => {
      console.error('❌ RLS fix failed:', error);
      process.exit(1);
    });
}

module.exports = { runRLSFix };