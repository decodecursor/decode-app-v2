#!/usr/bin/env node

/**
 * Check Database Schema
 * Verifies current state of payment_links table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('🔍 Checking current database schema...');

  try {
    // Test query to see what fields exist
    const { data: sampleLink, error: queryError } = await supabase
      .from('payment_links')
      .select('*')
      .limit(1)
      .single();

    if (queryError) {
      console.error('❌ Error querying payment_links:', queryError);
      return;
    }

    console.log('📊 Current payment_links table structure:');
    console.log('Available columns:', Object.keys(sampleLink || {}));

    // Check if new columns exist
    const hasServiceAmount = 'service_amount_aed' in (sampleLink || {});
    const hasDecodeAmount = 'decode_amount_aed' in (sampleLink || {});
    const hasOriginalAmount = 'original_amount_aed' in (sampleLink || {});
    const hasFeeAmount = 'fee_amount_aed' in (sampleLink || {});

    console.log('\n🔍 Column status:');
    console.log('✅ service_amount_aed:', hasServiceAmount ? 'EXISTS' : 'MISSING');
    console.log('✅ decode_amount_aed:', hasDecodeAmount ? 'EXISTS' : 'MISSING');
    console.log('📝 original_amount_aed:', hasOriginalAmount ? 'EXISTS (old)' : 'MISSING');
    console.log('📝 fee_amount_aed:', hasFeeAmount ? 'EXISTS (old)' : 'MISSING');

    if (sampleLink) {
      console.log('\n📋 Sample payment link data:');
      console.log(JSON.stringify(sampleLink, null, 2));
    }

    // Check if migration is needed
    if (!hasServiceAmount && !hasDecodeAmount) {
      console.log('\n❗ MIGRATION NEEDED:');
      console.log('   The new column names do not exist yet.');
      console.log('   You need to apply the database migration first.');
      console.log('\n📋 Manual migration steps:');
      console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the migration script: migrations/rename-columns-and-update-fees.sql');
    } else {
      console.log('\n✅ MIGRATION ALREADY APPLIED:');
      console.log('   New column names exist in the database.');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkDatabase();