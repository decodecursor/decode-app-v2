import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 DEBUG: Client environment variables check')
  
  try {
    // Check what environment variables are actually available
    const clientEnvVars = {
      // Crossmint variables
      NEXT_PUBLIC_CROSSMINT_PROJECT_ID: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID,
      NEXT_PUBLIC_CROSSMINT_API_KEY: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_CROSSMINT_WEBHOOK_SECRET: process.env.NEXT_PUBLIC_CROSSMINT_WEBHOOK_SECRET ? 'SET' : 'MISSING',
      NEXT_PUBLIC_DECODE_WALLET_ADDRESS: process.env.NEXT_PUBLIC_DECODE_WALLET_ADDRESS,
      
      // Server-side only (should not be accessible)
      CROSSMINT_API_KEY: process.env.CROSSMINT_API_KEY ? 'SET (SERVER-SIDE)' : 'MISSING',
      CROSSMINT_WEBHOOK_SECRET: process.env.CROSSMINT_WEBHOOK_SECRET ? 'SET (SERVER-SIDE)' : 'MISSING',
      DECODE_WALLET_ADDRESS: process.env.DECODE_WALLET_ADDRESS ? 'SET (SERVER-SIDE)' : 'MISSING',
      
      // Other variables
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    }

    return NextResponse.json({
      success: true,
      message: 'Client environment variables debug',
      variables: clientEnvVars,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ DEBUG: Error checking client environment variables:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to check client environment variables',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error
        }
      },
      { status: 500 }
    )
  }
}