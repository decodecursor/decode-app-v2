#!/usr/bin/env npx tsx

// Validation script to verify all payment links now have paymentlink_request_id

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function validateResults() {
  try {
    console.log('🔍 Validating payment link request IDs...');

    // Check total count
    const { data: totalLinks, error: totalError } = await supabase
      .from('payment_links')
      .select('id');

    if (totalError) {
      throw new Error(`Failed to get total count: ${totalError.message}`);
    }

    // Check links with request IDs
    const { data: linksWithIds, error: idsError } = await supabase
      .from('payment_links')
      .select('id, paymentlink_request_id')
      .not('paymentlink_request_id', 'is', null);

    if (idsError) {
      throw new Error(`Failed to get links with IDs: ${idsError.message}`);
    }

    // Check for any remaining NULL values
    const { data: linksWithoutIds, error: nullError } = await supabase
      .from('payment_links')
      .select('id, title, created_at')
      .is('paymentlink_request_id', null);

    if (nullError) {
      throw new Error(`Failed to check for NULL values: ${nullError.message}`);
    }

    console.log('📊 Validation Results:');
    console.log(`   Total payment links: ${totalLinks?.length || 0}`);
    console.log(`   Links with request IDs: ${linksWithIds?.length || 0}`);
    console.log(`   Links without request IDs: ${linksWithoutIds?.length || 0}`);

    if (linksWithoutIds && linksWithoutIds.length > 0) {
      console.log('\n⚠️  Found payment links still missing request IDs:');
      linksWithoutIds.forEach(link => {
        console.log(`   - ${link.title} (${link.id}) - created: ${link.created_at}`);
      });
      return false;
    } else {
      console.log('\n✅ All payment links now have request IDs!');
    }

    // Sample a few request IDs to verify format
    const sample = linksWithIds?.slice(0, 5) || [];
    console.log('\n🔍 Sample request IDs (should be format PL[8 chars]):');
    sample.forEach(link => {
      const isValidFormat = /^PL[A-Z0-9]{8}$/.test(link.paymentlink_request_id);
      const formatStatus = isValidFormat ? '✅' : '❌';
      console.log(`   ${formatStatus} ${link.paymentlink_request_id} (${link.id})`);
    });

    // Check for duplicate request IDs
    const { data: duplicateCheck, error: dupError } = await supabase
      .from('payment_links')
      .select('paymentlink_request_id')
      .not('paymentlink_request_id', 'is', null);

    if (dupError) {
      throw new Error(`Failed to check for duplicates: ${dupError.message}`);
    }

    const requestIds = duplicateCheck?.map(link => link.paymentlink_request_id) || [];
    const uniqueIds = new Set(requestIds);

    if (requestIds.length !== uniqueIds.size) {
      console.log('\n⚠️  Found duplicate request IDs!');
      const duplicates = requestIds.filter((id, index) => requestIds.indexOf(id) !== index);
      console.log(`   Duplicates: ${Array.from(new Set(duplicates)).join(', ')}`);
      return false;
    } else {
      console.log('\n✅ All request IDs are unique!');
    }

    console.log('\n🎉 Validation complete - all checks passed!');
    return true;

  } catch (error) {
    console.error('💥 Validation failed:', error);
    return false;
  }
}

// Run validation
if (require.main === module) {
  validateResults().then(success => {
    process.exit(success ? 0 : 1);
  });
}