#!/usr/bin/env node

/**
 * Check current payment link format in the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentLinks() {
  console.log('🔍 Checking current payment links in database...');

  try {
    // Get the most recent payment links
    const { data: links, error } = await supabase
      .from('payment_links')
      .select('id, title, service_amount_aed, decode_amount_aed, total_amount_aed, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching payment links:', error);
      return;
    }

    console.log(`📊 Found ${links?.length || 0} payment links:`);

    if (links && links.length > 0) {
      links.forEach((link, index) => {
        const isShortId = /^[0-9A-Fa-f]{8}$/.test(link.id);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(link.id);
        
        console.log(`\n   ${index + 1}. ${link.title}`);
        console.log(`      ID: ${link.id} (${link.id.length} chars)`);
        console.log(`      Format: ${isShortId ? '✅ Short ID' : isUUID ? '⚠️ UUID' : '❓ Unknown'}`);
        console.log(`      Service: ${link.service_amount_aed || 'N/A'}, Decode: ${link.decode_amount_aed || 'N/A'}, Total: ${link.total_amount_aed || 'N/A'}`);
        console.log(`      Created: ${new Date(link.created_at).toLocaleString()}`);
        
        // Check if migration fields exist
        if (link.service_amount_aed !== null && link.decode_amount_aed !== null) {
          console.log(`      🎉 New schema: Fields migrated successfully`);
        } else {
          console.log(`      ⚠️ Old schema: Migration fields missing`);
        }
      });

      // Summary
      const shortIdCount = links.filter(link => /^[0-9A-Fa-f]{8}$/.test(link.id)).length;
      const uuidCount = links.filter(link => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(link.id)).length;
      
      console.log(`\n📈 Summary:`);
      console.log(`   Short IDs (8-char): ${shortIdCount}`);
      console.log(`   UUIDs (36-char): ${uuidCount}`);
      console.log(`   Other formats: ${links.length - shortIdCount - uuidCount}`);
      
      if (shortIdCount > 0) {
        console.log(`\n✅ Great! Short IDs are being generated`);
      } else {
        console.log(`\n⚠️ No short IDs found yet - may need to create a new payment link to test`);
      }

    } else {
      console.log('   No payment links found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCurrentLinks();