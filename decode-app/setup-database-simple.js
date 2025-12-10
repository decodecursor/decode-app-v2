#!/usr/bin/env node

// Simple database setup and verification for Crossmint integration
// Uses working anon key to check and test database functionality

const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });
}

async function setupDatabase() {
  console.log('🚀 Simple Database Setup for Crossmint Integration\n');
  console.log('=' .repeat(60));

  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Step 1: Verify existing tables
    console.log('1️⃣ Verifying existing database tables...\n');
    
    // Check users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, wallet_address')
      .limit(1);
    
    if (userError) {
      console.error('❌ Users table issue:', userError.message);
      return;
    } else {
      console.log('✅ Users table accessible');
    }
    
    // Check payment_links table
    const { data: links, error: linkError } = await supabase
      .from('payment_links')
      .select('id, title, amount_aed, creator_id, is_active')
      .limit(1);
    
    if (linkError) {
      console.error('❌ Payment links table issue:', linkError.message);
      return;
    } else {
      console.log('✅ Payment links table accessible');
    }
    
    // Step 2: Test payment link creation with fees
    console.log('\n2️⃣ Testing payment link creation with fee calculation...\n');
    
    // Calculate marketplace fee (9%)
    const originalAmount = 100;
    const feePercentage = 9;
    const feeAmount = Math.round(originalAmount * (feePercentage / 100) * 100) / 100;
    const totalAmount = Math.round((originalAmount + feeAmount) * 100) / 100;
    
    console.log(`💰 Test Payment Link:`)
    console.log(`   Original Amount: AED ${originalAmount}`);
    console.log(`   Fee (9%): AED ${feeAmount}`);
    console.log(`   Total Amount: AED ${totalAmount}`);
    
    // Create a test payment link
    const testPaymentLink = {
      title: 'Test Beauty Service - Database Setup',
      description: 'Test payment link created during database setup',
      amount_aed: totalAmount, // Total amount customer pays
      service_amount_aed: originalAmount, // Amount professional receives
      decode_amount_aed: feeAmount, // DECODE platform amount
      total_amount_aed: totalAmount, // Same as amount_aed for clarity
      creator_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      is_active: true
    };
    
    console.log('\n🔄 Creating test payment link...');
    
    const { data: newLink, error: createError } = await supabase
      .from('payment_links')
      .insert([testPaymentLink])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Failed to create test payment link:', createError.message);
      console.log('⚠️  This might indicate missing columns. Check the migration status.');
      
      // Try without the new fee columns
      console.log('\n🔄 Trying without fee columns...');
      const basicLink = {
        title: 'Test Beauty Service - Basic',
        description: 'Basic test payment link',
        amount_aed: originalAmount,
        creator_id: '00000000-0000-0000-0000-000000000000',
        expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true
      };
      
      const { data: basicNewLink, error: basicCreateError } = await supabase
        .from('payment_links')
        .insert([basicLink])
        .select()
        .single();
      
      if (basicCreateError) {
        console.error('❌ Basic payment link creation also failed:', basicCreateError.message);
      } else {
        console.log('✅ Basic payment link created successfully!');
        console.log(`   Link ID: ${basicNewLink.id}`);
        
        // Clean up test link
        await supabase.from('payment_links').delete().eq('id', basicNewLink.id);
        console.log('🧹 Test link cleaned up');
      }
      
    } else {
      console.log('✅ Test payment link created successfully!');
      console.log(`   Link ID: ${newLink.id}`);
      console.log(`   Fee calculation working: ${newLink.fee_amount_aed === feeAmount}`);
      
      // Clean up test link
      await supabase.from('payment_links').delete().eq('id', newLink.id);
      console.log('🧹 Test link cleaned up');
    }
    
    // Step 3: Check if we need migration
    console.log('\n3️⃣ Database migration status...\n');
    
    if (createError) {
      console.log('⚠️  Database migration appears incomplete.');
      console.log('📋 Required actions:');
      console.log('1. Run the SQL migration in Supabase dashboard:');
      console.log('   - Go to https://supabase.com/dashboard');
      console.log('   - Navigate to SQL Editor');
      console.log('   - Copy and execute content from supabase-crossmint-migration.sql');
      console.log('2. Re-run this script to verify setup');
    } else {
      console.log('✅ Database migration appears complete!');
      console.log('✅ Fee calculation columns working');
      console.log('✅ Ready for Crossmint integration');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Database setup check completed!');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
  }
}

if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };