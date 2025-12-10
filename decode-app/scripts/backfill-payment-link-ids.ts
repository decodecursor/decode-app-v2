#!/usr/bin/env npx tsx

// Backfill script to generate paymentlink_request_id for existing payment links
// This script will update all payment_links records that have NULL paymentlink_request_id

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { generateUniquePaymentLinkRequestId } from '../lib/short-id';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PaymentLink {
  id: string;
  paymentlink_request_id: string | null;
  title: string;
  created_at: string;
}

// Function to check if a payment link request ID already exists
async function checkPaymentLinkRequestIdExists(requestId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('payment_links')
      .select('paymentlink_request_id')
      .eq('paymentlink_request_id', requestId)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking payment link request ID existence:', error);
      return false; // Assume it doesn't exist to avoid blocking
    }

    return !!data;
  } catch (error) {
    console.error('Exception checking payment link request ID existence:', error);
    return false; // Assume it doesn't exist to avoid blocking
  }
}

async function main() {
  try {
    console.log('🚀 Starting backfill script for payment link request IDs...');

    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    // Fetch all payment links without paymentlink_request_id
    console.log('📋 Fetching payment links without request IDs...');
    const { data: paymentLinks, error: fetchError } = await supabase
      .from('payment_links')
      .select('id, paymentlink_request_id, title, created_at')
      .is('paymentlink_request_id', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch payment links: ${fetchError.message}`);
    }

    if (!paymentLinks || paymentLinks.length === 0) {
      console.log('✅ No payment links found without request IDs. All records are already up to date!');
      return;
    }

    console.log(`📊 Found ${paymentLinks.length} payment links without request IDs`);
    console.log(`📅 Date range: ${paymentLinks[0].created_at} to ${paymentLinks[paymentLinks.length - 1].created_at}`);

    // Process payment links in batches to avoid overwhelming the database
    const batchSize = 10;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < paymentLinks.length; i += batchSize) {
      const batch = paymentLinks.slice(i, i + batchSize);

      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(paymentLinks.length / batchSize)} (${batch.length} records)...`);

      // Process each payment link in the batch
      for (const paymentLink of batch) {
        try {
          // Generate unique payment link request ID
          const paymentlinkRequestId = await generateUniquePaymentLinkRequestId(
            checkPaymentLinkRequestIdExists
          );

          // Update the payment link with the new request ID
          const { error: updateError } = await supabase
            .from('payment_links')
            .update({
              paymentlink_request_id: paymentlinkRequestId,
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentLink.id);

          if (updateError) {
            console.error(`❌ Failed to update payment link ${paymentLink.id}:`, updateError.message);
            errorCount++;
          } else {
            console.log(`✅ Updated payment link "${paymentLink.title}" (${paymentLink.id}) → ${paymentlinkRequestId}`);
            successCount++;
          }

          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing payment link ${paymentLink.id}:`, error);
          errorCount++;
          processedCount++;
        }
      }

      // Add a small delay between batches to be gentle on the database
      if (i + batchSize < paymentLinks.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    }

    // Final summary
    console.log('\n📈 Backfill Summary:');
    console.log(`   Total processed: ${processedCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Success rate: ${((successCount / processedCount) * 100).toFixed(1)}%`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some records failed to update. Please review the error messages above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All payment links successfully updated with request IDs!');
    }

  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}