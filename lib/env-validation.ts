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
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, description: 'Stripe webhook endpoint secret (legacy /api/webhooks/stripe)' },
  // Promoted to required:true in Slice 4D commit 1 — ambassador payments
  // are live as of Slice 4B+4C, so missing secret should be a hard boot
  // error rather than a runtime 500 on the first webhook event
  // (hardening backlog item 14).
  { name: 'STRIPE_AMBASSADOR_WEBHOOK_SECRET', required: true, description: 'Stripe webhook endpoint secret for /api/webhooks/ambassador-stripe' },

  // Supabase
  { name: 'SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, publicVar: true, description: 'Supabase public URL' },
  { name: 'SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, publicVar: true, description: 'Supabase public anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key' },

  // Application
  { name: 'NEXT_PUBLIC_APP_URL', required: true, publicVar: true, description: 'Application URL' },

  // Bot protection + rate limiting (Slice 4D commit 1)
  { name: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', required: true, publicVar: true, description: 'Cloudflare Turnstile client-widget site key' },
  { name: 'TURNSTILE_SECRET_KEY', required: true, description: 'Cloudflare Turnstile server-side siteverify secret' },
  { name: 'UPSTASH_REDIS_REST_URL', required: true, description: 'Upstash Redis REST URL (rate-limit backend)' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: true, description: 'Upstash Redis REST token' },

  // Analytics (Slice 4D commit 2)
  // Marked required:true — the runStartupChecks() validator only throws
  // in production, so dev machines get a warning and the hashIp() helper
  // falls back to a hardcoded dev-only salt. Prod boot fails loudly.
  { name: 'ANALYTICS_IP_SALT', required: true, description: 'HMAC salt for daily-rotating IP hashes in model_analytics_events (GDPR-safe bucketing — raw IP never stored)' },

  // Cron Jobs
  { name: 'CRON_SECRET', required: false, description: 'Secret for authenticating cron requests' },
]

// Prefix patterns for Stripe key format + mode detection (hardening
// backlog item 16). Each pattern captures the mode (test|live) so we
// can cross-check keys are all in the same mode.
const STRIPE_KEY_PATTERNS: Record<string, RegExp> = {
  STRIPE_SECRET_KEY: /^sk_(test|live)_[A-Za-z0-9_]+$/,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: /^pk_(test|live)_[A-Za-z0-9_]+$/,
}

function stripeKeyMode(name: string, value: string): 'test' | 'live' | null {
  const m = STRIPE_KEY_PATTERNS[name]?.exec(value)
  return m ? (m[1] as 'test' | 'live') : null
}

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
      // Stripe key prefix — full regex, not just `startsWith` (catches
      // transpositions like a publishable key in the secret slot).
      const stripePattern = STRIPE_KEY_PATTERNS[name]
      if (stripePattern && !stripePattern.test(value)) {
        errors.push(`Invalid ${name}: expected format matching ${stripePattern.source}`)
      }

      // Webhook secrets must start with `whsec_` (both legacy + ambassador).
      if ((name === 'STRIPE_WEBHOOK_SECRET' || name === 'STRIPE_AMBASSADOR_WEBHOOK_SECRET')
        && !value.startsWith('whsec_')) {
        errors.push(`Invalid ${name}: expected to start with 'whsec_'`)
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

  // Cross-key mode consistency for Stripe (hardening backlog item 16).
  // All three Stripe keys should resolve to the same mode (test OR
  // live). Mixed modes are the single biggest Vercel env pitfall —
  // caught the 4B+4C diagnosis session after ~90 min of debugging.
  const secretMode = stripeKeyMode('STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY ?? '')
  const pubMode = stripeKeyMode('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')
  if (secretMode && pubMode && secretMode !== pubMode) {
    errors.push(
      `Stripe key mode mismatch: STRIPE_SECRET_KEY is '${secretMode}' but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is '${pubMode}'. Both keys must be in the same mode.`,
    )
  }
  
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