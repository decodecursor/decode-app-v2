#!/usr/bin/env node

/**
 * Environment validation script
 * Run this to check if all required environment variables are set
 */

const fs = require('fs');
const path = require('path');

// Load .env.local if it exists
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const requiredEnvVars = [
  // Stripe
  { name: 'STRIPE_SECRET_KEY', description: 'Stripe API secret key' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', description: 'Stripe publishable key' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook endpoint secret' },
  
  // Supabase
  { name: 'SUPABASE_URL', description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase public URL' },
  { name: 'SUPABASE_ANON_KEY', description: 'Supabase anonymous key' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase public anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
  
  // Application
  { name: 'NEXT_PUBLIC_APP_URL', description: 'Application URL' },
];

const optionalEnvVars = [
  { name: 'CRON_SECRET', description: 'Secret for authenticating cron requests' },
  { name: 'ADMIN_EMAIL', description: 'Admin email for notifications' },
  { name: 'STRIPE_CONNECT_WEBHOOK_SECRET', description: 'Stripe Connect webhook secret' },
  { name: 'DEBUG', description: 'Enable debug logging' },
  { name: 'DEBUG_WEBHOOKS', description: 'Enable webhook debug logging' },
];

console.log('🔍 Checking environment variables...\n');

let hasErrors = false;
const errors = [];
const warnings = [];

// Check required variables
requiredEnvVars.forEach(({ name, description }) => {
  const value = process.env[name];
  
  if (!value) {
    hasErrors = true;
    errors.push(`❌ Missing: ${name} - ${description}`);
  } else {
    // Additional validation
    if (name === 'STRIPE_SECRET_KEY' && !value.startsWith('sk_')) {
      warnings.push(`⚠️  ${name}: Should start with 'sk_test_' or 'sk_live_'`);
    }
    if (name === 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' && !value.startsWith('pk_')) {
      warnings.push(`⚠️  ${name}: Should start with 'pk_test_' or 'pk_live_'`);
    }
    if (value.includes('...') || value.includes('your-')) {
      warnings.push(`⚠️  ${name}: Appears to contain a placeholder value`);
    }
    
    console.log(`✅ ${name}: Set`);
  }
});

console.log('\n📋 Optional variables:\n');

// Check optional variables
optionalEnvVars.forEach(({ name, description }) => {
  const value = process.env[name];
  
  if (!value) {
    console.log(`➖ ${name}: Not set (${description})`);
  } else {
    console.log(`✅ ${name}: Set`);
  }
});

// Display results
if (errors.length > 0) {
  console.log('\n❌ Errors found:\n');
  errors.forEach(error => console.log(error));
}

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:\n');
  warnings.forEach(warning => console.log(warning));
}

if (hasErrors) {
  console.log('\n❌ Environment validation failed!');
  console.log('Please set all required environment variables.');
  console.log('Copy .env.example to .env.local and fill in the values.\n');
  process.exit(1);
} else {
  console.log('\n✅ Environment validation passed!\n');
  
  // Check for production readiness
  const isProduction = process.env.NODE_ENV === 'production';
  const hasTestKeys = 
    process.env.STRIPE_SECRET_KEY?.includes('test') ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('test');
  
  if (isProduction && hasTestKeys) {
    console.log('⚠️  WARNING: Using test Stripe keys in production!');
  }
}