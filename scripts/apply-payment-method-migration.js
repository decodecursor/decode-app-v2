/**
 * Apply Payment Method Migration
 *
 * This script applies the migration to add payment method columns to guest_bidders table.
 *
 * Usage:
 *   node scripts/apply-payment-method-migration.js
 *
 * Prerequisites:
 *   - Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

async function applyMigration() {
  console.log('🔄 Applying payment method migration...\n');

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase credentials in environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Read migration file
  const migrationPath = path.join(__dirname, '../migrations/20250123_add_payment_method_to_guest_bidders.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded:', migrationPath);
  console.log('');

  // Split migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
        console.error('   Statement:', statement.substring(0, 100) + '...');

        // Continue with other statements even if one fails
        continue;
      }

      console.log(`✅ Statement ${i + 1} executed successfully`);
    } catch (err) {
      console.error(`❌ Error executing statement ${i + 1}:`, err.message);
    }
  }

  console.log('\n✨ Migration process completed!');
  console.log('\nNOTE: If you see any errors above, you may need to apply the migration manually');
  console.log('through the Supabase dashboard SQL Editor:\n');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of:');
  console.log(`   ${migrationPath}`);
  console.log('4. Run the SQL\n');
}

// Run migration
applyMigration()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
