/**
 * Environment variable validation
 * Ensures all required variables are set before starting the application
 */

interface EnvVar {
  name: string
  required: boolean
  publicVar?: boolean
  description?: string
}

const requiredEnvVars: EnvVar[] = [
  // Stripe
  { name: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe API secret key' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', required: true, publicVar: true, description: 'Stripe publishable key' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, description: 'Stripe webhook endpoint secret' },
  
  // Supabase
  { name: 'SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, publicVar: true, description: 'Supabase public URL' },
  { name: 'SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, publicVar: true, description: 'Supabase public anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key' },
  
  // Application
  { name: 'NEXT_PUBLIC_APP_URL', required: true, publicVar: true, description: 'Application URL' },
  
  // Cron Jobs
  { name: 'CRON_SECRET', required: false, description: 'Secret for authenticating cron requests' },
]

export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  requiredEnvVars.forEach(({ name, required, publicVar, description }) => {
    const value = process.env[name]
    
    if (required && !value) {
      errors.push(`Missing required environment variable: ${name}${description ? ` (${description})` : ''}`)
    } else if (!required && !value) {
      warnings.push(`Optional environment variable not set: ${name}${description ? ` (${description})` : ''}`)
    }
    
    // Additional validation for specific variables
    if (value) {
      // Validate Stripe keys format
      if (name === 'STRIPE_SECRET_KEY' && !value.startsWith('sk_')) {
        errors.push(`Invalid ${name}: Should start with 'sk_test_' or 'sk_live_'`)
      }
      if (name === 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' && !value.startsWith('pk_')) {
        errors.push(`Invalid ${name}: Should start with 'pk_test_' or 'pk_live_'`)
      }
      
      // Validate URLs
      if (name.includes('URL') && name !== 'STRIPE_WEBHOOK_SECRET') {
        try {
          new URL(value)
        } catch {
          errors.push(`Invalid ${name}: Must be a valid URL`)
        }
      }
      
      // Check for placeholder values
      if (value.includes('...') || value.includes('your-')) {
        warnings.push(`${name} appears to contain a placeholder value`)
      }
    }
  })
  
  // Log warnings in development
  if (process.env.NODE_ENV === 'development' && warnings.length > 0) {
    console.warn('Environment variable warnings:')
    warnings.forEach(warning => console.warn(`  - ${warning}`))
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Check if running in production with test keys
export function checkProductionKeys() {
  if (process.env.NODE_ENV === 'production') {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    
    if (stripeKey?.includes('test') || publishableKey?.includes('test')) {
      console.warn('⚠️  WARNING: Using test Stripe keys in production environment!')
    }
  }
}

// Run validation on startup
export function runStartupChecks() {
  const { valid, errors } = validateEnvironment()
  
  if (!valid) {
    console.error('❌ Environment validation failed:')
    errors.forEach(error => console.error(`  - ${error}`))
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variables. Check logs for details.')
    }
  } else {
    console.log('✅ Environment validation passed')
  }
  
  checkProductionKeys()
}