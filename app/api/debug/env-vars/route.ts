import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 DEBUG: Environment variables audit')
  
  try {
    // List of environment variables to check
    const envVarsToCheck = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_ENVIRONMENT',
      'NEXT_PUBLIC_CROSSMINT_PROJECT_ID',
      'NEXT_PUBLIC_CROSSMINT_API_KEY',
      'CROSSMINT_API_KEY',
      'CROSSMINT_CLIENT_ID',
      'CROSSMINT_CLIENT_SECRET',
      'CROSSMINT_WEBHOOK_SECRET',
      'CROSSMINT_ENVIRONMENT',
      'NEXT_PUBLIC_APP_URL',
      'RESEND_API_KEY',
      'NODE_ENV'
    ]

    const envStatus: Record<string, any> = {}
    
    for (const varName of envVarsToCheck) {
      const value = process.env[varName]
      if (value) {
        // Only show first 10 and last 4 characters for security
        const masked = value.length > 14 
          ? `${value.substring(0, 10)}...${value.slice(-4)}`
          : value.substring(0, 8) + '...'
        
        envStatus[varName] = {
          status: 'SET',
          length: value.length,
          preview: masked,
          startsWithSk: value.startsWith('sk_'),
          startsWithHttps: value.startsWith('https://'),
          startsWithNext: value.startsWith('NEXT_')
        }
      } else {
        envStatus[varName] = {
          status: 'MISSING',
          value: undefined
        }
      }
    }

    // Additional debug info
    const debugInfo = {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL,
      totalEnvVars: Object.keys(process.env).length,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      environmentVariables: envStatus,
      debugInfo,
      message: 'Environment variables audit completed'
    })

  } catch (error) {
    console.error('❌ DEBUG: Error in environment variables audit:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to audit environment variables',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error
        }
      },
      { status: 500 }
    )
  }
}