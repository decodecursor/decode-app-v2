/**
 * Crossmint Configuration for DECODE Payment Platform
 * 
 * This file contains the configuration and validation functions for Crossmint payment processing.
 * Make sure to set up your environment variables in .env.local before using.
 */

// Crossmint environment configuration
export const crossmintConfig = {
  // Project ID for client-side integration
  projectId: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID || '',
  
  // Server-side API key for operations
  apiKey: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || '',
  
  // Client credentials for server-side operations
  clientId: process.env.CROSSMINT_CLIENT_ID || '',
  clientSecret: process.env.CROSSMINT_CLIENT_SECRET || '',
  webhookSecret: process.env.CROSSMINT_WEBHOOK_SECRET || '',
  
  // Environment setting (staging/production)
  environment: (process.env.CROSSMINT_ENVIRONMENT || 'staging') as 'staging' | 'production',
  
  // Base URLs for different environments
  baseUrls: {
    staging: 'https://staging.crossmint.com',
    production: 'https://crossmint.com'
  }
} as const

/**
 * Validates that the Crossmint configuration is properly set up
 * @returns boolean indicating if configuration is valid
 */
export function validateCrossmintConfig(): boolean {
  const { projectId, apiKey, clientId, clientSecret, webhookSecret } = crossmintConfig
  
  if (!projectId || projectId === 'your_project_id_here') {
    console.error('Crossmint project ID is not configured. Please set NEXT_PUBLIC_CROSSMINT_PROJECT_ID in .env.local')
    return false
  }
  
  if (!apiKey || apiKey === 'your_client_api_key_here') {
    console.error('Crossmint API key is not configured. Please set NEXT_PUBLIC_CROSSMINT_API_KEY in .env.local')
    return false
  }
  
  // Server-side credentials are optional for client-only operations
  if (!clientId || !clientSecret || !webhookSecret) {
    console.warn('Crossmint server-side credentials not fully configured. Webhook processing may be limited.')
  }
  
  return true
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use validateCrossmintConfig instead
 */
export function validateCrossmintApiKey(): boolean {
  return validateCrossmintConfig()
}

/**
 * Gets the current Crossmint environment configuration
 * @returns Object with environment settings
 */
export function getCrossmintEnvironment() {
  const env = process.env.CROSSMINT_ENVIRONMENT || 'staging'
  return {
    environment: crossmintConfig.environment,
    apiKey: crossmintConfig.apiKey,
    projectId: crossmintConfig.projectId,
    baseUrl: crossmintConfig.baseUrls[crossmintConfig.environment],
    isStaging: env === 'staging',
    isProduction: env === 'production'
  }
}

/**
 * Validates the complete Crossmint configuration
 * @returns Object with validation results and details
 */
export function validateCrossmintFullConfig() {
  const env = getCrossmintEnvironment()
  const { projectId, apiKey, clientId, clientSecret, webhookSecret } = crossmintConfig
  
  const hasValidProjectId = !!(projectId && projectId !== 'your_project_id_here')
  const hasValidApiKey = !!(apiKey && apiKey !== 'your_client_api_key_here' && apiKey.length > 10)
  
  return {
    isValid: hasValidProjectId && hasValidApiKey,
    environment: env.environment,
    hasProjectId: !!projectId,
    hasApiKey: !!apiKey,
    hasServerCredentials: !!(clientId && clientSecret && webhookSecret),
    isConfigured: hasValidProjectId && hasValidApiKey,
    errors: [
      ...(!projectId ? ['Missing NEXT_PUBLIC_CROSSMINT_PROJECT_ID environment variable'] : []),
      ...(projectId === 'your_project_id_here' ? ['Please replace placeholder project ID with real ID'] : []),
      ...(!apiKey ? ['Missing NEXT_PUBLIC_CROSSMINT_API_KEY environment variable'] : []),
      ...(apiKey === 'your_client_api_key_here' ? ['Please replace placeholder API key with real key'] : []),
      ...(!hasValidApiKey ? ['Invalid API key format'] : [])
    ]
  }
}

/**
 * Logs the current Crossmint configuration status (for development)
 * Only logs in development environment
 */
export function logCrossmintConfigStatus() {
  if (process.env.NODE_ENV === 'development') {
    const config = validateCrossmintFullConfig()
    console.log('🔧 Crossmint Configuration Status:', {
      environment: config.environment,
      isConfigured: config.isConfigured,
      hasApiKey: config.hasApiKey,
      errors: config.errors
    })
  }
}

// Type definitions for better TypeScript support
export type CrossmintEnvironment = 'staging' | 'production'

export interface CrossmintPaymentData {
  amount: number
  currency: string
  description: string
  buyerEmail?: string
  metadata?: Record<string, any>
}

export interface CrossmintConfig {
  projectId: string
  apiKey: string
  environment: CrossmintEnvironment
  baseUrls: {
    staging: string
    production: string
  }
}