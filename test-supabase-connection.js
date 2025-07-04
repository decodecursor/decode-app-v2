#!/usr/bin/env node

// Test Supabase connection debugging

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

console.log('🔍 Environment Variables Debug:');
console.log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(`Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
}

async function testConnection() {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    console.error('❌ Missing URL configuration');
    return;
  }
  
  // Try both keys
  console.log('\n🔄 Testing Supabase connection with anon key...');
  
  try {
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test basic connection
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('users')
      .select('count')
      .limit(1);
    
    if (anonError) {
      console.error('❌ Anon key connection failed:', anonError.message);
    } else {
      console.log('✅ Anon key connection successful!');
    }
    
  } catch (error) {
    console.error('❌ Anon key exception:', error.message);
  }
  
  if (supabaseServiceKey) {
    console.log('\n🔄 Testing Supabase connection with service key...');
    
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
      // Test basic connection
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('❌ Service key connection failed:', error.message);
        console.error('Error details:', error);
      } else {
        console.log('✅ Service key connection successful!');
        console.log('Data:', data);
      }
      
    } catch (error) {
      console.error('❌ Service key exception:', error.message);
    }
  } else {
    console.log('⚠️  No service key found');
  }
}

testConnection();