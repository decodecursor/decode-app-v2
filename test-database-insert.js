#!/usr/bin/env node

/**
 * Test direct database insert to check if UUID is being auto-generated
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabaseInsert() {
  console.log('🧪 Testing direct database insert with custom ID...');

  try {
    const customId = 'TEST1234';
    const testData = {
      id: customId,
      title: 'Test Payment Link',
      client_name: 'Test Client',
      service_amount_aed: 100,
      decode_amount_aed: 9,
      total_amount_aed: 109,
      amount_aed: 109,
      creator_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
      expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true
    };

    console.log('📝 Inserting test data with ID:', customId);

    const { data, error } = await supabase
      .from('payment_links')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('❌ Insert failed:', error);
      
      if (error.message.includes('uuid_generate_v4')) {
        console.log('🔍 Likely cause: Database has UUID auto-generation enabled');
        console.log('💡 Solution: Need to modify database schema to allow custom IDs');
      } else if (error.message.includes('violates foreign key')) {
        console.log('🔍 Foreign key constraint - need valid creator_id');
      }
    } else {
      console.log('✅ Insert successful!');
      console.log('📊 Returned data ID:', data.id);
      console.log('🔍 ID matches?', data.id === customId ? 'YES ✅' : 'NO ❌');
      
      if (data.id !== customId) {
        console.log('⚠️ Database overwrote our custom ID!');
        console.log('🔧 This explains why short IDs are not working');
      }

      // Clean up - delete the test record
      await supabase
        .from('payment_links')
        .delete()
        .eq('id', data.id);
      console.log('🧹 Test record cleaned up');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDatabaseInsert();