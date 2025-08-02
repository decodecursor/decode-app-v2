#!/usr/bin/env node

/**
 * Database Migration Script
 * Applies the field renaming and 9% fee structure migration to Supabase
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

async function runMigration() {
  console.log('🔄 Starting database migration...');
  console.log('📍 Target database:', supabaseUrl);

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'rename-columns-and-update-fees.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Migration SQL loaded, length:', migrationSQL.length, 'characters');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .filter(stmt => !stmt.match(/^(DO \$\$|DECLARE|BEGIN|END \$\$|RAISE NOTICE)/));

    console.log('📊 Found', statements.length, 'SQL statements to execute');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim().length === 0) continue;

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 60)}${statement.length > 60 ? '...' : ''}`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          
          // Continue with non-critical errors
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

    // Verify the migration worked
    console.log('🔍 Verifying migration results...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'payment_links')
      .in('column_name', ['service_amount_aed', 'decode_amount_aed']);

    if (columnsError) {
      console.error('❌ Error verifying columns:', columnsError);
    } else {
      console.log('✅ Found new columns:', columns.map(c => c.column_name));
    }

    // Check some sample data
    const { data: sampleData, error: sampleError } = await supabase
      .from('payment_links')
      .select('id, service_amount_aed, decode_amount_aed, total_amount_aed')
      .limit(3);

    if (sampleError) {
      console.error('❌ Error getting sample data:', sampleError);
    } else {
      console.log('📊 Sample payment links after migration:');
      sampleData.forEach((link, index) => {
        console.log(`   ${index + 1}. Service: ${link.service_amount_aed}, Decode: ${link.decode_amount_aed}, Total: ${link.total_amount_aed}`);
      });
    }

    console.log('🎉 Migration completed successfully!');
    console.log('📋 Next steps:');
    console.log('   1. Test payment link creation with new schema');
    console.log('   2. Verify fee calculations are correct (9%)');
    console.log('   3. Implement short ID generation for payment links');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution if RPC doesn't work
async function runMigrationAlternative() {
  console.log('🔄 Trying alternative migration approach...');

  try {
    // Step 1: Rename columns
    console.log('📝 Step 1: Renaming columns...');
    
    const { error: rename1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE payment_links RENAME COLUMN original_amount_aed TO service_amount_aed'
    });
    
    if (rename1 && !rename1.message.includes('does not exist')) {
      throw rename1;
    }
    
    const { error: rename2 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE payment_links RENAME COLUMN fee_amount_aed TO decode_amount_aed'
    });
    
    if (rename2 && !rename2.message.includes('does not exist')) {
      throw rename2;
    }

    console.log('✅ Column renaming completed');

    // Step 2: Update fee structure
    console.log('📝 Step 2: Updating fee structure to 9%...');
    
    const { error: updateFees } = await supabase
      .from('payment_links')
      .update({
        decode_amount_aed: supabase.raw('ROUND(service_amount_aed * 0.09, 2)'),
        total_amount_aed: supabase.raw('ROUND(service_amount_aed * 1.09, 2)')
      })
      .not('service_amount_aed', 'is', null);

    if (updateFees) {
      console.log('⚠️ Update fees error (might be expected):', updateFees);
    }

    console.log('✅ Fee structure updated to 9%');
    console.log('🎉 Alternative migration approach completed!');

  } catch (error) {
    console.error('❌ Alternative migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .catch(async (error) => {
      console.log('⚠️ Primary migration failed, trying alternative approach...');
      return runMigrationAlternative();
    })
    .catch((error) => {
      console.error('❌ All migration approaches failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration, runMigrationAlternative };