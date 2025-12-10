const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runMigration(migrationFile) {
  // Create Supabase client with service role key for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Read the migration file
  const migrationPath = path.join(__dirname, '../migrations', migrationFile);
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  console.log(`Running migration: ${migrationFile}`);
  console.log('SQL Content:');
  console.log(sqlContent);
  console.log('\n---\n');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('Migration failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log('Migration completed successfully!');
    console.log('Result:', data);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>');
  console.error('Example: node run-migration.js 20251120_add_instagram_username_to_bids.sql');
  process.exit(1);
}

runMigration(migrationFile);
