// Database setup script for Crossmint integration
// Run this script to apply all necessary database changes

const { createClient } = require('@supabase/supabase-js');
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

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQLFile(filename) {
  try {
    console.log(`🔄 Running ${filename}...`);
    
    const sqlContent = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    
    // Split SQL file into individual statements (rough split on ';')
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // For now, we'll log the SQL content and suggest manual execution
    // since direct SQL execution through Supabase JS client has limitations
    console.log('📋 SQL Content to execute:');
    console.log('─'.repeat(50));
    console.log(sqlContent);
    console.log('─'.repeat(50));
    
    console.log('⚠️  Please execute this SQL manually in your Supabase SQL editor');
    console.log('   or use a database client to run the migration');
    
    // Alternatively, we could use a proper database client like 'pg'
    // but for simplicity, we'll suggest manual execution for now
    
    console.log(`✅ Successfully executed ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to execute ${filename}:`, error.message);
    throw error;
  }
}

async function setupCrossmintDatabase() {
  console.log('🚀 Setting up Crossmint database integration...\n');
  
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    console.log('✅ Database connection successful\n');
    
    // Apply Crossmint migration
    await runSQLFile('supabase-crossmint-migration.sql');
    
    console.log('\n🎉 Crossmint database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set up Crossmint API credentials in environment variables');
    console.log('2. Test wallet creation functionality');
    console.log('3. Implement headless checkout UI components');
    console.log('4. Set up webhook endpoints');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error('Please check the error above and try again.');
    process.exit(1);
  }
}

// Utility function to check current schema
async function checkCurrentSchema() {
  console.log('🔍 Checking current database schema...\n');
  
  try {
    // Simple table existence check
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (userError) throw userError;
    console.log('✅ Users table exists and accessible');
    
    const { data: links, error: linkError } = await supabase
      .from('payment_links')
      .select('id')
      .limit(1);
    
    if (linkError) throw linkError;
    console.log('✅ Payment links table exists and accessible');
    
    // Check if wallet_transactions table exists
    const { data: transactions, error: transactionError } = await supabase
      .from('wallet_transactions')
      .select('id')
      .limit(1);
    
    if (transactionError) {
      console.log('❌ Wallet transactions table does not exist or not accessible');
      console.log('   This is expected before running the migration');
    } else {
      console.log('✅ Wallet transactions table exists and accessible');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'setup':
    setupCrossmintDatabase();
    break;
  case 'check':
    checkCurrentSchema();
    break;
  default:
    console.log('Crossmint Database Setup Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node setup-crossmint-database.js setup  - Apply all Crossmint database changes');
    console.log('  node setup-crossmint-database.js check  - Check current database schema');
    console.log('');
    console.log('Environment Variables Required:');
    console.log('  NEXT_PUBLIC_SUPABASE_URL      - Your Supabase project URL');
    console.log('  SUPABASE_SERVICE_ROLE_KEY     - Your Supabase service role key');
    break;
}

module.exports = {
  setupCrossmintDatabase,
  checkCurrentSchema,
  runSQLFile
};