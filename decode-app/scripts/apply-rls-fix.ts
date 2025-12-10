/**
 * Script to apply RLS policy fix for beauty_businesses table
 * Run with: npx tsx scripts/apply-rls-fix.ts
 */

import { supabaseAdmin } from '../lib/supabase-admin';

async function applyRLSFix() {
  console.log('🔧 Applying RLS policy fix for beauty_businesses...');

  try {
    // Drop the old restrictive policy
    console.log('1. Dropping old policy...');
    const { error: dropError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Users can view own businesses" ON beauty_businesses;'
    });

    if (dropError) {
      console.error('❌ Error dropping old policy:', dropError);
      // Continue anyway - policy might not exist
    } else {
      console.log('✅ Old policy dropped');
    }

    // Create new public read policy
    console.log('2. Creating new public read policy...');
    const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `CREATE POLICY "Anyone can view businesses" ON beauty_businesses
            FOR SELECT
            USING (true);`
    });

    if (createError) {
      console.error('❌ Error creating new policy:', createError);
      throw createError;
    }

    console.log('✅ New policy created');
    console.log('🎉 RLS policy fix applied successfully!');
    console.log('');
    console.log('Beauty businesses are now publicly viewable (read-only).');
    console.log('Write operations remain restricted to business owners.');

  } catch (error) {
    console.error('💥 Failed to apply RLS fix:', error);
    process.exit(1);
  }
}

// Alternative: Direct SQL execution if RPC doesn't work
async function applyRLSFixDirect() {
  console.log('🔧 Applying RLS policy fix using direct SQL...');

  try {
    // Drop old policy
    console.log('1. Dropping old policy...');
    await supabaseAdmin.from('beauty_businesses').select('id').limit(0); // Just to test connection

    // Since we can't execute raw SQL directly, we'll need to do this via Supabase Dashboard
    console.log('');
    console.log('⚠️  Cannot execute raw SQL from Node.js supabase client');
    console.log('');
    console.log('Please run the following SQL in your Supabase Dashboard SQL Editor:');
    console.log('================================================================================');
    console.log('');
    console.log('DROP POLICY IF EXISTS "Users can view own businesses" ON beauty_businesses;');
    console.log('');
    console.log('CREATE POLICY "Anyone can view businesses" ON beauty_businesses');
    console.log('    FOR SELECT');
    console.log('    USING (true);');
    console.log('');
    console.log('================================================================================');
    console.log('');
    console.log('After running this SQL, auctions should display correctly.');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Run the script
applyRLSFixDirect();
