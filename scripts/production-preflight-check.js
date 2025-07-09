#!/usr/bin/env node

/**
 * DECODE Production Pre-flight Check
 * 
 * This script validates that all necessary components are configured
 * and working before deploying to production.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local file
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    }
  }
}

// Load environment variables
loadEnvFile();

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class ProductionPreflightCheck {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? `${colors.red}❌` : 
                   type === 'warning' ? `${colors.yellow}⚠️` : 
                   type === 'success' ? `${colors.green}✅` : 
                   `${colors.blue}ℹ️`;
    
    console.log(`${prefix} ${colors.reset}${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
  }

  async checkEnvironmentVariables() {
    this.log('\n🔍 Checking Environment Variables...', 'info');
    
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_CROSSMINT_PROJECT_ID',
      'NEXT_PUBLIC_CROSSMINT_API_KEY',
      'CROSSMINT_CLIENT_ID',
      'CROSSMINT_CLIENT_SECRET',
      'CROSSMINT_WEBHOOK_SECRET',
      'CROSSMINT_ENVIRONMENT',
      'NEXT_PUBLIC_APP_URL',
      'RESEND_API_KEY'
    ];

    const optionalVars = [
      'SENDGRID_API_KEY',
      'EMAIL_PROVIDER',
      'DEBUG_EMAIL',
      'DEBUG_WEBHOOKS'
    ];

    let missing = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName] || process.env[varName].includes('your_')) {
        missing.push(varName);
      } else {
        this.log(`${varName}: configured`, 'success');
      }
    }

    for (const varName of optionalVars) {
      if (process.env[varName]) {
        this.log(`${varName}: configured (optional)`, 'success');
      } else {
        this.log(`${varName}: not set (optional)`, 'warning');
      }
    }

    if (missing.length > 0) {
      this.log(`Missing required environment variables: ${missing.join(', ')}`, 'error');
      return false;
    }

    return true;
  }

  async checkSupabaseConnection() {
    this.log('\n🔍 Testing Supabase Connection...', 'info');
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Test connection with a simple query
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        this.log(`Supabase connection failed: ${error.message}`, 'error');
        return false;
      }

      this.log('Supabase connection successful', 'success');
      return true;
    } catch (error) {
      this.log(`Supabase connection error: ${error.message}`, 'error');
      return false;
    }
  }

  async checkDatabaseTables() {
    this.log('\n🔍 Checking Database Tables...', 'info');
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const requiredTables = [
        'users',
        'payment_links', 
        'transactions',
        'webhook_events'
      ];

      for (const table of requiredTables) {
        try {
          const { error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          if (error && error.code === '42P01') {
            this.log(`Table '${table}' does not exist`, 'error');
          } else if (error) {
            this.log(`Table '${table}': ${error.message}`, 'warning');
          } else {
            this.log(`Table '${table}': exists and accessible`, 'success');
          }
        } catch (err) {
          this.log(`Error checking table '${table}': ${err.message}`, 'error');
        }
      }

      return true;
    } catch (error) {
      this.log(`Database table check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkFileStructure() {
    this.log('\n🔍 Checking Required Files...', 'info');
    
    const requiredFiles = [
      'package.json',
      'next.config.ts',
      'tailwind.config.ts',
      'app/layout.tsx',
      'app/page.tsx',
      'app/auth/page.tsx',
      'app/dashboard/page.tsx',
      'app/payment/create/page.tsx',
      'app/my-links/page.tsx',
      'app/pay/[linkId]/page.tsx',
      'app/api/health/route.ts',
      'app/api/metrics/route.ts',
      'app/api/webhooks/crossmint/route.ts',
      'lib/supabase.ts'
    ];

    const sqlFiles = [
      'supabase-users-table.sql',
      'supabase-payment-links-table.sql',
      'supabase-transactions-table-corrected.sql',
      'supabase-webhook-events-table.sql',
      'supabase-auth-trigger.sql'
    ];

    for (const file of requiredFiles) {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        this.log(`${file}: exists`, 'success');
      } else {
        this.log(`${file}: missing`, 'error');
      }
    }

    for (const file of sqlFiles) {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        this.log(`${file}: exists`, 'success');
      } else {
        this.log(`${file}: missing - database setup may be incomplete`, 'warning');
      }
    }

    return true;
  }

  async checkCrossmintConfiguration() {
    this.log('\n🔍 Checking Crossmint Configuration...', 'info');
    
    // Basic validation of Crossmint environment variables
    const crossmintVars = [
      'NEXT_PUBLIC_CROSSMINT_PROJECT_ID',
      'NEXT_PUBLIC_CROSSMINT_API_KEY',
      'CROSSMINT_CLIENT_ID',
      'CROSSMINT_CLIENT_SECRET',
      'CROSSMINT_WEBHOOK_SECRET',
      'CROSSMINT_ENVIRONMENT'
    ];

    let configured = true;
    for (const varName of crossmintVars) {
      if (!process.env[varName] || process.env[varName].includes('your_')) {
        this.log(`${varName}: not configured`, 'error');
        configured = false;
      } else {
        this.log(`${varName}: configured`, 'success');
      }
    }

    if (!configured) {
      this.log('Crossmint payment processing will not work without proper configuration', 'error');
      return false;
    }

    // Check environment setting
    const environment = process.env.CROSSMINT_ENVIRONMENT;
    if (environment === 'staging') {
      this.log('CROSSMINT_ENVIRONMENT is set to staging - should be production for live deployment', 'warning');
    } else if (environment === 'production') {
      this.log('CROSSMINT_ENVIRONMENT correctly set to production', 'success');
    } else {
      this.log(`CROSSMINT_ENVIRONMENT is '${environment}' - should be 'production' or 'staging'`, 'error');
      return false;
    }

    // Check for staging keys in production
    if (process.env.NEXT_PUBLIC_CROSSMINT_API_KEY?.includes('staging')) {
      this.log('Using staging API key in production environment', 'error');
      return false;
    }

    this.log('Crossmint configuration appears valid', 'success');
    return true;
  }

  async checkEmailConfiguration() {
    this.log('\n🔍 Checking Email Configuration...', 'info');
    
    const hasResend = process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('your_');
    const hasSendGrid = process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.includes('your_');
    
    if (!hasResend && !hasSendGrid) {
      this.log('No email service configured - payment notifications will not work', 'error');
      return false;
    }

    if (hasResend) {
      this.log('Resend email service configured', 'success');
    }
    
    if (hasSendGrid) {
      this.log('SendGrid email service configured', 'success');
    }

    if (hasResend && hasSendGrid) {
      this.log('Multiple email providers configured - check EMAIL_PROVIDER setting', 'warning');
    }

    return true;
  }

  async checkProductionSettings() {
    this.log('\n🔍 Checking Production Settings...', 'info');
    
    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      this.log(`NODE_ENV is '${process.env.NODE_ENV}', should be 'production'`, 'warning');
    } else {
      this.log('NODE_ENV set to production', 'success');
    }

    // Check app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
      this.log('NEXT_PUBLIC_APP_URL appears to be a development URL', 'warning');
    } else if (appUrl.startsWith('https://')) {
      this.log('NEXT_PUBLIC_APP_URL configured for HTTPS', 'success');
    } else {
      this.log('NEXT_PUBLIC_APP_URL should use HTTPS in production', 'warning');
    }

    // Check debug settings
    if (process.env.DEBUG_EMAIL === 'true') {
      this.log('DEBUG_EMAIL is enabled - disable for production', 'warning');
    }

    if (process.env.DEBUG_WEBHOOKS === 'true') {
      this.log('DEBUG_WEBHOOKS is enabled - disable for production', 'warning');
    }

    return true;
  }

  generateReport() {
    this.log('\n📋 Pre-flight Check Summary', 'info');
    this.log('=' * 50, 'info');
    
    if (this.errors.length === 0) {
      this.log(`${colors.bold}${colors.green}✅ All critical checks passed!${colors.reset}`, 'success');
    } else {
      this.log(`${colors.bold}${colors.red}❌ ${this.errors.length} critical issue(s) found:${colors.reset}`, 'error');
      this.errors.forEach(error => this.log(`  • ${error}`, 'error'));
    }

    if (this.warnings.length > 0) {
      this.log(`${colors.bold}${colors.yellow}⚠️  ${this.warnings.length} warning(s):${colors.reset}`, 'warning');
      this.warnings.forEach(warning => this.log(`  • ${warning}`, 'warning'));
    }

    this.log('\n📚 Next Steps:', 'info');
    
    if (this.errors.length > 0) {
      this.log('1. Fix all critical errors listed above', 'info');
      this.log('2. Re-run this script to verify fixes', 'info');
      this.log('3. Do not deploy to production until all errors are resolved', 'info');
    } else {
      this.log('1. Review and address any warnings', 'info');
      this.log('2. Run end-to-end tests on staging environment', 'info');
      this.log('3. Deploy to production when ready', 'info');
    }

    return this.errors.length === 0;
  }

  async run() {
    this.log(`${colors.bold}🚀 DECODE Production Pre-flight Check${colors.reset}`, 'info');
    this.log('Validating production readiness...', 'info');

    await this.checkEnvironmentVariables();
    await this.checkFileStructure();
    await this.checkSupabaseConnection();
    await this.checkDatabaseTables();
    await this.checkCrossmintConfiguration();
    await this.checkEmailConfiguration();
    await this.checkProductionSettings();

    return this.generateReport();
  }
}

// Run the pre-flight check
async function main() {
  const checker = new ProductionPreflightCheck();
  const success = await checker.run();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}❌ Pre-flight check failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = ProductionPreflightCheck;